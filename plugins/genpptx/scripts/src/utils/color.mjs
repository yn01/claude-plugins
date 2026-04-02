/**
 * Strip '#' prefix from hex color string for pptxgenjs compatibility.
 * @param {string} color - Hex color (e.g., "#FF0000" or "FF0000")
 * @returns {string} Color without '#' prefix
 */
export function stripHash(color) {
  return color ? color.replace("#", "") : "";
}

/**
 * Lighten a hex color by a percentage.
 * @param {string} hex - Hex color (with or without #)
 * @param {number} percent - Percentage to lighten (0-100)
 * @returns {string} Lightened hex color without #
 */
export function lighten(hex, percent) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const factor = percent / 100;

  const newR = Math.min(255, Math.round(r + (255 - r) * factor));
  const newG = Math.min(255, Math.round(g + (255 - g) * factor));
  const newB = Math.min(255, Math.round(b + (255 - b) * factor));

  return [newR, newG, newB].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/**
 * Darken a hex color by a percentage.
 * @param {string} hex - Hex color (with or without #)
 * @param {number} percent - Percentage to darken (0-100)
 * @returns {string} Darkened hex color without #
 */
export function darken(hex, percent) {
  const c = hex.replace("#", "");
  const r = parseInt(c.substring(0, 2), 16);
  const g = parseInt(c.substring(2, 4), 16);
  const b = parseInt(c.substring(4, 6), 16);
  const factor = 1 - percent / 100;

  const newR = Math.round(r * factor);
  const newG = Math.round(g * factor);
  const newB = Math.round(b * factor);

  return [newR, newG, newB].map((v) => v.toString(16).padStart(2, "0")).join("");
}
