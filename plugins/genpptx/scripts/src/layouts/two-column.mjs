import { addFooter } from "../components/footer.mjs";

/**
 * Build a two-column layout slide.
 */
export function buildTwoColumnSlide(pres, slideSpec, theme, pageNum, totalPages) {
  const slide = pres.addSlide();
  const { colors, typography, spacing } = theme;
  const slideW = 13.33;

  slide.background = { color: colors.bg.replace("#", "") };

  // Page title
  slide.addText(slideSpec.title || "", {
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
  const contentH = 7.5 - contentY - spacing.slideMargin.bottom - 0.3;
  const colW = (slideW - spacing.slideMargin.left - spacing.slideMargin.right - 0.4) / 2;
  const leftX = spacing.slideMargin.left;
  const rightX = leftX + colW + 0.4;

  // Helper to build a column
  function buildColumn(colSpec, x) {
    if (!colSpec) return;
    let y = contentY;

    // Column heading
    if (colSpec.heading) {
      slide.addText(colSpec.heading, {
        x,
        y,
        w: colW,
        h: 0.45,
        fontSize: typography.heading.fontSize,
        fontFace: typography.heading.fontFace,
        bold: true,
        color: (typography.heading.color || colors.text).replace("#", ""),
        align: "left",
      });
      y += 0.5;
    }

    // Bullets
    if (colSpec.bullets && colSpec.bullets.length > 0) {
      const rows = colSpec.bullets.map((text) => ({
        text,
        options: {
          fontSize: typography.body.fontSize,
          fontFace: typography.body.fontFace,
          color: (typography.body.color || colors.text).replace("#", ""),
          bullet: { code: "2022" },
          paraSpaceAfter: 6,
        },
      }));
      slide.addText(rows, {
        x,
        y,
        w: colW,
        h: contentH - (y - contentY),
        valign: "top",
        lineSpacingMultiple: 1.4,
      });
    }

    // Text
    if (colSpec.text) {
      slide.addText(colSpec.text, {
        x,
        y,
        w: colW,
        h: contentH - (y - contentY),
        fontSize: typography.body.fontSize,
        fontFace: typography.body.fontFace,
        color: (typography.body.color || colors.text).replace("#", ""),
        align: "left",
        valign: "top",
        lineSpacingMultiple: 1.4,
      });
    }
  }

  buildColumn(slideSpec.left, leftX);
  buildColumn(slideSpec.right, rightX);

  addFooter(slide, theme, pageNum, totalPages);
  return slide;
}
