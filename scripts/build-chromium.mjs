// Builds the Chromium package (Chrome, Edge, Opera, Brave) into
// dist/chromium/ and zips it into web-ext-artifacts/, next to the Firefox zip.
//
//   npm run build:chromium

import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { chromiumManifest } from "./chromium-manifest.mjs";

const root = new URL("..", import.meta.url).pathname;
const out = join(root, "dist", "chromium");
const firefox = JSON.parse(await readFile(join(root, "manifest.json"), "utf8"));
const zip = join(root, "web-ext-artifacts", `paramlet-${firefox.version}-chromium.zip`);

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const path of ["src", "_locales", "LICENSE"]) {
  await cp(join(root, path), join(out, path), { recursive: true });
}
await mkdir(join(out, "icons"));
for (const size of [16, 32, 48, 128]) {
  await cp(join(root, "icons", `paramlet-${size}.png`), join(out, "icons", `paramlet-${size}.png`));
}
await writeFile(join(out, "manifest.json"), `${JSON.stringify(chromiumManifest(firefox), null, 2)}\n`);

await mkdir(join(root, "web-ext-artifacts"), { recursive: true });
await rm(zip, { force: true });
execFileSync("zip", ["-q", "-r", "-X", zip, "."], { cwd: out });
console.log(`Chromium package: ${zip}`);
