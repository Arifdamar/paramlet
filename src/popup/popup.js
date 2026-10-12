import { buildUrl, containsParams, mergeParams, parseUrl } from "../query.js";
import { loadPresets, savePresets, siteOf, upsertPreset } from "../presets.js";

const $ = (id) => document.getElementById(id);
const rowsEl = $("rows");
const countEl = $("count");
const emptyEl = $("empty");
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
const cancelSaveButton = $("cancel-save");
const confirmSaveButton = $("confirm-save");
const rowTemplate = $("row-template");
const presetTemplate = $("preset-template");

const SHORTCUTS = 9;

const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
const parsed = parseUrl(tab.url);
const site = siteOf(tab.url);

// Every segment of the query, in order. Empty segments (`a=1&&b=2`) are kept
// here so they survive an edit, but they are not shown.
const rows = parsed.params.map((param) => ({ source: param, key: param.key, value: param.value }));
const pickers = new Map(); // row -> its "include in preset" checkbox
let presets = [];
let saving = false;

const isVisible = (row) => row.source === null || row.source.raw !== "";
const editedUrl = () => buildUrl(parsed, rows);

// ---- Status line -----------------------------------------------------------

let statusTimer;

function showStatus(message, { error = false } = {}) {
  clearTimeout(statusTimer);
  statusEl.textContent = message;
  statusEl.classList.toggle("error", error);
  statusEl.hidden = false;
  if (!error) statusTimer = setTimeout(() => (statusEl.hidden = true), 2500);
}

function storageErrorMessage(error) {
  if (/quota/i.test(error?.message)) {
    return "Not enough sync storage left for this site. Delete a preset and try again.";
  }
  return `Could not save: ${error?.message ?? error}`;
}

// ---- Shared state ----------------------------------------------------------

function refresh() {
  const visible = rows.filter(isVisible);
  countEl.textContent = String(visible.length);
  emptyEl.hidden = visible.length > 0;
  applyButton.disabled = editedUrl() === tab.url;
  savePresetButton.disabled = !visible.some((row) => row.key !== "");
  presets.forEach((preset, index) => {
    presetListEl.children[index]?.classList.toggle("active", containsParams(rows, preset.params));
  });
}

async function navigate(url) {
  if (url !== tab.url) await browser.tabs.update(tab.id, { url });
  window.close();
}

// ---- Parameter rows --------------------------------------------------------

function showRow(row) {
  const element = rowTemplate.content.firstElementChild.cloneNode(true);
  const keyInput = element.querySelector(".key");
  const valueInput = element.querySelector(".value");
  const picker = element.querySelector(".pick");

  keyInput.value = row.key;
  valueInput.value = row.value;
  valueInput.title = row.value;
  picker.checked = true;
  pickers.set(row, picker);

  keyInput.addEventListener("input", () => {
    row.key = keyInput.value;
    refresh();
    updateSaveButton();
  });
  valueInput.addEventListener("input", () => {
    row.value = valueInput.value;
    valueInput.title = row.value;
    refresh();
  });
  for (const input of [keyInput, valueInput]) {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !saving && !applyButton.disabled) navigate(editedUrl());
    });
  }
  picker.addEventListener("change", updateSaveButton);
  element.querySelector(".remove").addEventListener("click", () => {
    rows.splice(rows.indexOf(row), 1);
    pickers.delete(row);
    element.remove();
    refresh();
  });

  rowsEl.append(element);
  return keyInput;
}

addButton.addEventListener("click", () => {
  const row = { source: null, key: "", value: "" };
  rows.push(row);
  showRow(row).focus();
  rowsEl.scrollTop = rowsEl.scrollHeight;
  refresh();
});

copyButton.addEventListener("click", async () => {
  await navigator.clipboard.writeText(editedUrl());
  copyButton.textContent = "Copied";
  setTimeout(() => (copyButton.textContent = "Copy URL"), 1200);
});

applyButton.addEventListener("click", () => navigate(editedUrl()));

// ---- Presets ---------------------------------------------------------------

const describeParams = (params) =>
  params.map(({ key, value }) => (value === "" ? key : `${key}=${value}`)).join("  ");

function applyPreset(preset) {
  navigate(buildUrl(parsed, mergeParams(rows, preset.params)));
}

async function storePresets(next) {
  try {
    await savePresets(site, next);
  } catch (error) {
    showStatus(storageErrorMessage(error), { error: true });
    return false;
  }
  presets = next;
  renderPresets();
  return true;
}

function presetElement(preset, index) {
  const element = presetTemplate.content.firstElementChild.cloneNode(true);
  const applyPresetButton = element.querySelector(".preset-apply");
  const deleteButton = element.querySelector(".preset-delete");
  const summary = describeParams(preset.params);

  element.querySelector(".shortcut").textContent = index < SHORTCUTS ? String(index + 1) : "";
  element.querySelector(".preset-name").textContent = preset.name;
  element.querySelector(".preset-params").textContent = summary;
  applyPresetButton.title = `${preset.name}: ${summary}`;
  applyPresetButton.addEventListener("click", () => applyPreset(preset));

  // Deleting takes a second click on the same button, so a stray click on ×
  // cannot throw a preset away.
  const disarm = () => {
    deleteButton.classList.remove("confirm");
    deleteButton.textContent = "×";
  };
  deleteButton.addEventListener("click", async () => {
    if (!deleteButton.classList.contains("confirm")) {
      deleteButton.classList.add("confirm");
      deleteButton.textContent = "Delete?";
      return;
    }
    if (await storePresets(presets.filter((existing) => existing !== preset))) {
      showStatus(`Deleted “${preset.name}”.`);
    }
  });
  deleteButton.addEventListener("blur", disarm);
  element.addEventListener("mouseleave", disarm);

  return element;
}

function renderPresets() {
  presetsEl.hidden = presets.length === 0;
  presetListEl.replaceChildren(...presets.map(presetElement));
  refresh();
}

// Number keys apply presets, but never while the user is typing.
document.addEventListener("keydown", (event) => {
  if (saving || event.target.closest?.("input, textarea")) return;
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (!/^[1-9]$/.test(event.key)) return;
  const preset = presets[Number(event.key) - 1];
  if (preset) {
    event.preventDefault();
    applyPreset(preset);
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

  const next = upsertPreset(presets, { name, params });
  const replaced = next.length === presets.length;
  if (await storePresets(next)) {
    setSaving(false);
    showStatus(replaced ? `Updated “${name}”.` : `Saved “${name}”.`);
  }
});

// ---- Start -----------------------------------------------------------------

for (const row of rows) if (isVisible(row)) showRow(row);

if (site === "") {
  savePresetButton.hidden = true;
} else {
  siteEl.textContent = site;
  try {
    presets = await loadPresets(site);
  } catch (error) {
    showStatus(`Could not load saved presets: ${error?.message ?? error}`, { error: true });
  }
}
renderPresets();
