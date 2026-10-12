import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildUrl,
  containsParams,
  countParams,
  decodeComponent,
  mergeParams,
  paramsFromText,
  parseUrl,
} from "../src/query.js";

const rowsOf = (parsed) => parsed.params.map((p) => ({ source: p, key: p.key, value: p.value }));

test("counts real parameters only", () => {
  assert.equal(countParams("https://example.com/"), 0);
  assert.equal(countParams("https://example.com/?"), 0);
  assert.equal(countParams("https://example.com/?a=1&b=2"), 2);
  assert.equal(countParams("https://example.com/?a=1&&b=2&"), 2);
  assert.equal(countParams("https://example.com/?flag"), 1);
});

test("fragment parameters are counted with the query's", () => {
  assert.equal(countParams("https://example.com/app#/route?x=1"), 1);
  assert.equal(countParams("https://example.com/?a=1#/route?x=1&y=2"), 3);
  assert.equal(countParams("https://example.com/cb#access_token=t&state=s"), 2);
});

test("anchors, bare routes and text fragments have no fragment parameters", () => {
  for (const href of [
    "https://example.com/#top",
    "https://example.com/#/users/7",
    "https://example.com/#/a=b/c",
    "https://example.com/#:~:text=hello",
  ]) {
    assert.equal(parseUrl(href).hashParams, null, href);
    assert.equal(countParams(href), 0, href);
  }
});

test("fragment parameters are parsed after a route or as the whole fragment", () => {
  const routed = parseUrl("https://example.com/?a=1#/route?x=1&y=two+words");
  assert.equal(routed.hashPrefix, "#/route?");
  assert.deepEqual(routed.hashParams.map(({ key, value }) => [key, value]), [["x", "1"], ["y", "two words"]]);
  assert.equal(parseUrl("https://example.com/#k=v").hashPrefix, "#");
});

test("decodes keys and values for display", () => {
  const { params } = parseUrl("https://example.com/?q=hello+world&name=%C5%9Fey&flag&empty=");
  assert.deepEqual(
    params.map(({ key, value, hasEquals }) => [key, value, hasEquals]),
    [
      ["q", "hello world", true],
      ["name", "şey", true],
      ["flag", "", false],
      ["empty", "", true],
    ],
  );
});

test("a malformed escape is shown as written", () => {
  assert.equal(decodeComponent("%E0%A4%A"), "%E0%A4%A");
});

test("an untouched URL comes back byte for byte", () => {
  const href = "https://example.com/p?flag&x=a%20b+c&a=1&a=2&&u=%2Fpath,x:y#h?z=1";
  const parsed = parseUrl(href);
  assert.equal(buildUrl(parsed, rowsOf(parsed)), href);
});

test("editing one value leaves every other segment as written", () => {
  const parsed = parseUrl("https://example.com/?flag&x=a%20b+c&u=%2Fp,x:y&id=1#top");
  const rows = rowsOf(parsed);
  rows[3].value = "2";
  assert.equal(buildUrl(parsed, rows), "https://example.com/?flag&x=a%20b+c&u=%2Fp,x:y&id=2#top");
});

test("repeated keys stay separate; editing one does not touch the other", () => {
  const parsed = parseUrl("https://example.com/?tag=a&tag=b");
  const rows = rowsOf(parsed);
  rows[1].value = "c";
  assert.equal(buildUrl(parsed, rows), "https://example.com/?tag=a&tag=c");
});

test("empty segments survive an edit elsewhere", () => {
  const parsed = parseUrl("https://example.com/?a=1&&b=2&");
  const rows = rowsOf(parsed);
  rows[0].value = "9";
  assert.equal(buildUrl(parsed, rows), "https://example.com/?a=9&&b=2&");
});

test("edited text is percent-encoded", () => {
  const parsed = parseUrl("https://example.com/?q=x");
  const rows = rowsOf(parsed);
  rows[0].value = "a b&c=d/ş";
  assert.equal(buildUrl(parsed, rows), "https://example.com/?q=a%20b%26c%3Dd%2F%C5%9F");
});

test("removing a parameter drops only that segment", () => {
  const parsed = parseUrl("https://example.com/?utm_source=x&id=7&utm_medium=y");
  const rows = rowsOf(parsed);
  assert.equal(buildUrl(parsed, [rows[1]]), "https://example.com/?id=7");
});

test("removing every parameter drops the ? and keeps the fragment", () => {
  const parsed = parseUrl("https://example.com/p?a=1&b=2#section");
  assert.equal(buildUrl(parsed, []), "https://example.com/p#section");
});

test("an added parameter goes at the end; an empty value adds a bare key", () => {
  const parsed = parseUrl("https://example.com/?a=1");
  const rows = [
    ...rowsOf(parsed),
    { source: null, key: "debug", value: "" },
    { source: null, key: "lang", value: "tr" },
  ];
  assert.equal(buildUrl(parsed, rows), "https://example.com/?a=1&debug&lang=tr");
});

test("adding to a URL without a query creates one", () => {
  const parsed = parseUrl("https://example.com/p#top");
  assert.equal(
    buildUrl(parsed, [{ source: null, key: "a", value: "1" }]),
    "https://example.com/p?a=1#top",
  );
});

