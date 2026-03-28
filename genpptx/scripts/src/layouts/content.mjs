import { addFooter } from "../components/footer.mjs";

/**
 * Build a standard content slide with optional sidebar.
 * @param {object} pres - pptxgenjs presentation
 * @param {object} slideSpec - Slide specification from YAML
 * @param {object} theme - Theme object
 * @param {number} pageNum - Page number
 * @param {number} totalPages - Total pages
 */
export function buildContentSlide(pres, slideSpec, theme, pageNum, totalPages) {
  const slide = pres.addSlide();
  const { colors, typography, spacing } = theme;
  const slideW = 13.33;

  slide.background = { color: colors.bg.replace("#", "") };

  // Sidebar
  const sidebarW = spacing.sidebarWidth;
  slide.addShape(pres.ShapeType.rect, {
    x: 0,
    y: 0,
    w: sidebarW,
    h: 7.5,
    fill: { color: colors.textSub.replace("#", "") },
    line: { width: 0 },
  });

  // Sidebar title (vertical text)
  if (slideSpec.sidebarTitle || slideSpec.title) {
    slide.addText(slideSpec.sidebarTitle || slideSpec.title, {
      x: 0,
      y: 0.5,
      w: sidebarW,
      h: 6.5,
      fontSize: 14,
      fontFace: typography.heading.fontFace,
      bold: true,
      color: colors.white.replace("#", ""),
      align: "center",
      valign: "middle",
      rotate: 270,
    });
  }

  // Main content area
  const mainX = sidebarW + spacing.contentPadding;
  const mainW = slideW - sidebarW - spacing.contentPadding - spacing.slideMargin.right;

  // Page title
  slide.addText(slideSpec.title || "", {
    x: mainX,
    y: spacing.slideMargin.top,
    w: mainW,
    h: 0.6,
    fontSize: typography.pageTitle.fontSize,
    fontFace: typography.pageTitle.fontFace,
    bold: typography.pageTitle.bold,
    color: (typography.pageTitle.color || colors.text).replace("#", ""),
    align: "left",
    valign: "top",
  });

  // Bullets
  const contentY = spacing.slideMargin.top + 0.6 + spacing.titleGap;
  if (slideSpec.bullets && slideSpec.bullets.length > 0) {
    const bulletRows = slideSpec.bullets.map((text) => ({
      text,
      options: {
        fontSize: typography.body.fontSize,
        fontFace: typography.body.fontFace,
        color: (typography.body.color || colors.text).replace("#", ""),
        bullet: { code: "2022" },
        paraSpaceAfter: 8,
      },
    }));

    slide.addText(bulletRows, {
      x: mainX,
      y: contentY,
      w: mainW,
      h: 7.5 - contentY - spacing.slideMargin.bottom - 0.3,
      valign: "top",
      lineSpacingMultiple: 1.5,
    });
  }

  // Body text (if no bullets, use text field)
  if (slideSpec.text && !slideSpec.bullets) {
    slide.addText(slideSpec.text, {
      x: mainX,
      y: contentY,
      w: mainW,
      h: 7.5 - contentY - spacing.slideMargin.bottom - 0.3,
      fontSize: typography.body.fontSize,
      fontFace: typography.body.fontFace,
      color: (typography.body.color || colors.text).replace("#", ""),
      align: "left",
      valign: "top",
      lineSpacingMultiple: 1.5,
    });
  }

  addFooter(slide, theme, pageNum, totalPages);
  return slide;
}
