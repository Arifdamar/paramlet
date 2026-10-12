// Saved parameter groups. They are stored per site in storage.sync, so they
// follow the user to every browser signed in to the same account.

/**
 * @typedef {object} Group
 * @property {string} name
 * @property {{ key: string, value: string }[]} params
 */

const PREFIX = "groups:";

/**
 * The site a URL's groups belong to: its host and port, without a leading
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

/** @returns {Promise<Group[]>} */
export async function loadGroups(site) {
  const key = PREFIX + site;
  const stored = await browser.storage.sync.get(key);
  return stored[key] ?? [];
}

/** @param {Group[]} groups */
export async function saveGroups(site, groups) {
  const key = PREFIX + site;
  if (groups.length === 0) await browser.storage.sync.remove(key);
  else await browser.storage.sync.set({ [key]: groups });
}

const sameName = (a, b) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * The list with `group` added at the end, or put in place of an existing group
 * with the same name (ignoring case).
 *
 * @param {Group[]} groups
 * @param {Group} group
 */
export function upsertGroup(groups, group) {
  const index = groups.findIndex((existing) => sameName(existing.name, group.name));
  return index === -1 ? [...groups, group] : groups.with(index, group);
}
