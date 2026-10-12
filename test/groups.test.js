import { test } from "node:test";
import assert from "node:assert/strict";
import { siteOf, upsertGroup } from "../src/groups.js";

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

test("saving under a new name adds the group at the end", () => {
  const a = { name: "a", params: [{ key: "x", value: "1" }] };
  const b = { name: "b", params: [{ key: "y", value: "2" }] };
  assert.deepEqual(upsertGroup([a], b), [a, b]);
});

test("saving under an existing name replaces that group in place, ignoring case", () => {
  const a = { name: "Debug", params: [{ key: "x", value: "1" }] };
  const b = { name: "b", params: [] };
  const replacement = { name: "debug ", params: [{ key: "x", value: "2" }] };
  assert.deepEqual(upsertGroup([a, b], replacement), [replacement, b]);
});
