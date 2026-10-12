// Shows the address bar button on pages that have query parameters, with the
// number of parameters drawn into the icon.

import { countParams } from "./query.js";

const ICON_SIZES = [16, 32];
const COLOR = "#5b5bd6";
const iconCache = new Map();

function iconFor(count) {
  const label = count > 99 ? "99+" : String(count);
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

async function refresh(tabId, url) {
  const count = isWebPage(url) ? countParams(url) : 0;
  if (count === 0) {
    await browser.pageAction.hide(tabId);
    return;
  }
  await browser.pageAction.setIcon({ tabId, imageData: iconFor(count) });
  await browser.pageAction.setTitle({
    tabId,
    title: count === 1 ? "1 query parameter" : `${count} query parameters`,
  });
  await browser.pageAction.show(tabId);
}

browser.tabs.onUpdated.addListener(
  (tabId, changeInfo, tab) => refresh(tabId, tab.url).catch(console.error),
  { properties: ["url", "status"] },
);

browser.tabs.query({}).then((tabs) => {
  for (const tab of tabs) refresh(tab.id, tab.url).catch(console.error);
});
