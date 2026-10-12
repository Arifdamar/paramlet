# Changelog

## 1.1.2

- Plainer wording in the readme and in a few messages. Messages that name a
  preset use straight quotes.

## 1.1.1

- On the settings page, a preset moved with Alt+Up or Alt+Down keeps the
  focus, so you can press the keys again to keep moving it.
- Dragging a preset no longer leaves event listeners on its handle.

## 1.1.0

- Presets can be reordered by dragging their handle, in the panel or on the
  settings page. The order decides which preset gets 1, 2, 3 and so on.
  Alt+Up and Alt+Down move the focused preset from the keyboard.
- A search box shows up once a list has 8 items or more. It matches parameter
  keys and values, and preset names and contents. Press / to jump to it. The
  settings page has one too.
- The panel stays under Firefox's 600px limit. Long lists scroll inside their
  own section and the buttons stay visible.
- Hovering a preset lists its parameters one per line.
- An import either saves everything or nothing, so a full sync storage no
  longer leaves half an import behind.

## 1.0.0

- Parameters after `#` in single-page app URLs, like `#/route?tab=2` or
  `#access_token=abc`, have their own section and can be edited.
- Remove tracking takes out `utm_*`, `gclid`, `fbclid` and other known
  tracking parameters. They are greyed out in the list.
- Pasting a URL, a query string or `key=value` lines into a key field adds all
  of the parameters in it.
- Presets can be saved for all sites, not only the current one.
- Holding Ctrl (⌘ on macOS) while applying opens the result in a new tab.
- Settings page for all presets: delete, export to a file, import, and change
  the keyboard shortcut.
- English and Turkish.

## 0.2.0

- Save parameters as named presets per site and apply them with a click or
  the number keys.
- The address bar button shows on every web page, with `?` when there are no
  parameters.

## 0.1.0

- Address bar button with the number of query parameters.
- Panel to edit, add and remove parameters, then apply or copy the URL.
- Parameters you did not change keep their original encoding.
