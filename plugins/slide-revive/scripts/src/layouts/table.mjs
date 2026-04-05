import { addFooter } from "../components/footer.mjs";

/**
 * Build a table slide.
 */
export function buildTableSlide(pres, slideSpec, theme, pageNum, totalPages) {
  const slide = pres.addSlide();
  const { colors, typography, spacing } = theme;
  const slideW = 13.33;
  const tableStyle = theme.components.table;

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

  // Build table data
  const headers = slideSpec.headers || [];
  const rows = slideSpec.rows || [];
  const tableRows = [];

  // Header row
  if (headers.length > 0) {
    tableRows.push(
      headers.map((h) => ({
        text: h,
        options: {
          fontSize: typography.heading.fontSize - 2,
          fontFace: typography.heading.fontFace,
          bold: true,
          color: tableStyle.headerColor.replace("#", ""),
          fill: { color: tableStyle.headerBg.replace("#", "") },
          align: "center",
          valign: "middle",
        },
      }))
    );
  }

  // Data rows
  rows.forEach((row, rowIdx) => {
    const fillColor = rowIdx % 2 === 0
      ? tableStyle.zebraOdd.replace("#", "")
      : tableStyle.zebraEven.replace("#", "");
    tableRows.push(
      row.map((cell, colIdx) => ({
        text: String(cell),
        options: {
          fontSize: typography.body.fontSize,
          fontFace: typography.body.fontFace,
          bold: colIdx === 0,
          color: (typography.body.color || colors.text).replace("#", ""),
          fill: { color: fillColor },
          align: colIdx === 0 ? "left" : "center",
          valign: "middle",
        },
      }))
    );
  });

  const contentY = spacing.slideMargin.top + 0.6 + spacing.titleGap;
  const tableW = slideW - spacing.slideMargin.left - spacing.slideMargin.right;

  if (tableRows.length > 0) {
    slide.addTable(tableRows, {
      x: spacing.slideMargin.left,
      y: contentY,
      w: tableW,
      colW: Array(headers.length).fill(tableW / headers.length),
      border: {
        type: "solid",
        pt: tableStyle.borderWidth,
        color: tableStyle.borderColor.replace("#", ""),
      },
      rowH: 0.45,
      margin: [4, 8, 4, 8],
      autoPage: false,
    });
  }

  // Description text below table
  if (slideSpec.description) {
    const tableH = tableRows.length * 0.45;
    slide.addText(slideSpec.description, {
      x: spacing.slideMargin.left,
      y: contentY + tableH + 0.2,
      w: tableW,
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
