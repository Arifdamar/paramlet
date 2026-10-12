import {
  ALL_SITES,
  exportPresets,
  loadAllPresets,
  mergePresets,
  movePreset,
  readExport,
  savePresets,
  savePresetsBySite,
} from "../presets.js";
import { localize, t } from "../i18n.js";
import { makeSortable } from "../sortable.js";

localize();

const $ = (id) => document.getElementById(id);
const shortcutEl = $("shortcut");
const changeShortcutButton = $("change-shortcut");
const shortcutHelpEl = $("shortcut-help");
const exportButton = $("export");
const importButton = $("import");
const importFileInput = $("import-file");
const statusEl = $("status");
const searchInput = $("search");
const noPresetsEl = $("no-presets");
const noMatchesEl = $("no-matches");
const sitesEl = $("sites");
const siteTemplate = $("site-template");
const presetTemplate = $("preset-template");

const COMMAND = "_execute_page_action";
const errorText = (error) => error?.message ?? String(error);

let statusTimer;

function showStatus(message, { error = false } = {}) {
  clearTimeout(statusTimer);
  statusEl.textContent = message;
  statusEl.classList.toggle("error", error);
  statusEl.hidden = false;
  if (!error) statusTimer = setTimeout(() => (statusEl.hidden = true), 4000);
}

// ---- Keyboard shortcut -----------------------------------------------------

// Manifest notation to what the keyboard says: on macOS "MacCtrl+Q" is ⌃Q and
// "Ctrl" means ⌘.
function formatShortcut(shortcut) {
  if (!/Mac/.test(navigator.platform)) return shortcut.replace("MacCtrl", "Ctrl");
  const symbols = { MacCtrl: "⌃", Ctrl: "⌘", Command: "⌘", Alt: "⌥", Shift: "⇧" };
  return shortcut
    .split("+")
    .map((part) => symbols[part] ?? part)
    .join("");
}

async function showShortcut() {
  const commands = await browser.commands.getAll();
  const shortcut = commands.find((command) => command.name === COMMAND)?.shortcut;
  shortcutEl.textContent = shortcut ? formatShortcut(shortcut) : t("shortcutNone");
}

// Firefox 137+ can open its shortcut editor directly; older versions get directions.
if (typeof browser.commands.openShortcutSettings === "function") {
  changeShortcutButton.hidden = false;
  changeShortcutButton.addEventListener("click", () => browser.commands.openShortcutSettings());
} else {
  shortcutHelpEl.hidden = false;
}
window.addEventListener("focus", showShortcut);

// ---- Presets ---------------------------------------------------------------

const describeParams = (params) =>
  params.map(({ key, value }) => (value === "" ? key : `${key}=${value}`)).join("  ");

// "All sites" first, then sites in alphabetical order.
const siteOrder = (a, b) => (a === ALL_SITES ? -1 : b === ALL_SITES ? 1 : a.localeCompare(b));

function presetElement(site, preset, presets) {
  const element = presetTemplate.content.firstElementChild.cloneNode(true);
  const deleteButton = element.querySelector(".delete");
  element.querySelector(".preset-name").textContent = preset.name;
  element.querySelector(".params-summary").textContent = describeParams(preset.params);
  element.querySelector(".params-summary").title = describeParams(preset.params);

  const disarm = () => {
    deleteButton.classList.remove("confirm");
    deleteButton.textContent = t("deletePreset");
  };
  deleteButton.addEventListener("click", async () => {
    if (!deleteButton.classList.contains("confirm")) {
      deleteButton.classList.add("confirm");
      deleteButton.textContent = t("confirmDelete");
      return;
    }
    try {
      await savePresets(site, presets.filter((existing) => existing !== preset));
    } catch (error) {
      showStatus(t("saveFailed", errorText(error)), { error: true });
      return;
    }
    showStatus(t("deletedPreset", preset.name));
    await showPresets();
  });
  deleteButton.addEventListener("blur", disarm);
  element.addEventListener("mouseleave", disarm);
  return element;
}

let filter = "";
const includesFilter = (text) => text.toLowerCase().includes(filter);
const siteLabel = (site) => (site === ALL_SITES ? t("allSites") : site);

// A site whose name matches shows all its presets; otherwise only the presets
// whose name or parameters match are shown.
function matchingPresets(site, presets) {
  if (filter === "" || includesFilter(siteLabel(site))) return presets;
  return presets.filter(
    (preset) => includesFilter(preset.name) || includesFilter(describeParams(preset.params)),
  );
}

async function showPresets() {
  const bySite = await loadAllPresets();
  const sites = Object.keys(bySite).sort(siteOrder);
  noPresetsEl.hidden = sites.length > 0;
  searchInput.hidden = sites.length === 0;
  exportButton.disabled = sites.length === 0;

  const shown = sites
    .map((site) => ({ site, presets: matchingPresets(site, bySite[site]) }))
    .filter(({ presets }) => presets.length > 0);
  noMatchesEl.hidden = sites.length === 0 || shown.length > 0;
  sitesEl.replaceChildren(
    ...shown.map(({ site, presets }) => {
      const element = siteTemplate.content.firstElementChild.cloneNode(true);
      const list = element.querySelector(".preset-list");
      element.querySelector(".site-name").textContent = siteLabel(site);
      list.classList.toggle("filtered", filter !== "");
      list.append(...presets.map((preset) => presetElement(site, preset, bySite[site])));
      // The order sets the panel's 1–9 shortcuts. A filtered list is not reordered.
      makeSortable(list, {
        grip: ".grip",
        enabled: () => filter === "",
        onMove: (from, to) => movePresetOf(site, bySite[site], from, to),
      });
      list.dataset.site = site;
      return element;
    }),
  );
}

async function movePresetOf(site, presets, from, to) {
  const keyboard = sitesEl.contains(document.activeElement);
  try {
    await savePresets(site, movePreset(presets, from, to));
  } catch (error) {
    showStatus(t("saveFailed", errorText(error)), { error: true });
    return;
  }
  await showPresets();
  if (keyboard) {
    const list = [...sitesEl.querySelectorAll(".preset-list")].find((element) => element.dataset.site === site);
    list?.children[to]?.querySelector(".delete").focus();
  }
}

searchInput.addEventListener("input", () => {
  filter = searchInput.value.trim().toLowerCase();
  showPresets();
});

exportButton.addEventListener("click", async () => {
  const blob = new Blob([exportPresets(await loadAllPresets())], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "paramlet-presets.json";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});

importButton.addEventListener("click", () => importFileInput.click());

importFileInput.addEventListener("change", async () => {
  const [file] = importFileInput.files;
  importFileInput.value = "";
  if (!file) return;

  const imported = readExport(await file.text());
  if (imported === null) {
    showStatus(t("importInvalid"), { error: true });
    return;
  }
  const { merged, changedSites, count } = mergePresets(await loadAllPresets(), imported);
  try {
    // One write for every site, so a full storage rejects the whole import
    // instead of leaving half of it behind.
    await savePresetsBySite(Object.fromEntries(changedSites.map((site) => [site, merged[site]])));
  } catch (error) {
    showStatus(t("importFailed", errorText(error)), { error: true });
    return;
  }
  showStatus(t("imported", count));
  await showPresets();
});

// Presets saved from a panel while this page is open show up here too.
browser.storage.onChanged.addListener((changes, area) => {
  if (area === "sync") showPresets();
});

await Promise.all([showShortcut(), showPresets()]);
