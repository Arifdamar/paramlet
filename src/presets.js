// Saved parameter presets. They are stored per site in storage.sync, so they
// follow the user to every browser signed in to the same account. Presets
// saved for every site live under the site name "*".

/**
 * @typedef {object} Preset
 * @property {string} name
 * @property {{ key: string, value: string }[]} params
 */

/** @typedef {Record<string, Preset[]>} PresetsBySite */

const PREFIX = "presets:";
const EXPORT_FORMAT = "paramlet-presets";
const EXPORT_VERSION = 1;

/** The site name for presets that apply everywhere. */
export const ALL_SITES = "*";

/**
 * The site a URL's presets belong to: its host and port, without a leading
 * "www.". Returns "" for URLs that have no host, such as file:// pages.
 */
export function siteOf(href) {
  let url;
  try {
    url = new URL(href);
  } catch {
    return "";
  }
  return url.host.replace(/^www\./, "");
}

/** @returns {Promise<Preset[]>} */
export async function loadPresets(site) {
  const key = PREFIX + site;
  const stored = await browser.storage.sync.get(key);
  return stored[key] ?? [];
}

/** @param {Preset[]} presets */
export async function savePresets(site, presets) {
  const key = PREFIX + site;
  if (presets.length === 0) await browser.storage.sync.remove(key);
  else await browser.storage.sync.set({ [key]: presets });
}

/**
 * Saves several sites' presets in one write, so either all of them are stored
 * or, if storage is full, none are.
 *
 * @param {PresetsBySite} bySite
 */
export async function savePresetsBySite(bySite) {
  await browser.storage.sync.set(
    Object.fromEntries(Object.entries(bySite).map(([site, presets]) => [PREFIX + site, presets])),
  );
}

/** @returns {Promise<PresetsBySite>} */
export async function loadAllPresets() {
  const stored = await browser.storage.sync.get(null);
  const bySite = {};
  for (const [key, presets] of Object.entries(stored)) {
    if (key.startsWith(PREFIX)) bySite[key.slice(PREFIX.length)] = presets;
  }
  return bySite;
}

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The list with `preset` added at the end, or put in place of an existing
 * preset with the same name (ignoring case).
 *
 * @param {Preset[]} presets
 * @param {Preset} preset
 */
export function upsertPreset(presets, preset) {
  const index = presets.findIndex((existing) => sameName(existing.name, preset.name));
  return index === -1 ? [...presets, preset] : presets.with(index, preset);
}

/**
 * The list with the preset at `from` moved to `to`; the others keep their
 * order. Out-of-range positions leave the list as it is.
 *
 * @param {Preset[]} presets
 */
export function movePreset(presets, from, to) {
  if (from === to || ![from, to].every((i) => Number.isInteger(i) && i >= 0 && i < presets.length)) {
    return presets;
  }
  const next = presets.toSpliced(from, 1);
  return next.toSpliced(to, 0, presets[from]);
}

/** The file contents for an export of every preset. */
export function exportPresets(bySite) {
  return JSON.stringify({ format: EXPORT_FORMAT, version: EXPORT_VERSION, presets: bySite }, null, 2);
}

const isString = (value) => typeof value === "string";

function readPreset(preset) {
  if (!preset || !isString(preset.name) || preset.name.trim() === "") return null;
  if (!Array.isArray(preset.params) || preset.params.length === 0) return null;
  const params = [];
  for (const param of preset.params) {
    if (!param || !isString(param.key) || param.key === "" || !isString(param.value)) return null;
    params.push({ key: param.key, value: param.value });
  }
  return { name: preset.name.trim(), params };
}

/**
 * Reads an export file. Returns null if the text is not a Paramlet export or
 * any preset in it is malformed; nothing is imported from a damaged file.
 *
 * @returns {PresetsBySite | null}
 */
export function readExport(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  if (data?.format !== EXPORT_FORMAT || data.version !== EXPORT_VERSION) return null;
  if (!data.presets || typeof data.presets !== "object" || Array.isArray(data.presets)) return null;

  const bySite = {};
  for (const [site, presets] of Object.entries(data.presets)) {
    if (site === "" || !Array.isArray(presets)) return null;
    const read = presets.map(readPreset);
    if (read.includes(null)) return null;
    bySite[site] = read;
  }
  return bySite;
}

/**
 * Adds imported presets to existing ones. A preset with the name of an
 * existing one on the same site replaces it.
 *
 * @param {PresetsBySite} existing
 * @param {PresetsBySite} imported
 * @returns {{ merged: PresetsBySite, changedSites: string[], count: number }}
 */
export function mergePresets(existing, imported) {
  const merged = { ...existing };
  const changedSites = [];
  let count = 0;
  for (const [site, presets] of Object.entries(imported)) {
    if (presets.length === 0) continue;
    merged[site] = presets.reduce(upsertPreset, merged[site] ?? []);
    changedSites.push(site);
    count += presets.length;
  }
  return { merged, changedSites, count };
}
