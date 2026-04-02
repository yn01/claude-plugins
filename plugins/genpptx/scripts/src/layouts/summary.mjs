import { addFooter } from "../components/footer.mjs";

/**
 * Build a summary/key points slide with numbered items.
 */
export function buildSummarySlide(pres, slideSpec, theme, pageNum, totalPages) {
  const slide = pres.addSlide();
  const { colors, typography, spacing } = theme;
  const slideW = 13.33;

  slide.background = { color: colors.bg.replace("#", "") };

  // Page title
  slide.addText(slideSpec.title || "Summary", {
    x: spacing.slideMargin.left,
    y: spacing.slideMargin.top,
    w: slideW - spacing.slideMargin.left - spacing.slideMargin.right,
    h: 0.6,
    fontSize: typography.pageTitle.fontSize,
    fontFace: typography.pageTitle.fontFace,
    bold: typography.pageTitle.bold,
    color: (typography.pageTitle.color || colors.text).replace("#", ""),
    align: "left",
  });

  const contentY = spacing.slideMargin.top + 0.6 + spacing.titleGap;
  const points = slideSpec.points || slideSpec.bullets || [];
  const contentW = slideW - spacing.slideMargin.left - spacing.slideMargin.right;

  points.forEach((point, idx) => {
    const itemY = contentY + idx * 1.3;
    const numSize = 0.6;

    // Number circle
    slide.addShape(pres.ShapeType.ellipse, {
      x: spacing.slideMargin.left,
      y: itemY,
      w: numSize,
      h: numSize,
      fill: { color: colors.primary.replace("#", "") },
      line: { width: 0 },
    });
    slide.addText(String(idx + 1), {
      x: spacing.slideMargin.left,
      y: itemY,
      w: numSize,
      h: numSize,
      fontSize: 14,
      fontFace: typography.heading.fontFace,
      bold: true,
      color: (colors.text).replace("#", ""),
      align: "center",
      valign: "middle",
    });

    // Point text
    const textContent = typeof point === "string" ? point : point.title || "";
    const description = typeof point === "object" ? point.description : null;

    slide.addText(textContent, {
      x: spacing.slideMargin.left + numSize + 0.2,
      y: itemY,
      w: contentW - numSize - 0.2,
      h: 0.4,
      fontSize: typography.heading.fontSize,
      fontFace: typography.heading.fontFace,
      bold: true,
      color: (typography.heading.color || colors.text).replace("#", ""),
      align: "left",
      valign: "middle",
    });

    if (description) {
      slide.addText(description, {
        x: spacing.slideMargin.left + numSize + 0.2,
        y: itemY + 0.4,
        w: contentW - numSize - 0.2,
        h: 0.7,
        fontSize: typography.body.fontSize,
        fontFace: typography.body.fontFace,
        color: (typography.body.color || colors.text).replace("#", ""),
        align: "left",
        valign: "top",
        lineSpacingMultiple: 1.3,
      });
    }
  });

  addFooter(slide, theme, pageNum, totalPages);
  return slide;
}
