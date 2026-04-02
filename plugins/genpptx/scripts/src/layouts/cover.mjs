import { addFooter } from "../components/footer.mjs";

/**
 * Build a cover/title slide.
 * @param {object} pres - pptxgenjs presentation
 * @param {object} slideSpec - Slide specification from YAML
 * @param {object} theme - Theme object
 * @param {number} pageNum - Page number
 * @param {number} totalPages - Total pages
 */
export function buildCoverSlide(pres, slideSpec, theme, pageNum, totalPages) {
  const slide = pres.addSlide();
  const { colors, typography, spacing } = theme;

  slide.background = { color: colors.bg.replace("#", "") };

  // Title
  const titleY = 2.5;
  slide.addText(slideSpec.title || "", {
    x: spacing.slideMargin.left,
    y: titleY,
    w: 13.33 - spacing.slideMargin.left - spacing.slideMargin.right,
    h: 1.2,
    fontSize: typography.coverTitle.fontSize,
    fontFace: typography.coverTitle.fontFace,
    bold: typography.coverTitle.bold,
    color: (typography.coverTitle.color || colors.text).replace("#", ""),
    align: "left",
    valign: "middle",
  });

  // Accent line under title
  const lineY = titleY + 1.3;
  slide.addShape(pres.ShapeType.rect, {
    x: spacing.slideMargin.left,
    y: lineY,
    w: 1.5,
    h: 0.04,
    fill: { color: colors.primary.replace("#", "") },
    line: { width: 0 },
  });

  // Subtitle
  if (slideSpec.subtitle) {
    slide.addText(slideSpec.subtitle, {
      x: spacing.slideMargin.left,
      y: lineY + 0.2,
      w: 13.33 - spacing.slideMargin.left - spacing.slideMargin.right,
      h: 0.6,
      fontSize: typography.body.fontSize,
      fontFace: typography.body.fontFace,
      color: colors.textSub.replace("#", ""),
      align: "left",
      valign: "top",
    });
  }

  // Date
  if (slideSpec.date) {
    slide.addText(slideSpec.date, {
      x: spacing.slideMargin.left,
      y: lineY + 0.7,
      w: 5,
      h: 0.4,
      fontSize: typography.caption.fontSize,
      fontFace: typography.caption.fontFace,
      color: colors.textSub.replace("#", ""),
      align: "left",
    });
  }

  addFooter(slide, theme, pageNum, totalPages);
  return slide;
}
