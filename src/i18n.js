// Translated strings come from _locales/<language>/messages.json.

/** The message for `key`, with `$1`, `$2`… replaced by `substitutions`. */
export const t = (key, ...substitutions) => browser.i18n.getMessage(key, substitutions.map(String));

const ATTRIBUTES = ["title", "placeholder", "aria-label"];

/**
 * Fills in translated text for elements marked with data-i18n (text) and
 * data-i18n-title / -placeholder / -aria-label (attributes), including inside
 * <template> elements.
 */
export function localize(root = document) {
  for (const element of root.querySelectorAll("[data-i18n]")) {
    element.textContent = t(element.dataset.i18n);
  }
  for (const attribute of ATTRIBUTES) {
    for (const element of root.querySelectorAll(`[data-i18n-${attribute}]`)) {
      element.setAttribute(attribute, t(element.getAttribute(`data-i18n-${attribute}`)));
    }
  }
  for (const template of root.querySelectorAll("template")) localize(template.content);
  if (root === document) document.documentElement.lang = browser.i18n.getUILanguage();
}
