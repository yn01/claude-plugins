import { addFooter } from "../components/footer.mjs";

/**
 * Build a closing/thank-you slide.
 */
export function buildClosingSlide(pres, slideSpec, theme, pageNum, totalPages) {
  const slide = pres.addSlide();
  const { colors, typography } = theme;

  slide.background = { color: colors.bg.replace("#", "") };

  // Main message
  slide.addText(slideSpec.title || "Thank You", {
    x: 1,
    y: 2.2,
    w: 11.33,
    h: 1.5,
    fontSize: typography.coverTitle.fontSize,
    fontFace: typography.coverTitle.fontFace,
    bold: true,
    color: (typography.coverTitle.color || colors.text).replace("#", ""),
    align: "center",
    valign: "middle",
  });

  // Accent line
  slide.addShape(pres.ShapeType.rect, {
    x: 5.67,
    y: 3.9,
    w: 2,
    h: 0.04,
    fill: { color: colors.primary.replace("#", "") },
    line: { width: 0 },
  });

  // Subtitle / contact info
  if (slideSpec.subtitle) {
    slide.addText(slideSpec.subtitle, {
      x: 2,
      y: 4.2,
      w: 9.33,
      h: 0.6,
      fontSize: typography.body.fontSize,
      fontFace: typography.body.fontFace,
      color: colors.textSub.replace("#", ""),
      align: "center",
    });
  }

  // Additional info
  if (slideSpec.contact) {
    slide.addText(slideSpec.contact, {
      x: 2,
      y: 4.9,
      w: 9.33,
      h: 0.5,
      fontSize: typography.caption.fontSize,
      fontFace: typography.caption.fontFace,
      color: colors.textSub.replace("#", ""),
      align: "center",
    });
  }

  addFooter(slide, theme, pageNum, totalPages);
  return slide;
}
