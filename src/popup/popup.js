import { buildUrl, containsParams, mergeParams, paramsFromText, parseUrl } from "../query.js";
import { ALL_SITES, loadPresets, savePresets, siteOf, upsertPreset } from "../presets.js";
import { isTrackingKey } from "../tracking.js";
import { localize, t } from "../i18n.js";

localize();

const $ = (id) => document.getElementById(id);
const countEl = $("count");
const removeTrackingButton = $("remove-tracking");
const settingsButton = $("settings");
const searchBarEl = $("search-bar");
const searchInput = $("search");
const emptyEl = $("empty");
const noMatchesEl = $("no-matches");
const rowsEl = $("rows");
const fragmentEl = $("fragment");
const fragmentCountEl = $("fragment-count");
const fragmentPrefixEl = $("fragment-prefix");
const fragmentRowsEl = $("fragment-rows");
const presetsEl = $("presets");
const siteEl = $("site");
const presetListEl = $("preset-list");
const statusEl = $("status");
const footerEl = $("footer");
const addButton = $("add");
const savePresetButton = $("save-preset");
const copyButton = $("copy");
const applyButton = $("apply");
const saveForm = $("save-form");
const presetNameInput = $("preset-name");
const allSitesInput = $("all-sites");
const cancelSaveButton = $("cancel-save");
const confirmSaveButton = $("confirm-save");
const rowTemplate = $("row-template");
const presetTemplate = $("preset-template");

const SHORTCUTS = 9;
// The search field appears once any list is this long.
const SEARCH_THRESHOLD = 8;
// Firefox caps a panel at 600px; past that the whole panel would scroll and
// the buttons would leave the screen. The lists share what is left instead.
const PANEL_MAX_HEIGHT = 600;
// No list is squeezed below this while it has content to show (about two rows).
const LIST_MIN_HEIGHT = 58;

const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
const parsed = parseUrl(tab.url);
const site = siteOf(tab.url);

// Every segment of the query (and of the fragment, if it has parameters), in
// order. Empty segments (`a=1&&b=2`) are kept so they survive an edit, but
// they are not shown.
const toRows = (params) => params.map((param) => ({ source: param, key: param.key, value: param.value }));
const rows = toRows(parsed.params);
const fragmentRows = parsed.hashParams === null ? null : toRows(parsed.hashParams);
const elements = new Map(); // row -> its element

// Saved presets: this site's, and those for every site.
const presetsBySite = { [site]: [], [ALL_SITES]: [] };
let entries = []; // { preset, scope }, in the order shown
let saving = false;
let filter = "";

const isVisible = (row) => row.source === null || row.source.raw !== "";
const editedUrl = () => buildUrl(parsed, rows, fragmentRows ?? undefined);
const rowLists = () => (fragmentRows === null ? [rows] : [rows, fragmentRows]);
const wantsNewTab = (event) => event.ctrlKey || event.metaKey;
const pickerOf = (row) => elements.get(row)?.querySelector(".pick");

const describeParams = (params) =>
  params.map(({ key, value }) => (value === "" ? key : `${key}=${value}`)).join("  ");

// ---- Status line -----------------------------------------------------------

let statusTimer;

function showStatus(message, { error = false } = {}) {
  clearTimeout(statusTimer);
  statusEl.textContent = message;
  statusEl.classList.toggle("error", error);
  statusEl.hidden = false;
  fitLists();
  if (!error) {
    statusTimer = setTimeout(() => {
      statusEl.hidden = true;
      fitLists();
    }, 2500);
  }
}

const errorText = (error) => error?.message ?? String(error);

function storageErrorMessage(error) {
  return /quota/i.test(errorText(error)) ? t("quotaFull") : t("saveFailed", errorText(error));
}

// ---- Layout ----------------------------------------------------------------

/**
 * Splits the height left under PANEL_MAX_HEIGHT between the three lists: a
 * short list gets all it needs, and the long ones share the rest equally and
 * scroll inside.
 */
