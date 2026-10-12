# Paramlet

See, edit and save a page's query parameters from the address bar. Works in
Firefox and Firefox-based browsers like [Zen](https://zen-browser.app).

Paramlet adds a button to the address bar of every web page. It shows how many
query parameters the page has, or `?` when it has none. Click it (or press
<kbd>Ctrl</kbd>+<kbd>Q</kbd> on macOS, <kbd>Alt</kbd>+<kbd>Q</kbd> elsewhere) to
open the panel:

- change any key or value, remove a parameter, or add a new one
- **Apply** (or <kbd>Enter</kbd>) loads the edited URL
- **Copy URL** copies it instead

Values are shown decoded, so `hello%20world` reads as `hello world`.

## Presets

A preset is a set of parameters you use often on a site, like `debug=1&log=verbose`
on your dev server or `lang=tr` on a docs site.

- **Save preset** picks parameters from the current page. Untick the ones you
  don't want, give the preset a name, and save. Saving under an existing name
  replaces that preset.
- Click a preset, or press its number (<kbd>1</kbd>–<kbd>9</kbd>) while the
  panel is open, to apply it. Keys the page already has get the preset's value,
  missing keys are added, and every other parameter is left alone.
- A ✓ marks presets whose values are all on the page already.
- To delete a preset, hover it, click ×, then click **Delete?** to confirm.

Presets belong to a site: `www.example.com` and `example.com` share them, while
subdomains and ports are kept apart, so `localhost:3000` and `localhost:5173`
each have their own.

Presets are kept in the browser's sync storage. If you are signed in to a
Mozilla account with add-on sync turned on, they follow you to your other
devices; otherwise they stay on this one.

## Your URL stays your URL

Most tools rebuild the whole query string when you change one thing, and the
URL quietly changes in ways you did not ask for: `%20` turns into `+`, `?debug`
turns into `debug=`, characters get re-encoded. Some servers care about that.

Paramlet only rewrites the parameters you actually changed, whether by hand or
through a preset. Everything else goes back exactly as it was written, including
repeated keys (`tag=a&tag=b`) and empty segments.

## Install

Paramlet is not on addons.mozilla.org yet. To try it:

1. Download the latest zip from [Releases](../../releases), or build one with
   `npm run build`.
2. Open `about:debugging#/runtime/this-firefox` in Firefox or Zen.
3. Click **Load Temporary Add-on…** and pick the zip (or `manifest.json` in a
   clone of this repository).

A temporary add-on is removed when the browser restarts.

The keyboard shortcut can be changed from `about:addons` → gear menu →
**Manage Extension Shortcuts**.

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

| File | What it does |
|---|---|
| [`src/query.js`](src/query.js) | Splits a URL into parameters and puts it back together |
| [`src/presets.js`](src/presets.js) | Site matching and preset storage |
| [`src/background.js`](src/background.js) | Draws the address bar button |
| [`src/popup/`](src/popup) | The panel |

## Not yet

- Parameters after `#`, as in single-page apps (`#/route?x=1`)
- Showing host, path and parameters as separate chips in the address bar

Ideas and pull requests are welcome.

## License

[MIT](LICENSE)
