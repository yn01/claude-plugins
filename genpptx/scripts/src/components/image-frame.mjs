/**
 * Add an image with optional caption to a slide.
 * @param {object} slide - pptxgenjs slide
 * @param {object} theme - Theme object
 * @param {object} options - { x, y, w, h, path, caption }
 */
export function addImageFrame(slide, theme, options) {
  const typo = theme.typography;
  const colors = theme.colors;
  const captionH = options.caption ? 0.4 : 0;
  const imgH = options.h - captionH;

  if (options.path) {
    slide.addImage({
      path: options.path,
      x: options.x,
      y: options.y,
      w: options.w,
      h: imgH,
      sizing: { type: "contain", w: options.w, h: imgH },
    });
  }

  if (options.caption) {
    slide.addText(options.caption, {
      x: options.x,
      y: options.y + imgH,
      w: options.w,
      h: captionH,
      fontSize: typo.caption.fontSize,
      fontFace: typo.caption.fontFace,
      color: colors.textSub.replace("#", ""),
      align: "center",
      valign: "middle",
    });
  }
}
