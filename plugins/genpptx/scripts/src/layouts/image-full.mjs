import { addFooter } from "../components/footer.mjs";

/**
 * Build a full-bleed image slide with optional overlay text.
 */
export function buildImageFullSlide(pres, slideSpec, theme, pageNum, totalPages) {
  const slide = pres.addSlide();
  const { colors, typography } = theme;

  slide.background = { color: colors.bg.replace("#", "") };

  const imagePath = slideSpec.image?.path || slideSpec.image?.generatedPath;
  if (imagePath) {
    slide.addImage({
      path: imagePath,
      x: 0,
      y: 0,
      w: 13.33,
      h: 7.5,
      sizing: { type: "cover", w: 13.33, h: 7.5 },
    });
  } else {
    // Placeholder
    slide.addShape(pres.ShapeType.rect, {
      x: 0,
      y: 0,
      w: 13.33,
      h: 7.5,
      fill: { color: colors.surface.replace("#", "") },
    });
    slide.addText("[Full Image Placeholder]", {
      x: 0,
      y: 3,
      w: 13.33,
      h: 1.5,
      fontSize: typography.heading.fontSize,
      fontFace: typography.heading.fontFace,
      color: colors.textSub.replace("#", ""),
      align: "center",
      valign: "middle",
    });
  }

  // Overlay title (semi-transparent background)
  if (slideSpec.title) {
    // Dark overlay bar at bottom
    slide.addShape(pres.ShapeType.rect, {
      x: 0,
      y: 5.5,
      w: 13.33,
      h: 1.5,
      fill: { color: "000000" },
      transparency: 50,
      line: { width: 0 },
    });
    slide.addText(slideSpec.title, {
      x: 0.6,
      y: 5.6,
      w: 12.13,
      h: 0.8,
      fontSize: typography.pageTitle.fontSize,
      fontFace: typography.pageTitle.fontFace,
      bold: true,
      color: "FFFFFF",
      align: "left",
      valign: "middle",
    });
    if (slideSpec.subtitle) {
      slide.addText(slideSpec.subtitle, {
        x: 0.6,
        y: 6.3,
        w: 12.13,
        h: 0.5,
        fontSize: typography.body.fontSize,
        fontFace: typography.body.fontFace,
        color: "CCCCCC",
        align: "left",
      });
    }
  }

  addFooter(slide, theme, pageNum, totalPages);
  return slide;
}
