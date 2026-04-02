import { addFooter } from "../components/footer.mjs";

/**
 * Build an image + text split slide.
 */
export function buildImageTextSlide(pres, slideSpec, theme, pageNum, totalPages) {
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
  const halfW = (slideW - spacing.slideMargin.left - spacing.slideMargin.right - 0.4) / 2;

  // Image (left side)
  const imgX = spacing.slideMargin.left;
  const imagePath = slideSpec.image?.path || slideSpec.image?.generatedPath;
  if (imagePath) {
    slide.addImage({
      path: imagePath,
      x: imgX,
      y: contentY,
      w: halfW,
      h: contentH,
      sizing: { type: "contain", w: halfW, h: contentH },
    });
  } else {
    // Placeholder rectangle
    slide.addShape(pres.ShapeType.rect, {
      x: imgX,
      y: contentY,
      w: halfW,
      h: contentH,
      fill: { color: colors.surface.replace("#", "") },
      line: { color: colors.border.replace("#", ""), width: 0.5 },
    });
    slide.addText(slideSpec.image?.prompt ? "[Image: generating...]" : "[No image]", {
      x: imgX,
      y: contentY,
      w: halfW,
      h: contentH,
      fontSize: typography.caption.fontSize,
      fontFace: typography.caption.fontFace,
      color: colors.textSub.replace("#", ""),
      align: "center",
      valign: "middle",
    });
  }

  // Text (right side)
  const textX = spacing.slideMargin.left + halfW + 0.4;
  let textY = contentY;

  if (slideSpec.text) {
    slide.addText(slideSpec.text, {
      x: textX,
      y: textY,
      w: halfW,
      h: contentH,
      fontSize: typography.body.fontSize,
      fontFace: typography.body.fontFace,
      color: (typography.body.color || colors.text).replace("#", ""),
      align: "left",
      valign: "top",
      lineSpacingMultiple: 1.5,
    });
  }

  if (slideSpec.bullets && slideSpec.bullets.length > 0) {
    const rows = slideSpec.bullets.map((text) => ({
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
      x: textX,
      y: textY,
      w: halfW,
      h: contentH,
      valign: "top",
      lineSpacingMultiple: 1.4,
    });
  }

  addFooter(slide, theme, pageNum, totalPages);
  return slide;
}
