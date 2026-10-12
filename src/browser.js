// Firefox names the extension API `browser`, Chromium browsers name it
// `chrome`. Both return promises in Manifest V3, so the rest of the code uses
// `browser` and this makes it exist everywhere. Import it before anything else.
globalThis.browser ??= globalThis.chrome;
