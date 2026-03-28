import base from "./base.mjs";
import corporateYellow from "./corporate-yellow.mjs";

const themes = new Map();
themes.set("base", base);
themes.set("corporate-yellow", corporateYellow);

/**
 * Get a theme by name.
 * @param {string} name - Theme name
 * @returns {object} Theme object
 */
export function getTheme(name) {
  const theme = themes.get(name);
  if (!theme) {
    const available = Array.from(themes.keys()).join(", ");
    throw new Error(`Unknown theme "${name}". Available: ${available}`);
  }
  return theme;
}

/**
 * List all available theme names.
 * @returns {string[]}
 */
export function listThemes() {
  return Array.from(themes.keys());
}

/**
 * Register a new theme at runtime.
 * @param {object} theme - Theme object with a `name` property
 */
export function registerTheme(theme) {
  themes.set(theme.name, theme);
}
