# Paramlet

A Firefox extension for reading and editing the query parameters of the page
you are on. It works in Firefox and in browsers built on it, like
[Zen](https://zen-browser.app).

[![CI](https://github.com/Arifdamar/paramlet/actions/workflows/ci.yml/badge.svg)](https://github.com/Arifdamar/paramlet/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Arifdamar/paramlet)](https://github.com/Arifdamar/paramlet/releases/latest)
[![License: MIT](https://img.shields.io/badge/license-MIT-5b5bd6)](LICENSE)

![Paramlet demo](docs/demo.gif)

There is also a [47 second video](docs/paramlet-demo.mp4) with every feature.

## Why

Things I use it for:

- Cleaning `utm_source`, `gclid` and `fbclid` out of a link before I send it
  to someone.
- Turning `debug=1` on and off on `localhost` without editing the address by
  hand.
- Reading a 300 character report URL as a list instead of one long line.
- Changing `page=3` in an app that keeps its parameters after the `#`.

## What it does

A button in the address bar shows how many parameters the page has. It shows
`?` when there are none. Clicking it (or pressing <kbd>Alt</kbd>+<kbd>Q</kbd>,
<kbd>Ctrl</kbd>+<kbd>Q</kbd> on macOS) opens a panel with one row per
parameter.

In the panel you can:

- edit any key or value, delete a row, or add a new one, then press **Apply**
  or <kbd>Enter</kbd> to load the new URL (hold <kbd>Ctrl</kbd> or
  <kbd>⌘</kbd> to open it in a new tab instead);
- copy the edited URL without loading it;
- paste a full URL, a query string like `?a=1&b=2`, or `key=value` lines into a
  key field, and every parameter in it becomes its own row;
- remove all known tracking parameters with **Remove tracking**. They are
  greyed out in the list so you can see which ones they are. The list lives in
  [`src/tracking.js`](src/tracking.js);
- search, once a list has 8 items or more. Press <kbd>/</kbd> to get to the
  search box.

Values are shown decoded, so `hello%20world` appears as `hello world`. When the
URL is built again, only the parameters you changed are encoded. Everything
else is copied over as it was, so `%20` does not turn into `+`, a bare `?debug`
does not become `debug=`, and repeated keys like `tag=a&tag=b` are kept. Some
servers care about the difference.

### Presets

A preset is a named set of parameters, for example `debug=1&log=verbose` for
your dev server. Click **Save preset**, untick the parameters you don't want,
and give it a name. Tick **All sites** if it should show up everywhere.

On a later visit, click the preset or press its number (<kbd>1</kbd> to
<kbd>9</kbd>) to apply it. Keys the page already has get the preset's value,
missing keys are added, and nothing else changes. A ✓ next to a preset means
the page already has all of its values. Drag a preset by its handle to change
the order, or use <kbd>Alt</kbd>+<kbd>↑</kbd> and <kbd>Alt</kbd>+<kbd>↓</kbd>.

`www.example.com` and `example.com` share presets. Subdomains and ports do
not, so `localhost:3000` and `localhost:5173` each keep their own.

Presets are saved in Firefox sync storage. If you are signed in to a Mozilla
account with add-on sync turned on, they show up on your other computers too.

### Settings page

The gear button in the panel opens it. It lists the presets of every site, lets
you search, reorder and delete them, and can export everything to a JSON file
and import it again. Importing a preset with the same name as an existing one
on the same site replaces it. The keyboard shortcut can be changed there as
well.

The extension is in English and Turkish.

## Install

It is not on addons.mozilla.org yet. Until it is:

1. Download the zip from the
   [latest release](https://github.com/Arifdamar/paramlet/releases/latest).
2. Open `about:debugging#/runtime/this-firefox`.
3. Click **Load Temporary Add-on** and pick the zip.

Firefox removes temporary add-ons when it restarts.

## Privacy

Paramlet does not make network requests and does not collect anything. It asks
for two permissions: `tabs` to read the current URL and load the edited one,
and `storage` to keep your presets.

## Development

You need Node.js 22 or newer.

```sh
npm install
npm test        # unit tests
npm run lint    # web-ext lint
npm start       # opens Firefox with the extension loaded
npm run build   # writes a zip to web-ext-artifacts/
```

To run it in Zen on macOS:

```sh
npm start -- --firefox="/Applications/Zen Browser.app/Contents/MacOS/zen"
```

Where things are:

- `src/query.js` splits a URL into parameters and puts it back together.
- `src/presets.js` has site matching, preset storage, ordering, export and
  import.
- `src/tracking.js` is the list of tracking parameters.
- `src/sortable.js` is the drag to reorder code.
- `src/popup/` is the panel, `src/options/` the settings page.
- `_locales/` has the translations.

To add a language, copy `_locales/en/messages.json` into a new folder named
after the language code and translate the `message` values. `npm test` fails
if a key is missing. Pushing a tag like `v1.2.0` builds the zip and creates a
GitHub release.

## License

[MIT](LICENSE)
