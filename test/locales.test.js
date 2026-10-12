// A missing translation key shows up as an empty label, not as an error, so
// every key the code uses is checked against every locale here.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const locales = readdirSync(join(root, "_locales"));
const messages = Object.fromEntries(
  locales.map((locale) => [
    locale,
    JSON.parse(readFileSync(join(root, "_locales", locale, "messages.json"), "utf8")),
  ]),
);

function sourceFiles(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(js|html)$/.test(entry.name) ? [path] : [];
  });
}

function usedKeys() {
  const keys = new Set();
  const patterns = [/data-i18n(?:-[a-z-]+)?="([^"]+)"/g, /\bt\(\s*"([^"]+)"/g, /__MSG_([A-Za-z0-9_]+)__/g];
  for (const file of [...sourceFiles("src"), "manifest.json"]) {
    const text = readFileSync(join(root, file), "utf8");
    for (const pattern of patterns) for (const [, key] of text.matchAll(pattern)) keys.add(key);
  }
  // Keys picked at run time: t(cond ? "a" : "b").
  for (const file of sourceFiles("src")) {
    const text = readFileSync(join(root, file), "utf8");
    for (const [, a, b] of text.matchAll(/\bt\(\s*[^,()"]+\?\s*"([^"]+)"\s*:\s*"([^"]+)"/g)) {
      keys.add(a).add(b);
    }
  }
  return keys;
}

test("there is more than one locale and English is one of them", () => {
  assert.ok(locales.includes("en"));
  assert.ok(locales.length > 1);
});

test("every key used in the code exists in every locale", () => {
  const keys = usedKeys();
  assert.ok(keys.size > 20, "the key scan found too little to be working");
  for (const locale of locales) {
    const missing = [...keys].filter((key) => !messages[locale][key]?.message);
    assert.deepEqual(missing, [], `missing in ${locale}`);
  }
});

test("all locales have the same keys", () => {
  const english = Object.keys(messages.en).sort();
  for (const locale of locales) {
    assert.deepEqual(Object.keys(messages[locale]).sort(), english, locale);
  }
});

test("no locale has an unused key", () => {
  const keys = usedKeys();
  assert.deepEqual(Object.keys(messages.en).filter((key) => !keys.has(key)), []);
});
