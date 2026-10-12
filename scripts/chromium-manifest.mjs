// manifest.json is written for Firefox. Chromium browsers (Chrome, Edge,
// Opera, Brave) need a few things the other way round, and this turns one into
// the other so there is only one manifest to keep up to date.

const PNG_ICONS = {
  16: "icons/paramlet-16.png",
  32: "icons/paramlet-32.png",
  48: "icons/paramlet-48.png",
  128: "icons/paramlet-128.png",
};

export function chromiumManifest(firefox) {
  const {
    page_action: pageAction,
    background,
    browser_specific_settings: _firefoxOnly,
    commands,
    ...rest
  } = firefox;

  // Chromium has no address bar buttons, so the panel hangs off the toolbar
  // button instead, and its shortcut is _execute_action.
  const { _execute_page_action: openPanel, ...otherCommands } = commands ?? {};
  return {
    ...rest,
    // Chromium does not draw SVG icons.
    icons: PNG_ICONS,
    action: {
      default_icon: { 16: PNG_ICONS[16], 32: PNG_ICONS[32] },
      default_title: pageAction.default_title,
      default_popup: pageAction.default_popup,
    },
    // Chromium runs the background script as a service worker.
    background: { service_worker: background.scripts[0], type: background.type },
    commands: { ...otherCommands, ...(openPanel ? { _execute_action: openPanel } : {}) },
  };
}
