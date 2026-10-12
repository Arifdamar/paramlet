<div align="center">

# Paramlet

**Query parameters, without squinting at the URL.**

See, edit, clean and save a page's query parameters from the address bar.
For Firefox and Firefox-based browsers like [Zen](https://zen-browser.app).

[![CI](https://github.com/Arifdamar/paramlet/actions/workflows/ci.yml/badge.svg)](https://github.com/Arifdamar/paramlet/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Arifdamar/paramlet)](https://github.com/Arifdamar/paramlet/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-5b5bd6)](LICENSE)

![Paramlet demo](docs/demo.gif)

[Watch the full video (47 s)](docs/paramlet-demo.mp4)

</div>

## What it is for

- **Share clean links.** A link from a newsletter or an ad comes with
  `utm_source`, `gclid`, `fbclid` and friends. **Remove tracking** strips them
  in one click and keeps the parameters the page actually needs.
- **Flip flags while you build.** Turn `debug=1&log=verbose` on and off on
  `localhost:5173`, try another `lang`, `theme` or `variant`, without editing a
  200-character URL by hand. Save the combination as a preset and apply it with
  a single key.
- **Read what a URL is doing.** Long report links, search pages and redirects
  become a readable list, with values decoded (`hello%20world` reads as
  `hello world`) and a search field when the list gets long.
- **Work with single-page apps.** Parameters after `#` (`#/orders?page=3`,
  `#access_token=…`) get their own section and can be edited like the rest.

## Features

| | |
|---|---|
| **Address bar button** | On every web page, showing how many parameters it has (or `?` for none). |
| **Edit** | Change, add and remove parameters. **Apply** loads the result; hold <kbd>Ctrl</kbd>/<kbd>⌘</kbd> to open it in a new tab. **Copy URL** copies it. |
| **Paste** | Paste a whole URL, `?a=1&b=2`, or `key=value` lines into a key field to add them all at once. |
| **Remove tracking** | Known tracking parameters are shown dimmed and removed in one click. The list is in [`src/tracking.js`](src/tracking.js). |
| **Presets** | Save parameters for the current site or for every site. Apply with a click or <kbd>1</kbd>–<kbd>9</kbd>, reorder by dragging. A ✓ marks presets already on the page. |
| **Search** | Appears once a list has 8 or more items. Filters parameters by key or value and presets by name or contents. |
| **Settings page** | Every site's presets in one place: search, reorder, delete, export to a file and import back. |
| **Languages** | English and Turkish. |

### Your URL stays your URL

Most tools rebuild the whole query string when you change one thing: `%20`
turns into `+`, `?debug` turns into `debug=`, characters get re-encoded, and
some servers notice. Paramlet only rewrites the parameters you actually
changed. Everything else goes back exactly as it was written, including
repeated keys (`tag=a&tag=b`) and empty segments.

## Keyboard

| Key | Does |
|---|---|
| <kbd>Alt</kbd>+<kbd>Q</kbd> (<kbd>Ctrl</kbd>+<kbd>Q</kbd> on macOS) | Open the panel. Change it on the settings page. |
| <kbd>Enter</kbd> | Apply. With <kbd>Ctrl</kbd>/<kbd>⌘</kbd>: open in a new tab. |
| <kbd>1</kbd>–<kbd>9</kbd> | Apply that preset (not while typing in a field). |
| <kbd>/</kbd> | Jump to search. |
| <kbd>Alt</kbd>+<kbd>↑</kbd> / <kbd>Alt</kbd>+<kbd>↓</kbd> | Move the focused preset up or down. |

## Install

Paramlet is not on addons.mozilla.org yet. Until then:

1. Download `paramlet-<version>.zip` from the
   [latest release](https://github.com/Arifdamar/paramlet/releases/latest).
2. Open `about:debugging#/runtime/this-firefox` in Firefox or Zen.
3. Click **Load Temporary Add-on…** and pick the zip.

A temporary add-on is removed when the browser restarts.

## Privacy

Paramlet makes no network requests and collects no data. It asks for two
permissions:

- **tabs**, to read the current page's URL and load the edited one;
- **storage**, to keep your presets. They are stored in the browser's sync
  storage, so with add-on sync on in your Mozilla account they follow you to
  your other devices.

## Development

Needs Node.js 22 or newer.

```sh
npm install
npm test        # unit tests
npm run lint    # web-ext lint
npm start       # Firefox with the extension loaded
npm run build   # zip in web-ext-artifacts/
```

Running it in Zen on macOS:

```sh
npm start -- --firefox="/Applications/Zen Browser.app/Contents/MacOS/zen"
```

| Path | What it does |
|---|---|
| [`src/query.js`](src/query.js) | Splits a URL into parameters and puts it back together |
| [`src/presets.js`](src/presets.js) | Site matching, preset storage, ordering, export and import |
| [`src/tracking.js`](src/tracking.js) | Known tracking parameters |
| [`src/sortable.js`](src/sortable.js) | Drag-to-reorder |
| [`src/popup/`](src/popup), [`src/options/`](src/options) | The panel and the settings page |
| [`_locales/`](_locales) | Translations |

To add a language, copy `_locales/en/messages.json` into a folder named after
the language code and translate the `message` values; `npm test` checks that
no key is missing. Pushing a tag like `v1.2.0` builds the zip and publishes a
release.

## License

[MIT](LICENSE)
