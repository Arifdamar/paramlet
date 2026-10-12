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
 * @property {string} search        The query including `?`, or "".
 * @property {Param[]} params       Every `&`-separated segment of the query, empty ones too.
 * @property {string} hash          The fragment including `#`, or "".
 * @property {string} hashPrefix    The part of the fragment before its parameters:
 *                                  "#/route?" or "#". The whole fragment if it has none.
 * @property {Param[] | null} hashParams  Parameters in the fragment, or null if it has none.
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

function splitUrl(href) {
  const hashAt = href.indexOf("#");
  const beforeHash = hashAt === -1 ? href : href.slice(0, hashAt);
  const hash = hashAt === -1 ? "" : href.slice(hashAt);
  const queryAt = beforeHash.indexOf("?");
  if (queryAt === -1) return { base: beforeHash, search: "", query: null, hash };
  return {
    base: beforeHash.slice(0, queryAt),
    search: beforeHash.slice(queryAt),
    query: beforeHash.slice(queryAt + 1),
    hash,
  };
}

// Single-page apps keep parameters in the fragment, either after a route
// (`#/route?x=1`) or as the whole fragment (`#access_token=…&state=…`). A plain
// anchor (`#top`), a route without parameters (`#/route`) and a text fragment
// (`#:~:text=…`) have none.
function splitHash(hash) {
  const queryAt = hash.indexOf("?");
  if (queryAt !== -1) return { prefix: hash.slice(0, queryAt + 1), query: hash.slice(queryAt + 1) };
  const body = hash.slice(1);
  const equalsAt = body.indexOf("=");
  if (equalsAt > 0 && !body.slice(0, equalsAt).includes("/") && !body.startsWith(":~:")) {
    return { prefix: "#", query: body };
  }
  return { prefix: hash, query: null };
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
  const { base, search, query, hash } = splitUrl(href);
  const { prefix, query: hashQuery } = splitHash(hash);
  return {
    href,
    base,
    search,
    params: query === null ? [] : query.split("&").map(parseSegment),
    hash,
    hashPrefix: prefix,
    hashParams: hashQuery === null ? null : hashQuery.split("&").map(parseSegment),
  };
}

const countSegments = (query) =>
  query === null ? 0 : query.split("&").filter((segment) => segment !== "").length;

/** Number of real parameters in a URL, query and fragment together; `a=1&&b=2&` counts as two. */
export function countParams(href) {
  const { query, hash } = splitUrl(href);
  return countSegments(query) + countSegments(splitHash(hash).query);
}

/**
 * Reads parameters out of pasted text: a whole URL, a query string
 * (`?a=1&b=2`), or one `key=value` per line. Returns null when the text does
 * not look like parameters, so it can be pasted as plain text instead.
 *
 * @returns {{ key: string, value: string }[] | null}
 */
export function paramsFromText(text) {
  const trimmed = text.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed)) {
    const { query } = splitUrl(trimmed);
    return query === null ? null : listFromQuery(query);
  }
  if (/[\r\n]/.test(trimmed)) {
    const lines = trimmed.split(/[\r\n]+/).map((line) => line.trim()).filter((line) => line !== "");
    if (!lines.some((line) => line.includes("="))) return null;
    return lines.map((line) => {
      const equalsAt = line.indexOf("=");
      if (equalsAt === -1) return { key: line, value: "" };
      return { key: line.slice(0, equalsAt).trim(), value: line.slice(equalsAt + 1).trim() };
    });
  }
  const query = trimmed.replace(/^[?#]/, "");
  if (!query.includes("=") && !query.includes("&")) return null;
  return listFromQuery(query);
}

function listFromQuery(query) {
  const params = query
    .split("&")
    .filter((segment) => segment !== "")
    .map(parseSegment)
    .map(({ key, value }) => ({ key, value }));
  return params.length === 0 ? null : params;
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

function keptRows(rows) {
  return rows.filter((row) => row.source !== null || row.key !== "" || row.value !== "");
}

function isChanged(params, rows) {
  const kept = keptRows(rows);
  return (
    kept.length !== params.length ||
    kept.some((row, index) => row.source !== params[index] || !isUnchanged(row))
  );
}

const encodeQuery = (rows) => keptRows(rows).map(encodeRow).join("&");

/**
 * Builds the URL for edited lists of rows: `rows` for the query and, when the
 * fragment has parameters, `hashRows` for those. Rows missing from a list are
 * removed parameters. An added row with neither key nor value is ignored.
 * Leaving `hashRows` out keeps the fragment as it was.
 *
 * @param {ParsedUrl} parsed
 * @param {Row[]} rows
 * @param {Row[]} [hashRows]
 */
export function buildUrl(parsed, rows, hashRows) {
  const searchChanged = isChanged(parsed.params, rows);
  const hashChanged =
    parsed.hashParams !== null && hashRows !== undefined && isChanged(parsed.hashParams, hashRows);
  if (!searchChanged && !hashChanged) return parsed.href;

  let search = parsed.search;
  if (searchChanged) {
    const query = encodeQuery(rows);
    search = query === "" ? "" : `?${query}`;
  }

  let hash = parsed.hash;
  if (hashChanged) {
    const query = encodeQuery(hashRows);
    // With every parameter gone, `#/route?` becomes `#/route` and a bare `#` goes away.
    hash = query === "" ? parsed.hashPrefix.slice(0, -1) : parsed.hashPrefix + query;
  }
  return parsed.base + search + hash;
}

// Pairs each wanted parameter with a row of the same key, in order: the first
// `a` in a preset goes with the first `a` in the URL, the second with the second.
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
