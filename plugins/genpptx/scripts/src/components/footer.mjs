/**
 * Add page number footer to a slide.
 * @param {object} slide - pptxgenjs slide object
 * @param {object} theme - Theme object
 * @param {number} pageNum - Current page number
 * @param {number} totalPages - Total number of pages
 */
export function addFooter(slide, theme, pageNum, totalPages) {
  const { footer } = theme.components;
  slide.addText(`${pageNum} / ${totalPages}`, {
    x: "90%",
    y: "95%",
    w: "8%",
    h: 0.25,
    fontSize: footer.fontSize,
    color: footer.color.replace("#", ""),
    fontFace: theme.typography.footnote.fontFace,
    align: "right",
    valign: "bottom",
  });
}
