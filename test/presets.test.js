import { test } from "node:test";
import assert from "node:assert/strict";
import {
  exportPresets,
  mergePresets,
  movePreset,
  readExport,
  siteOf,
  upsertPreset,
} from "../src/presets.js";

test("www and the bare domain are the same site", () => {
  assert.equal(siteOf("https://www.example.com/a?b=1"), "example.com");
  assert.equal(siteOf("https://example.com/"), "example.com");
});

test("subdomains and ports are separate sites", () => {
  assert.equal(siteOf("https://app.example.com/"), "app.example.com");
  assert.equal(siteOf("http://localhost:3000/"), "localhost:3000");
  assert.equal(siteOf("http://localhost:5173/"), "localhost:5173");
});

test("http and https share a site; the default port is not part of it", () => {
  assert.equal(siteOf("http://example.com:80/"), siteOf("https://example.com:443/"));
});

test("a URL without a host has no site", () => {
  assert.equal(siteOf("file:///Users/me/page.html?a=1"), "");
  assert.equal(siteOf("not a url"), "");
});

test("saving under a new name adds the preset at the end", () => {
  const a = { name: "a", params: [{ key: "x", value: "1" }] };
  const b = { name: "b", params: [{ key: "y", value: "2" }] };
  assert.deepEqual(upsertPreset([a], b), [a, b]);
});

test("saving under an existing name replaces that preset in place, ignoring case", () => {
  const a = { name: "Debug", params: [{ key: "x", value: "1" }] };
  const b = { name: "b", params: [] };
  const replacement = { name: "debug ", params: [{ key: "x", value: "2" }] };
  assert.deepEqual(upsertPreset([a, b], replacement), [replacement, b]);
});

const debug = { name: "Debug", params: [{ key: "debug", value: "1" }] };
const lang = { name: "Turkish", params: [{ key: "lang", value: "tr" }] };

test("an export reads back to the same presets", () => {
  const bySite = { "example.com": [debug], "*": [lang] };
  assert.deepEqual(readExport(exportPresets(bySite)), bySite);
});

test("an import keeps only the preset fields and trims names", () => {
  const text = JSON.stringify({
    format: "paramlet-presets",
    version: 1,
    presets: { "example.com": [{ name: " Debug ", extra: 1, params: [{ key: "a", value: "1", x: 2 }] }] },
  });
  assert.deepEqual(readExport(text), { "example.com": [{ name: "Debug", params: [{ key: "a", value: "1" }] }] });
});

test("anything that is not a whole, valid export is refused", () => {
  const wrap = (presets, extra = {}) =>
    JSON.stringify({ format: "paramlet-presets", version: 1, presets, ...extra });
  for (const text of [
    "not json",
    "[]",
    JSON.stringify({ presets: { "example.com": [debug] } }),
    wrap({ "example.com": [debug] }, { version: 2 }),
    wrap([debug]),
    wrap({ "example.com": debug }),
    wrap({ "": [debug] }),
    wrap({ "example.com": [debug, { name: "", params: [{ key: "a", value: "" }] }] }),
    wrap({ "example.com": [{ name: "x", params: [] }] }),
    wrap({ "example.com": [{ name: "x", params: [{ key: "", value: "1" }] }] }),
    wrap({ "example.com": [{ name: "x", params: [{ key: "a", value: 1 }] }] }),
  ]) {
    assert.equal(readExport(text), null, text);
  }
});

test("importing adds new presets and replaces ones with the same name on the same site", () => {
  const existing = { "example.com": [debug, lang], "other.com": [debug] };
  const newDebug = { name: "debug", params: [{ key: "debug", value: "2" }] };
  const { merged, changedSites, count } = mergePresets(existing, {
    "example.com": [newDebug],
    "*": [lang],
  });
  assert.deepEqual(merged, {
    "example.com": [newDebug, lang],
    "other.com": [debug],
    "*": [lang],
  });
  assert.deepEqual(changedSites, ["example.com", "*"]);
  assert.equal(count, 2);
});

test("moving a preset keeps the others in order", () => {
  const [a, b, c, d] = ["a", "b", "c", "d"].map((name) => ({ name, params: [] }));
  assert.deepEqual(movePreset([a, b, c, d], 0, 2), [b, c, a, d]);
  assert.deepEqual(movePreset([a, b, c, d], 3, 0), [d, a, b, c]);
  assert.deepEqual(movePreset([a, b, c, d], 1, 3), [a, c, d, b]);
});

test("moving to the same or an impossible place changes nothing", () => {
  const list = [{ name: "a", params: [] }, { name: "b", params: [] }];
  for (const [from, to] of [[0, 0], [0, 2], [-1, 0], [1, 1.5]]) {
    assert.equal(movePreset(list, from, to), list, `${from} → ${to}`);
  }
});