function fitLists() {
  const lists = [rowsEl, fragmentRowsEl, presetListEl];
  const listsHeight = lists.reduce((sum, list) => sum + list.offsetHeight, 0);
  let remaining = PANEL_MAX_HEIGHT - (document.body.offsetHeight - listsHeight);

  const wanted = lists
    .map((list) => ({ list, height: list.offsetParent === null ? 0 : list.scrollHeight }))
    .sort((a, b) => a.height - b.height);
  wanted.forEach(({ list, height }, index) => {
    const share = remaining / (wanted.length - index);
    const given = Math.max(Math.min(height, share), Math.min(height, LIST_MIN_HEIGHT));
    list.style.maxHeight = `${Math.floor(given)}px`;
    remaining -= given;
  });
}

// ---- Search ----------------------------------------------------------------

const includesFilter = (text) => text.toLowerCase().includes(filter);
// Rows added in this panel always stay in view, so a new row never vanishes
// under an active search.
const rowMatches = (row) =>
  filter === "" || row.source === null || includesFilter(row.key) || includesFilter(row.value);
const presetMatches = (preset) =>
  filter === "" || includesFilter(preset.name) || includesFilter(describeParams(preset.params));

/** Shows only the rows and presets that match the search. */
function applyFilter() {
  for (const list of rowLists()) {
    for (const row of list) {
      const element = elements.get(row);
      if (element) element.hidden = !rowMatches(row);
    }
  }
  entries.forEach(({ preset }, index) => {
    presetListEl.children[index].hidden = !presetMatches(preset);
  });
  refresh();
}

function setFilter(text) {
  searchInput.value = text;
  filter = text.trim().toLowerCase();
  applyFilter();
}

searchInput.addEventListener("input", () => setFilter(searchInput.value));

// ---- Shared state ----------------------------------------------------------

const shownCount = (list) => list.filter((row) => !elements.get(row)?.hidden).length;
const countLabel = (shown, total) => (filter === "" ? String(total) : `${shown} / ${total}`);

function refresh() {
  const visible = rows.filter(isVisible);
  const shownRows = shownCount(visible);
  countEl.textContent = countLabel(shownRows, visible.length);
  emptyEl.hidden = visible.length > 0;

  let shownFragment = 0;
  if (fragmentRows !== null) {
    const visibleFragment = fragmentRows.filter(isVisible);
    shownFragment = shownCount(visibleFragment);
    fragmentCountEl.textContent = countLabel(shownFragment, visibleFragment.length);
    fragmentEl.hidden = filter !== "" && shownFragment === 0;
  }

  const shownPresets = entries.filter(({ preset }) => presetMatches(preset)).length;
  presetsEl.hidden = shownPresets === 0;
  noMatchesEl.hidden = filter === "" || shownRows + shownFragment + shownPresets > 0;

  const longest = Math.max(visible.length, fragmentRows?.filter(isVisible).length ?? 0, entries.length);
  searchBarEl.hidden = saving || (filter === "" && longest < SEARCH_THRESHOLD);

  applyButton.disabled = editedUrl() === tab.url;
  savePresetButton.disabled = !visible.some((row) => row.key !== "");

  const tracking = rowLists().flat().filter((row) => isVisible(row) && isTrackingKey(row.key)).length;
  removeTrackingButton.hidden = tracking === 0;
  removeTrackingButton.textContent = t("removeTracking", tracking);

  entries.forEach((entry, index) => {
    presetListEl.children[index]?.classList.toggle("active", containsParams(rows, entry.preset.params));
  });
  fitLists();
}

async function open(url, { newTab = false } = {}) {
  if (newTab) await browser.tabs.create({ url, index: tab.index + 1, openerTabId: tab.id });
  else if (url !== tab.url) await browser.tabs.update(tab.id, { url });
  window.close();
}

// ---- Parameter rows --------------------------------------------------------

function removeRow(row, list) {
  list.splice(list.indexOf(row), 1);
  elements.get(row).remove();
  elements.delete(row);
}

