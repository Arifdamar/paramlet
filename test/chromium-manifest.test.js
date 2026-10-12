import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromiumManifest } from "../scripts/chromium-manifest.mjs";

const firefox = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const chromium = chromiumManifest(firefox);

test("the Chromium manifest has no Firefox-only keys", () => {
  for (const key of ["page_action", "browser_specific_settings"]) {
    assert.equal(key in chromium, false, key);
  }
  assert.equal(chromium.background.scripts, undefined);
});

test("the panel opens from the toolbar button, with the same shortcut", () => {
  assert.equal(chromium.action.default_popup, firefox.page_action.default_popup);
  assert.deepEqual(chromium.commands._execute_action, firefox.commands._execute_page_action);
  assert.equal("_execute_page_action" in chromium.commands, false);
});

test("the background script runs as a module service worker", () => {
  assert.deepEqual(chromium.background, { service_worker: "src/background.js", type: "module" });
});

test("icons are PNG files that exist", () => {
  const paths = [...Object.values(chromium.icons), ...Object.values(chromium.action.default_icon)];
  for (const path of paths) {
    assert.match(path, /\.png$/);
    assert.ok(readFileSync(new URL(`../${path}`, import.meta.url)).length > 0, path);
  }
});

test("everything else is carried over", () => {
  for (const key of ["name", "version", "description", "default_locale", "permissions", "options_ui"]) {
    assert.deepEqual(chromium[key], firefox[key], key);
  }
});
