# Changelog

## 1.0.0

- Parameters after `#` in single-page app URLs (`#/route?tab=2`,
  `#access_token=…`) get their own section and can be edited like the rest.
- **Remove tracking** clears `utm_*`, `gclid`, `fbclid` and other known
  tracking parameters in one click. Tracking parameters are shown dimmed.
- Paste a whole URL, a query string or `key=value` lines into a key field to
  add every parameter in it at once.
- Presets can be saved for all sites, not just the current one.
- Hold <kbd>Ctrl</kbd> (<kbd>⌘</kbd> on macOS) while applying to open the
  result in a new tab.
- New settings page: see and delete presets for every site, export them to a
  file and import them back, and change the keyboard shortcut.
- English and Turkish translations.

## 0.2.0

- Save parameters as named presets per site, and apply them with a click or the
  <kbd>1</kbd>–<kbd>9</kbd> keys.
- The address bar button now shows on every web page, with `?` when the page
  has no query parameters.

## 0.1.0

- Address bar button with the number of query parameters.
- Panel to edit, add and remove parameters, apply the result or copy the URL.
- Untouched parameters keep their original encoding.
