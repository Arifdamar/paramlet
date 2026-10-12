import { buildUrl, containsParams, mergeParams, parseUrl } from "../query.js";
import { loadGroups, saveGroups, siteOf, upsertGroup } from "../groups.js";

const $ = (id) => document.getElementById(id);
const rowsEl = $("rows");
const countEl = $("count");
const emptyEl = $("empty");
const groupsEl = $("groups");
const siteEl = $("site");
const groupListEl = $("group-list");
const statusEl = $("status");
const footerEl = $("footer");
const addButton = $("add");
const saveGroupButton = $("save-group");
const copyButton = $("copy");
const applyButton = $("apply");
const saveForm = $("save-form");
const groupNameInput = $("group-name");
const cancelSaveButton = $("cancel-save");
const confirmSaveButton = $("confirm-save");
const rowTemplate = $("row-template");
const groupTemplate = $("group-template");

const SHORTCUTS = 9;

const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
const parsed = parseUrl(tab.url);
const site = siteOf(tab.url);

// Every segment of the query, in order. Empty segments (`a=1&&b=2`) are kept
// here so they survive an edit, but they are not shown.
const rows = parsed.params.map((param) => ({ source: param, key: param.key, value: param.value }));
const pickers = new Map(); // row -> its "include in group" checkbox
let groups = [];
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
    return "Not enough sync storage left for this site. Delete a group and try again.";
  }
  return `Could not save: ${error?.message ?? error}`;
}

// ---- Shared state ----------------------------------------------------------

function refresh() {
  const visible = rows.filter(isVisible);
  countEl.textContent = String(visible.length);
  emptyEl.hidden = visible.length > 0;
  applyButton.disabled = editedUrl() === tab.url;
  saveGroupButton.disabled = !visible.some((row) => row.key !== "");
  groups.forEach((group, index) => {
    groupListEl.children[index]?.classList.toggle("active", containsParams(rows, group.params));
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

// ---- Groups ----------------------------------------------------------------

const describeParams = (params) =>
  params.map(({ key, value }) => (value === "" ? key : `${key}=${value}`)).join("  ");

function applyGroup(group) {
  navigate(buildUrl(parsed, mergeParams(rows, group.params)));
}

async function storeGroups(next) {
  try {
    await saveGroups(site, next);
  } catch (error) {
    showStatus(storageErrorMessage(error), { error: true });
    return false;
  }
  groups = next;
  renderGroups();
  return true;
}

function groupElement(group, index) {
  const element = groupTemplate.content.firstElementChild.cloneNode(true);
  const applyGroupButton = element.querySelector(".group-apply");
  const deleteButton = element.querySelector(".group-delete");
  const summary = describeParams(group.params);

  element.querySelector(".shortcut").textContent = index < SHORTCUTS ? String(index + 1) : "";
  element.querySelector(".group-name").textContent = group.name;
  element.querySelector(".group-params").textContent = summary;
  applyGroupButton.title = `${group.name}: ${summary}`;
  applyGroupButton.addEventListener("click", () => applyGroup(group));

  // Deleting takes a second click on the same button, so a stray click on ×
  // cannot throw a group away.
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
    if (await storeGroups(groups.filter((existing) => existing !== group))) {
      showStatus(`Deleted “${group.name}”.`);
    }
  });
  deleteButton.addEventListener("blur", disarm);
  element.addEventListener("mouseleave", disarm);

  return element;
}

function renderGroups() {
  groupsEl.hidden = groups.length === 0;
  groupListEl.replaceChildren(...groups.map(groupElement));
  refresh();
}

// Number keys apply groups, but never while the user is typing.
document.addEventListener("keydown", (event) => {
  if (saving || event.target.closest?.("input, textarea")) return;
  if (event.altKey || event.ctrlKey || event.metaKey) return;
  if (!/^[1-9]$/.test(event.key)) return;
  const group = groups[Number(event.key) - 1];
  if (group) {
    event.preventDefault();
    applyGroup(group);
  }
});

// ---- Saving a group --------------------------------------------------------

const pickedParams = () =>
  rows
    .filter((row) => pickers.get(row)?.checked && row.key !== "")
    .map(({ key, value }) => ({ key, value }));

function updateSaveButton() {
  confirmSaveButton.disabled = groupNameInput.value.trim() === "" || pickedParams().length === 0;
}

function setSaving(on) {
  saving = on;
  document.body.classList.toggle("saving", on);
  footerEl.hidden = on;
  saveForm.hidden = !on;
  if (on) {
    for (const picker of pickers.values()) picker.checked = true;
    groupNameInput.value = "";
    updateSaveButton();
    groupNameInput.focus();
  }
}

saveGroupButton.addEventListener("click", () => setSaving(true));
cancelSaveButton.addEventListener("click", () => setSaving(false));
groupNameInput.addEventListener("input", updateSaveButton);

saveForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const name = groupNameInput.value.trim();
  const params = pickedParams();
  if (name === "" || params.length === 0) return;

  const next = upsertGroup(groups, { name, params });
  const replaced = next.length === groups.length;
  if (await storeGroups(next)) {
    setSaving(false);
    showStatus(replaced ? `Updated “${name}”.` : `Saved “${name}”.`);
  }
});

// ---- Start -----------------------------------------------------------------

for (const row of rows) if (isVisible(row)) showRow(row);

if (site === "") {
  saveGroupButton.hidden = true;
} else {
  siteEl.textContent = site;
  try {
    groups = await loadGroups(site);
  } catch (error) {
    showStatus(`Could not load saved groups: ${error?.message ?? error}`, { error: true });
  }
}
renderGroups();