test("a blank added row is ignored", () => {
  const href = "https://example.com/?a=1";
  const parsed = parseUrl(href);
  assert.equal(buildUrl(parsed, [...rowsOf(parsed), { source: null, key: "", value: "" }]), href);
});

test("giving a bare flag a value adds the =", () => {
  const parsed = parseUrl("https://example.com/?flag");
  const rows = rowsOf(parsed);
  rows[0].value = "on";
  assert.equal(buildUrl(parsed, rows), "https://example.com/?flag=on");
});

test("renaming a key keeps an explicit empty value", () => {
  const parsed = parseUrl("https://example.com/?a=");
  const rows = rowsOf(parsed);
  rows[0].key = "b";
  assert.equal(buildUrl(parsed, rows), "https://example.com/?b=");
});

test("setting a value back to its original restores the raw segment", () => {
  const parsed = parseUrl("https://example.com/?q=a+b");
  const rows = rowsOf(parsed);
  rows[0].value = "a b";
  assert.equal(buildUrl(parsed, rows), "https://example.com/?q=a+b");
});

test("a preset overwrites existing keys, appends missing ones, and leaves the rest", () => {
  const parsed = parseUrl("https://example.com/?utm_source=x&id=3&q=a+b");
  const merged = mergeParams(rowsOf(parsed), [
    { key: "id", value: "7" },
    { key: "debug", value: "1" },
  ]);
  assert.equal(buildUrl(parsed, merged), "https://example.com/?utm_source=x&id=7&q=a+b&debug=1");
});

test("merging does not modify the rows it was given", () => {
  const parsed = parseUrl("https://example.com/?id=3");
  const rows = rowsOf(parsed);
  mergeParams(rows, [{ key: "id", value: "7" }]);
  assert.equal(rows[0].value, "3");
});

test("repeated keys in a preset pair up with repeated keys in the URL, in order", () => {
  const parsed = parseUrl("https://example.com/?tag=a&tag=b");
  const merged = mergeParams(rowsOf(parsed), [
    { key: "tag", value: "x" },
    { key: "tag", value: "y" },
    { key: "tag", value: "z" },
  ]);
  assert.equal(buildUrl(parsed, merged), "https://example.com/?tag=x&tag=y&tag=z");
});

test("a preset whose values are already set leaves the URL unchanged", () => {
  const href = "https://example.com/?debug=1&id=7";
  const parsed = parseUrl(href);
  const params = [{ key: "id", value: "7" }, { key: "debug", value: "1" }];
  assert.equal(containsParams(rowsOf(parsed), params), true);
  assert.equal(buildUrl(parsed, mergeParams(rowsOf(parsed), params)), href);
});

test("a preset is not contained when a value differs or a key is missing", () => {
  const rows = rowsOf(parseUrl("https://example.com/?id=7&tag=a"));
  assert.equal(containsParams(rows, [{ key: "id", value: "8" }]), false);
  assert.equal(containsParams(rows, [{ key: "debug", value: "1" }]), false);
  assert.equal(containsParams(rows, [{ key: "tag", value: "a" }, { key: "tag", value: "a" }]), false);
});

test("editing a fragment parameter leaves the query and route as written", () => {
  const parsed = parseUrl("https://example.com/p?q=a+b#/route?x=1&y=%20z");
  const hashRows = rowsOf({ params: parsed.hashParams });
  hashRows[0].value = "2";
  assert.equal(
    buildUrl(parsed, rowsOf(parsed), hashRows),
    "https://example.com/p?q=a+b#/route?x=2&y=%20z",
  );
});

test("editing the query leaves fragment parameters as written", () => {
  const parsed = parseUrl("https://example.com/?id=1#/route?x=a+b");
  const rows = rowsOf(parsed);
  rows[0].value = "2";
  assert.equal(
    buildUrl(parsed, rows, rowsOf({ params: parsed.hashParams })),
    "https://example.com/?id=2#/route?x=a+b",
  );
});

test("removing every fragment parameter keeps the route and drops a bare #", () => {
  const routed = parseUrl("https://example.com/#/route?x=1");
  assert.equal(buildUrl(routed, [], []), "https://example.com/#/route");
  const bare = parseUrl("https://example.com/?a=1#k=v");
  assert.equal(buildUrl(bare, rowsOf(bare), []), "https://example.com/?a=1");
});

test("pasted query strings and URLs become parameters", () => {
  assert.deepEqual(paramsFromText("?a=1&b=two+words"), [
    { key: "a", value: "1" },
    { key: "b", value: "two words" },
  ]);
  assert.deepEqual(paramsFromText("  https://example.com/x?utm_source=g&flag#top "), [
    { key: "utm_source", value: "g" },
    { key: "flag", value: "" },
  ]);
  assert.deepEqual(paramsFromText("a=%C5%9F"), [{ key: "a", value: "ş" }]);
});

test("pasted lines are read as key=value without decoding", () => {
  assert.deepEqual(paramsFromText("debug = 1\nq=a+b%20\r\n\nflag"), [
    { key: "debug", value: "1" },
    { key: "q", value: "a+b%20" },
    { key: "flag", value: "" },
  ]);
});

test("plain text is not taken for parameters", () => {
  assert.equal(paramsFromText("utm_source"), null);
  assert.equal(paramsFromText("https://example.com/no-query"), null);
  assert.equal(paramsFromText("one\ntwo"), null);
  assert.equal(paramsFromText("?"), null);
});
