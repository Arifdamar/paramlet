# Paramlet

See and edit a page's query parameters from the address bar. Works in Firefox
and Firefox-based browsers like [Zen](https://zen-browser.app).

When a page has query parameters, a small button with their count shows up in
the address bar. Click it (or press <kbd>Ctrl</kbd>+<kbd>Q</kbd> on macOS,
<kbd>Alt</kbd>+<kbd>Q</kbd> elsewhere) to get a list you can edit:

- change any key or value
- remove a parameter, or add a new one
- **Apply** to load the edited URL, or **Copy URL** to take it with you

Values are shown decoded, so `hello%20world` reads as `hello world`.

## Your URL stays your URL

Most tools rebuild the whole query string when you change one thing, and the
URL quietly changes in ways you did not ask for: `%20` turns into `+`, `?debug`
turns into `debug=`, characters get re-encoded. Some servers care about that.

Paramlet only rewrites the parameters you actually edited. Everything else goes
back exactly as it was written, including repeated keys (`tag=a&tag=b`) and
empty segments.

## Install

Paramlet is not on addons.mozilla.org yet. To try it from source:

1. Clone this repository.
2. Open `about:debugging#/runtime/this-firefox` in Firefox or Zen.
3. Click **Load Temporary Add-on…** and pick `manifest.json`.

A temporary add-on is removed when the browser restarts.

The keyboard shortcut can be changed from `about:addons` → gear menu →
**Manage Extension Shortcuts**.

## Development

Needs Node.js 22 or newer.

```sh
npm install
npm test        # parser tests
npm run lint    # web-ext lint
npm start       # opens Firefox with the extension loaded
npm run build   # zip for addons.mozilla.org, in web-ext-artifacts/
```

To run it in Zen on macOS:

```sh
npm start -- --firefox="/Applications/Zen Browser.app/Contents/MacOS/zen"
```

The URL handling lives in [`src/query.js`](src/query.js) and is covered by
[`test/query.test.js`](test/query.test.js). The address bar button is in
[`src/background.js`](src/background.js), the panel in [`src/popup/`](src/popup).

## Not yet

- Parameters after `#`, as in single-page apps (`#/route?x=1`)
- Showing host, path and parameters as separate chips in the address bar
- One-click cleanup, like removing every `utm_*` parameter

Ideas and pull requests are welcome.

## License

[MIT](LICENSE)
