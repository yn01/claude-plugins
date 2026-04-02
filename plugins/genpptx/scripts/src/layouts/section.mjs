import { addFooter } from "../components/footer.mjs";

/**
 * Build a section divider slide.
 */
export function buildSectionSlide(pres, slideSpec, theme, pageNum, totalPages) {
  const slide = pres.addSlide();
  const { colors, typography } = theme;

  slide.background = { color: colors.bg.replace("#", "") };

  // Section title centered
  slide.addText(slideSpec.title || "", {
    x: 1,
    y: 2.5,
    w: 11.33,
    h: 2.5,
    fontSize: typography.sectionTitle.fontSize,
    fontFace: typography.sectionTitle.fontFace,
    bold: typography.sectionTitle.bold,
    color: (typography.sectionTitle.color || colors.text).replace("#", ""),
    align: "center",
    valign: "middle",
  });

  // Accent line below
  slide.addShape(pres.ShapeType.rect, {
    x: 5.67,
    y: 4.8,
    w: 2,
    h: 0.04,
    fill: { color: colors.primary.replace("#", "") },
    line: { width: 0 },
  });

  // Subtitle
  if (slideSpec.subtitle) {
    slide.addText(slideSpec.subtitle, {
      x: 2,
      y: 5.0,
      w: 9.33,
      h: 0.6,
      fontSize: typography.body.fontSize,
      fontFace: typography.body.fontFace,
      color: colors.textSub.replace("#", ""),
      align: "center",
    });
  }

  addFooter(slide, theme, pageNum, totalPages);
  return slide;
}
