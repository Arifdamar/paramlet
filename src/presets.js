// Saved parameter presets. They are stored per site in storage.sync, so they
// follow the user to every browser signed in to the same account.

/**
 * @typedef {object} Preset
 * @property {string} name
 * @property {{ key: string, value: string }[]} params
 */

const PREFIX = "presets:";

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