/** Adds a row's inputs to `container`, before `before` or at the end. */
function showRow(row, list, container, before = null) {
  const element = rowTemplate.content.firstElementChild.cloneNode(true);
  const keyInput = element.querySelector(".key");
  const valueInput = element.querySelector(".value");
  const picker = element.querySelector(".pick");
  elements.set(row, element);

  const showTracking = () => {
    const tracking = isTrackingKey(row.key);
    keyInput.classList.toggle("tracking", tracking);
    keyInput.title = tracking ? t("trackingParameter") : row.key;
  };
  const show = () => {
    keyInput.value = row.key;
    valueInput.value = row.value;
    valueInput.title = row.value;
    showTracking();
  };
  show();
  picker.checked = true;
  element.hidden = !rowMatches(row);

  keyInput.addEventListener("input", () => {
    row.key = keyInput.value;
    showTracking();
    refresh();
    updateSaveButton();
  });
  valueInput.addEventListener("input", () => {
    row.value = valueInput.value;
    valueInput.title = row.value;
    refresh();
  });

  // Pasting `a=1&b=2`, a whole URL, or key=value lines into a key fills this
  // row with the first parameter and adds the rest below it.
  keyInput.addEventListener("paste", (event) => {
    const pasted = paramsFromText(event.clipboardData.getData("text/plain"));
    if (pasted === null) return;
    event.preventDefault();
    const [first, ...rest] = pasted;
    row.key = first.key;
    row.value = first.value;
    show();
    const added = rest.map(({ key, value }) => ({ source: null, key, value }));
    list.splice(list.indexOf(row) + 1, 0, ...added);
    let after = element;
    for (const addedRow of added) after = showRow(addedRow, list, container, after.nextElementSibling);
    refresh();
    updateSaveButton();
  });

  for (const input of [keyInput, valueInput]) {
    input.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" || saving) return;
      if (wantsNewTab(event) || !applyButton.disabled) open(editedUrl(), { newTab: wantsNewTab(event) });
    });
  }
  picker.addEventListener("change", updateSaveButton);
  element.querySelector(".remove").addEventListener("click", () => {
    removeRow(row, list);
    refresh();
    updateSaveButton();
  });

  container.insertBefore(element, before);
  return element;
}

addButton.addEventListener("click", () => {
  const row = { source: null, key: "", value: "" };
  rows.push(row);
  showRow(row, rows, rowsEl).querySelector(".key").focus();
  refresh();
  rowsEl.scrollTop = rowsEl.scrollHeight;
});

removeTrackingButton.addEventListener("click", () => {
  for (const list of rowLists()) {
    for (const row of list.filter((row) => isVisible(row) && isTrackingKey(row.key))) {
      removeRow(row, list);
    }
  }
  refresh();
});

copyButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(editedUrl());
  copyButton.textContent = t("copied");
  setTimeout(() => (copyButton.textContent = t("copyUrl")), 1200);
});

applyButton.addEventListener("click", (event) => open(editedUrl(), { newTab: wantsNewTab(event) }));

settingsButton.addEventListener("click", async () => {
  await browser.runtime.openOptionsPage();
  window.close();
});

// ---- Presets ---------------------------------------------------------------

function applyPreset(preset, options) {
  open(buildUrl(parsed, mergeParams(rows, preset.params), fragmentRows ?? undefined), options);
}

async function storePresets(scope, next) {
  try {
    await savePresets(scope, next);
  } catch (error) {
    showStatus(storageErrorMessage(error), { error: true });
    return false;
  }
  presetsBySite[scope] = next;
  renderPresets();
  return true;
}

function presetElement({ preset, scope }, index) {
  const element = presetTemplate.content.firstElementChild.cloneNode(true);
  const applyPresetButton = element.querySelector(".preset-apply");
  const deleteButton = element.querySelector(".delete");

  element.querySelector(".shortcut").textContent = index < SHORTCUTS ? String(index + 1) : "";
  element.querySelector(".preset-name").textContent = preset.name;
  element.querySelector(".params-summary").textContent = describeParams(preset.params);
  element.querySelector(".scope").hidden = scope !== ALL_SITES;
  element.hidden = !presetMatches(preset);
  // One parameter per line, so a long preset can be read in full on hover.
  applyPresetButton.title = [
    preset.name,
    ...preset.params.map(({ key, value }) => (value === "" ? key : `${key}=${value}`)),
  ].join("\n");
  applyPresetButton.addEventListener("click", (event) =>
    applyPreset(preset, { newTab: wantsNewTab(event) }),
  );

  // Deleting takes a second click on the same button, so a stray click on ×
  // cannot throw a preset away.
  const disarm = () => {
    deleteButton.classList.remove("confirm");
    deleteButton.textContent = "×";
  };
  deleteButton.addEventListener("click", async () => {
    if (!deleteButton.classList.contains("confirm")) {
      deleteButton.classList.add("confirm");
      deleteButton.textContent = t("confirmDelete");
      return;
    }
    const remaining = presetsBySite[scope].filter((existing) => existing !== preset);
    if (await storePresets(scope, remaining)) showStatus(t("deletedPreset", preset.name));
  });
  deleteButton.addEventListener("blur", disarm);
  element.addEventListener("mouseleave", disarm);

  return element;
}

