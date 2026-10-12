// Splitting a URL into its query parameters and putting it back together.
//
// The rule this file exists for: a parameter you did not touch comes back
// exactly as it was. URLSearchParams re-encodes the whole query on the way out
// (`%20` becomes `+`, `?flag` becomes `flag=`), so it is not used here. Every
// parameter keeps its raw text, and only an edited one is re-encoded.

/**
 * @typedef {object} Param
 * @property {string} raw        The segment exactly as it appears in the URL.
 * @property {string} key        Decoded key, as shown to the user.
 * @property {string} value      Decoded value, as shown to the user.
 * @property {boolean} hasEquals Whether the segment had an `=` (`a=` vs `a`).
 */

/**
 * @typedef {object} ParsedUrl
 * @property {string} href          The URL that was parsed.
 * @property {string} base          Everything before the `?`.
 * @property {string} hash          The fragment including `#`, or "".
 * @property {Param[]} params       Every `&`-separated segment, empty ones too.
 */

/**
 * @typedef {object} Row
 * @property {Param | null} source  The parameter this row was made from, or null if added.
 * @property {string} key
 * @property {string} value
 */

/** Decodes a query component for display. Malformed escapes are shown as written. */
export function decodeComponent(text) {
  const spaced = text.replace(/\+/g, " ");
  try {
    return decodeURIComponent(spaced);
  } catch {
    return spaced;
  }
}

function splitQuery(href) {
  const hashAt = href.indexOf("#");
  const beforeHash = hashAt === -1 ? href : href.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : href.slice(hashAt);
  const queryAt = beforeHash.indexOf("?");
  if (queryAt === -1) return { base: beforeHash, query: null, hash };
  return { base: beforeHash.slice(0, queryAt), query: beforeHash.slice(queryAt + 1), hash };
}

function parseSegment(raw) {
  const equalsAt = raw.indexOf("=");
  if (equalsAt === -1) {
    return { raw, key: decodeComponent(raw), value: "", hasEquals: false };
  }
  return {
    raw,
    key: decodeComponent(raw.slice(0, equalsAt)),
    value: decodeComponent(raw.slice(equalsAt + 1)),
    hasEquals: true,
  };
}

/** @returns {ParsedUrl} */
export function parseUrl(href) {
  const { base, query, hash } = splitQuery(href);
  const params = query === null ? [] : query.split("&").map(parseSegment);
  return { href, base, hash, params };
}

/** Number of real parameters in a URL; `a=1&&b=2&` counts as two. */
export function countParams(href) {
  const { query } = splitQuery(href);
  if (query === null) return 0;
  return query.split("&").filter((segment) => segment !== "").length;
}

function isUnchanged(row) {
  return row.source !== null && row.key === row.source.key && row.value === row.source.value;
}

function encodeRow(row) {
  if (isUnchanged(row)) return row.source.raw;
  const key = encodeURIComponent(row.key);
  const keepEquals = row.value !== "" || (row.source !== null && row.source.hasEquals);
  return keepEquals ? `${key}=${encodeURIComponent(row.value)}` : key;
}

/**
 * Builds the URL for an edited list of rows. Rows missing from the list are
 * removed parameters. An added row with neither key nor value is ignored.
 *
 * @param {ParsedUrl} parsed
 * @param {Row[]} rows
 */
export function buildUrl(parsed, rows) {
  const kept = rows.filter((row) => row.source !== null || row.key !== "" || row.value !== "");
  const changed =
    kept.length !== parsed.params.length ||
    kept.some((row, index) => row.source !== parsed.params[index] || !isUnchanged(row));
  if (!changed) return parsed.href;

  const query = kept.map(encodeRow).join("&");
  return query === "" ? parsed.base + parsed.hash : `${parsed.base}?${query}${parsed.hash}`;
}

// Pairs each wanted parameter with a row of the same key, in order: the first
// `a` in a group goes with the first `a` in the URL, the second with the second.
function matchRows(rows, params) {
  const used = new Set();
  return params.map(({ key }) => {
    const match = rows.find((row) => row.key === key && !used.has(row));
    if (match) used.add(match);
    return match;
  });
}

/**
 * Rows with `params` laid over them: a key already present gets the new value,
 * a missing key is added at the end, and every other row is left alone.
 * The input rows are not modified.
 *
 * @param {Row[]} rows
 * @param {{ key: string, value: string }[]} params
 * @returns {Row[]}
 */
export function mergeParams(rows, params) {
  const merged = rows.map((row) => ({ ...row }));
  const matches = matchRows(merged, params);
  params.forEach(({ key, value }, index) => {
    if (matches[index]) matches[index].value = value;
    else merged.push({ source: null, key, value });
  });
  return merged;
}

/** Whether every one of `params` is already in `rows` with the same value. */
export function containsParams(rows, params) {
  const matches = matchRows(rows, params);
  return params.every(({ value }, index) => matches[index]?.value === value);
}
