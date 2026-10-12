# Paramlet

See, edit and save a page's query parameters from the address bar. Works in
Firefox and Firefox-based browsers like [Zen](https://zen-browser.app).

Paramlet adds a button to the address bar of every web page. It shows how many
query parameters the page has, or `?` when it has none. Click it, or press
<kbd>Ctrl</kbd>+<kbd>Q</kbd> on macOS and <kbd>Alt</kbd>+<kbd>Q</kbd>
elsewhere, to open the panel.

## Editing

- Change any key or value, remove a parameter with ×, or add one with
  **+ Add parameter**. Values are shown decoded, so `hello%20world` reads as
  `hello world`.
- **Apply** (or <kbd>Enter</kbd> in any field) loads the edited URL. Hold
  <kbd>Ctrl</kbd>, or <kbd>⌘</kbd> on macOS, to open it in a new tab instead.
- **Copy URL** copies the edited URL.
- Paste a whole URL, a query string like `?a=1&b=2`, or one `key=value` per
  line into a key field, and every parameter in it is added at once.

### Parameters after `#`

Single-page apps often keep parameters in the fragment: `#/route?tab=2`, or
`#access_token=…&state=…` after a sign-in. Paramlet lists those in their own
section, and edits them without touching the route in front of them. Plain
anchors like `#top` are left alone.

### Tracking parameters

`utm_*`, `gclid`, `fbclid`, `msclkid` and other known tracking parameters are
shown dimmed. **Remove tracking** takes them all out; press **Apply** to load
the clean URL. The list is in [`src/tracking.js`](src/tracking.js).

## Presets

A preset is a set of parameters you use often, like `debug=1&log=verbose` on
your dev server or `lang=tr` on a docs site.

- **Save preset** picks parameters from the current page. Untick the ones you
  don't want, give the preset a name, and save. Tick **All sites** to make it
  available everywhere; otherwise it belongs to the current site. Saving under
  an existing name replaces that preset.
- Click a preset, or press its number (<kbd>1</kbd>–<kbd>9</kbd>) while the
  panel is open, to apply it. Keys the page already has get the preset's value,
  missing keys are added, and every other parameter is left alone. Hold
  <kbd>Ctrl</kbd>/<kbd>⌘</kbd> while clicking to open the result in a new tab.
- A ✓ marks presets whose values are all on the page already.
- To delete a preset, hover it, click ×, then click again to confirm.

Presets belong to a site: `www.example.com` and `example.com` share them, while
subdomains and ports are kept apart, so `localhost:3000` and `localhost:5173`
each have their own.

Presets are kept in the browser's sync storage. If you are signed in to a
Mozilla account with add-on sync turned on, they follow you to your other
devices; otherwise they stay on this one.

## Settings

The ⚙ button in the panel opens the settings page, where you can:

- see the presets of every site and delete them,
- **Export** every preset to a JSON file and **Import** it on another browser
  (presets with the same name on the same site are replaced),
- see and change the keyboard shortcut.

## Your URL stays your URL

Most tools rebuild the whole query string when you change one thing, and the
URL quietly changes in ways you did not ask for: `%20` turns into `+`, `?debug`
turns into `debug=`, characters get re-encoded. Some servers care about that.

Paramlet only rewrites the parameters you actually changed, by hand, through a
preset or with **Remove tracking**. Everything else goes back exactly as it was
written, including repeated keys (`tag=a&tag=b`) and empty segments.

## Install

Paramlet is not on addons.mozilla.org yet. To try it:

1. Download the latest zip from [Releases](../../releases), or build one with
   `npm run build`.
2. Open `about:debugging#/runtime/this-firefox` in Firefox or Zen.
3. Click **Load Temporary Add-on…** and pick the zip (or `manifest.json` in a
   clone of this repository).

A temporary add-on is removed when the browser restarts.

## Permissions

- **tabs**: to read the current page's URL for the address bar count, and to
  load the edited URL.
- **storage**: to keep your presets.

Paramlet makes no network requests and collects no data.

## Development

Needs Node.js 22 or newer.

```sh
npm install
npm test        # unit tests
npm run lint    # web-ext lint
npm start       # opens Firefox with the extension loaded
npm run build   # zip for addons.mozilla.org, in web-ext-artifacts/
```

To run it in Zen on macOS:

```sh
npm start -- --firefox="/Applications/Zen Browser.app/Contents/MacOS/zen"
```

| Path | What it does |
|---|---|
| [`src/query.js`](src/query.js) | Splits a URL into parameters and puts it back together |
| [`src/presets.js`](src/presets.js) | Site matching, preset storage, export and import |
| [`src/tracking.js`](src/tracking.js) | Known tracking parameters |
| [`src/i18n.js`](src/i18n.js), [`_locales/`](_locales) | Translations |
| [`src/background.js`](src/background.js) | Draws the address bar button |
| [`src/popup/`](src/popup) | The panel |
| [`src/options/`](src/options) | The settings page |

Pushing a tag like `v1.0.0` runs the tests and attaches a built zip to a GitHub
release.

### Translations

Strings live in `_locales/<language>/messages.json`. To add a language, copy
`_locales/en/messages.json` to a new folder named after the language code and
translate the `message` values.

## License

[MIT](LICENSE)
