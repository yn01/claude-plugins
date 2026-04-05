/**
 * Add a highlight box to a slide.
 * @param {object} slide - pptxgenjs slide
 * @param {object} pres - pptxgenjs presentation (for ShapeType)
 * @param {object} theme - Theme object
 * @param {object} options - { x, y, w, h, text }
 */
export function addHighlightBox(slide, pres, theme, options) {
  const hb = theme.components.highlightBox;
  const typo = theme.typography;
  const colors = theme.colors;

  // Background + border
  slide.addShape(pres.ShapeType.rect, {
    x: options.x,
    y: options.y,
    w: options.w,
    h: options.h,
    fill: { color: hb.bg.replace("#", "") },
    line: {
      color: hb.borderColor.replace("#", ""),
      width: hb.borderWidth,
    },
    rectRadius: 0,
  });

  // Text
  if (options.text) {
    slide.addText(options.text, {
      x: options.x + hb.padding,
      y: options.y + hb.padding,
      w: options.w - hb.padding * 2,
      h: options.h - hb.padding * 2,
      fontSize: typo.body.fontSize,
      fontFace: typo.body.fontFace,
      color: (typo.body.color || colors.text).replace("#", ""),
      align: "left",
      valign: "top",
      lineSpacingMultiple: 1.3,
    });
  }
}
