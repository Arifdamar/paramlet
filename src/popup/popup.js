import { buildUrl, containsParams, mergeParams, paramsFromText, parseUrl } from "../query.js";
import { ALL_SITES, loadPresets, savePresets, siteOf, upsertPreset } from "../presets.js";
import { isTrackingKey } from "../tracking.js";
import { localize, t } from "../i18n.js";

localize();

const $ = (id) => document.getElementById(id);
const countEl = $("count");
const removeTrackingButton = $("remove-tracking");
const settingsButton = $("settings");
const emptyEl = $("empty");
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

const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
const parsed = parseUrl(tab.url);
const site = siteOf(tab.url);

// Every segment of the query (and of the fragment, if it has parameters), in
// order. Empty segments (`a=1&&b=2`) are kept so they survive an edit, but
// they are not shown.
const toRows = (params) => params.map((param) => ({ source: param, key: param.key, value: param.value }));
const rows = toRows(parsed.params);
const fragmentRows = parsed.hashParams === null ? null : toRows(parsed.hashParams);
const pickers = new Map(); // row -> its "include in preset" checkbox

// Saved presets: this site's, and those for every site.
const presetsBySite = { [site]: [], [ALL_SITES]: [] };
let entries = []; // { preset, scope }, in the order shown
let saving = false;

const isVisible = (row) => row.source === null || row.source.raw !== "";
const editedUrl = () => buildUrl(parsed, rows, fragmentRows ?? undefined);
const rowLists = () => (fragmentRows === null ? [rows] : [rows, fragmentRows]);
const wantsNewTab = (event) => event.ctrlKey || event.metaKey;

// ---- Status line -----------------------------------------------------------

let statusTimer;

function showStatus(message, { error = false } = {}) {
  clearTimeout(statusTimer);
  statusEl.textContent = message;
  statusEl.classList.toggle("error", error);
  statusEl.hidden = false;
  if (!error) statusTimer = setTimeout(() => (statusEl.hidden = true), 2500);
}

const errorText = (error) => error?.message ?? String(error);

function storageErrorMessage(error) {
  return /quota/i.test(errorText(error)) ? t("quotaFull") : t("saveFailed", errorText(error));
}

// ---- Shared state ----------------------------------------------------------

function refresh() {
  const visible = rows.filter(isVisible);
  countEl.textContent = String(visible.length);
  emptyEl.hidden = visible.length > 0;
  if (fragmentRows !== null) fragmentCountEl.textContent = String(fragmentRows.filter(isVisible).length);

  applyButton.disabled = editedUrl() === tab.url;
  savePresetButton.disabled = !visible.some((row) => row.key !== "");

  const tracking = rowLists().flat().filter((row) => isVisible(row) && isTrackingKey(row.key)).length;
  removeTrackingButton.hidden = tracking === 0;
  removeTrackingButton.textContent = t("removeTracking", tracking);

  entries.forEach((entry, index) => {
    presetListEl.children[index]?.classList.toggle("active", containsParams(rows, entry.preset.params));
  });
}

async function open(url, { newTab = false } = {}) {
  if (newTab) await browser.tabs.create({ url, index: tab.index + 1, openerTabId: tab.id });
  else if (url !== tab.url) await browser.tabs.update(tab.id, { url });
  window.close();
}

// ---- Parameter rows --------------------------------------------------------

function removeRow(row, list) {
  list.splice(list.indexOf(row), 1);
  pickers.delete(row);
  document.querySelector(`[data-row="${row.id}"]`).remove();
}

let nextRowId = 0;

/** Adds a row's inputs to `container`, before `before` or at the end. */
function showRow(row, list, container, before = null) {
  row.id ??= nextRowId++;
  const element = rowTemplate.content.firstElementChild.cloneNode(true);
  const keyInput = element.querySelector(".key");
  const valueInput = element.querySelector(".value");
  const picker = element.querySelector(".pick");
  element.dataset.row = String(row.id);

  const show = () => {
    keyInput.value = row.key;
    valueInput.value = row.value;
    valueInput.title = row.value;
    showTracking();
  };
  const showTracking = () => {
    const tracking = isTrackingKey(row.key);
    keyInput.classList.toggle("tracking", tracking);
    keyInput.title = tracking ? t("trackingParameter") : "";
  };
  show();
  picker.checked = true;
  if (list === rows) pickers.set(row, picker);

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
  rowsEl.scrollTop = rowsEl.scrollHeight;
  refresh();
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

const describeParams = (params) =>
  params.map(({ key, value }) => (value === "" ? key : `${key}=${value}`)).join("  ");

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
  const summary = describeParams(preset.params);

  element.querySelector(".shortcut").textContent = index < SHORTCUTS ? String(index + 1) : "";
  element.querySelector(".preset-name").textContent = preset.name;
  element.querySelector(".params-summary").textContent = summary;
  element.querySelector(".scope").hidden = scope !== ALL_SITES;
  applyPresetButton.title = `${preset.name}: ${summary}`;
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
  presetsEl.hidden = entries.length === 0;
  presetListEl.replaceChildren(...entries.map(presetElement));
  refresh();
}

// Number keys apply presets, but never while the user is typing.
document.addEventListener("keydown", (event) => {
  if (saving || event.target.closest?.("input, textarea")) return;
  if (event.altKey || event.ctrlKey || event.metaKey) return;
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
    .filter((row) => pickers.get(row)?.checked && row.key !== "")
    .map(({ key, value }) => ({ key, value }));

function updateSaveButton() {
  confirmSaveButton.disabled = presetNameInput.value.trim() === "" || pickedParams().length === 0;
}

function setSaving(on) {
  saving = on;
  document.body.classList.toggle("saving", on);
  footerEl.hidden = on;
  saveForm.hidden = !on;
  if (on) {
    for (const picker of pickers.values()) picker.checked = true;
    presetNameInput.value = "";
    allSitesInput.checked = site === "";
    allSitesInput.disabled = site === "";
    updateSaveButton();
    presetNameInput.focus();
  }
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
  for (const row of fragmentRows) if (isVisible(row)) showRow(row, fragmentRows, fragmentRowsEl);
}

siteEl.textContent = site;
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
