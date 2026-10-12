import { buildUrl, parseUrl } from "../query.js";

const rowsEl = document.getElementById("rows");
const countEl = document.getElementById("count");
const emptyEl = document.getElementById("empty");
const addButton = document.getElementById("add");
const copyButton = document.getElementById("copy");
const applyButton = document.getElementById("apply");
const rowTemplate = document.getElementById("row");

const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
const parsed = parseUrl(tab.url);
// Every segment of the query, in order. Empty segments (`a=1&&b=2`) are kept
// here so they survive an edit, but they are not shown.
const rows = parsed.params.map((param) => ({ source: param, key: param.key, value: param.value }));

const isVisible = (row) => row.source === null || row.source.raw !== "";
const editedUrl = () => buildUrl(parsed, rows);

function refresh() {
  const visible = rows.filter(isVisible).length;
  countEl.textContent = String(visible);
  emptyEl.hidden = visible > 0;
  applyButton.disabled = editedUrl() === tab.url;
}

async function apply() {
  if (applyButton.disabled) return;
  await browser.tabs.update(tab.id, { url: editedUrl() });
  window.close();
}

function showRow(row) {
  const element = rowTemplate.content.firstElementChild.cloneNode(true);
  const keyInput = element.querySelector(".key");
  const valueInput = element.querySelector(".value");

  keyInput.value = row.key;
  valueInput.value = row.value;
  valueInput.title = row.value;

  keyInput.addEventListener("input", () => {
    row.key = keyInput.value;
    refresh();
  });
  valueInput.addEventListener("input", () => {
    row.value = valueInput.value;
    valueInput.title = row.value;
    refresh();
  });
  for (const input of [keyInput, valueInput]) {
    input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") apply();
    });
  }
  element.querySelector(".remove").addEventListener("click", () => {
    rows.splice(rows.indexOf(row), 1);
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

applyButton.addEventListener("click", apply);

for (const row of rows) if (isVisible(row)) showRow(row);
refresh();