function renderPresets() {
  entries = [
    ...(site === "" ? [] : presetsBySite[site].map((preset) => ({ preset, scope: site }))),
    ...presetsBySite[ALL_SITES].map((preset) => ({ preset, scope: ALL_SITES })),
  ];
  presetListEl.replaceChildren(...entries.map(presetElement));
  refresh();
}

// Number keys apply presets and "/" jumps to the search, but never while the
// user is typing.
document.addEventListener("keydown", (event) => {
  if (saving || event.target.closest?.("input, textarea")) return;
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (event.key === "/" && !searchBarEl.hidden) {
    event.preventDefault();
    searchInput.focus();
    return;
  }
  if (!/^[1-9]$/.test(event.key)) return;
  const entry = entries[Number(event.key) - 1];
  if (entry) {
    event.preventDefault();
    applyPreset(entry.preset);
  }
});

// ---- Saving a preset -------------------------------------------------------

const pickedParams = () =>
  rows
    .filter((row) => pickerOf(row)?.checked && row.key !== "")
    .map(({ key, value }) => ({ key, value }));

function updateSaveButton() {
  confirmSaveButton.disabled = presetNameInput.value.trim() === "" || pickedParams().length === 0;
}

function setSaving(on) {
  // Every row has to be in view to be picked, so saving clears the search.
  if (on && filter !== "") setFilter("");
  saving = on;
  document.body.classList.toggle("saving", on);
  footerEl.hidden = on;
  saveForm.hidden = !on;
  if (on) {
    for (const row of rows) if (pickerOf(row)) pickerOf(row).checked = true;
    presetNameInput.value = "";
    allSitesInput.checked = site === "";
    allSitesInput.disabled = site === "";
    updateSaveButton();
    presetNameInput.focus();
  }
  refresh();
}

savePresetButton.addEventListener("click", () => setSaving(true));
cancelSaveButton.addEventListener("click", () => setSaving(false));
presetNameInput.addEventListener("input", updateSaveButton);

saveForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = presetNameInput.value.trim();
  const params = pickedParams();
  if (name === "" || params.length === 0) return;

  const scope = allSitesInput.checked ? ALL_SITES : site;
  const current = presetsBySite[scope];
  const next = upsertPreset(current, { name, params });
  if (await storePresets(scope, next)) {
    setSaving(false);
    showStatus(t(next.length === current.length ? "updatedPreset" : "savedPreset", name));
  }
});

// ---- Start -----------------------------------------------------------------

for (const row of rows) if (isVisible(row)) showRow(row, rows, rowsEl);
if (fragmentRows !== null) {
  fragmentEl.hidden = false;
  fragmentPrefixEl.textContent = parsed.hashPrefix;
  fragmentPrefixEl.title = parsed.hashPrefix;
  for (const row of fragmentRows) if (isVisible(row)) showRow(row, fragmentRows, fragmentRowsEl);
}

siteEl.textContent = site;
siteEl.title = site;
try {
  const [own, everywhere] = await Promise.all([
    site === "" ? [] : loadPresets(site),
    loadPresets(ALL_SITES),
  ]);
  presetsBySite[site] = own;
  presetsBySite[ALL_SITES] = everywhere;
} catch (error) {
  showStatus(t("loadFailed", errorText(error)), { error: true });
}
renderPresets();
