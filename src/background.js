// Keeps the address bar button's icon in step with the page: the number of
// query parameters, or "?" when there are none. The manifest's show_matches
// makes the button appear on every web page; this script only draws it.

import { countParams } from "./query.js";
import { t } from "./i18n.js";

const ICON_SIZES = [16, 32];
const COLOR = "#5b5bd6";
const iconCache = new Map();

function iconFor(label) {
  if (iconCache.has(label)) return iconCache.get(label);

  const imageData = {};
  for (const size of ICON_SIZES) {
    const canvas = new OffscreenCanvas(size, size);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = COLOR;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, size / 4);
    ctx.fill();

    const fontSize = size * (label.length === 1 ? 0.7 : label.length === 2 ? 0.58 : 0.42);
    ctx.font = `700 ${fontSize}px system-ui, sans-serif`;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, size / 2, size / 2 + size * 0.04);
    imageData[size] = ctx.getImageData(0, 0, size, size);
  }
  iconCache.set(label, imageData);
  return imageData;
}

function isWebPage(url) {
  return url !== undefined && (url.startsWith("https://") || url.startsWith("http://"));
}

function describe(count) {
  if (count === 0) return t("titleNone");
  if (count === 1) return t("titleOne");
  return t("titleMany", count);
}

async function refresh(tabId, url) {
  if (!isWebPage(url)) return;
  const count = countParams(url);
  const label = count === 0 ? "?" : count > 99 ? "99+" : String(count);
  await Promise.all([
    browser.pageAction.setIcon({ tabId, imageData: iconFor(label) }),
    browser.pageAction.setTitle({ tabId, title: describe(count) }),
  ]);
}

async function refreshAll() {
  const tabs = await browser.tabs.query({});
  await Promise.all(tabs.map((tab) => refresh(tab.id, tab.url)));
}

browser.tabs.onUpdated.addListener(
  (tabId, changeInfo, tab) => refresh(tabId, tab.url).catch(console.error),
  { properties: ["url", "status"] },
);
browser.runtime.onInstalled.addListener(() => refreshAll().catch(console.error));
browser.runtime.onStartup.addListener(() => refreshAll().catch(console.error));
