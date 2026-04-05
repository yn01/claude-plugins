/**
 * Add a category badge to a slide.
 * @param {object} slide - pptxgenjs slide
 * @param {object} theme - Theme object
 * @param {string} text - Badge text
 * @param {number} x - X position (inches)
 * @param {number} y - Y position (inches)
 * @returns {object} { w, h } dimensions of the badge
 */
export function addBadge(slide, theme, text, x, y) {
  const badge = theme.components.badge;
  const w = text.length * 0.13 + badge.paddingLeft + badge.paddingRight;
  const h = 0.35;

  slide.addShape(slide._slideLayout?._presLayout ? undefined : undefined);

  slide.addText(text, {
    x,
    y,
    w,
    h,
    fontSize: 10,
    fontFace: theme.typography.heading.fontFace,
    bold: true,
    color: badge.color.replace("#", ""),
    fill: { color: badge.bg.replace("#", "") },
    align: "center",
    valign: "middle",
    rectRadius: badge.borderRadius || 0,
  });

  return { w, h };
}
