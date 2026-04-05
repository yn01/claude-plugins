import fs from "fs";
import path from "path";
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

/**
 * Load custom themes from a project-local directory.
 * Call this before getTheme() to make project themes available.
 * @param {string} [dir] - Path to themes directory (default: <cwd>/themes)
 */
export async function loadProjectThemes(dir) {
  const themesDir = dir || path.join(process.cwd(), "themes");
  if (!fs.existsSync(themesDir)) return;
  const files = fs.readdirSync(themesDir).filter((f) => f.endsWith(".mjs"));
  for (const file of files) {
    try {
      const mod = await import(path.resolve(themesDir, file));
      if (mod.default?.name) {
        registerTheme(mod.default);
      }
    } catch {
      // skip malformed theme files silently
    }
  }
}
