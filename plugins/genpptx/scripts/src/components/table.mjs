/**
 * Add a styled data table to a slide.
 * @param {object} slide - pptxgenjs slide
 * @param {object} theme - Theme object
 * @param {string[]} headers - Column headers
 * @param {string[][]} rows - Table data rows
 * @param {object} position - { x, y, w, h }
 * @returns {number} Actual height of the table
 */
export function addTable(slide, theme, headers, rows, position) {
  const tableStyle = theme.components.table;
  const typo = theme.typography;
  const tableRows = [];

  // Header row
  if (headers.length > 0) {
    tableRows.push(
      headers.map((h) => ({
        text: h,
        options: {
          fontSize: typo.heading.fontSize - 2,
          fontFace: typo.heading.fontFace,
          bold: true,
          color: tableStyle.headerColor.replace("#", ""),
          fill: { color: tableStyle.headerBg.replace("#", "") },
          align: "center",
          valign: "middle",
        },
      }))
    );
  }

  // Data rows with zebra striping
  rows.forEach((row, rowIdx) => {
    const fillColor = rowIdx % 2 === 0
      ? tableStyle.zebraOdd.replace("#", "")
      : tableStyle.zebraEven.replace("#", "");
    tableRows.push(
      row.map((cell, colIdx) => ({
        text: String(cell),
        options: {
          fontSize: typo.body.fontSize,
          fontFace: typo.body.fontFace,
          bold: colIdx === 0,
          color: (typo.body.color || theme.colors.text).replace("#", ""),
          fill: { color: fillColor },
          align: colIdx === 0 ? "left" : "center",
          valign: "middle",
        },
      }))
    );
  });

  const colW = Array(headers.length).fill(position.w / headers.length);
  const rowH = 0.45;
  const totalH = tableRows.length * rowH;

  slide.addTable(tableRows, {
    x: position.x,
    y: position.y,
    w: position.w,
    colW,
    border: {
      type: "solid",
      pt: tableStyle.borderWidth,
      color: tableStyle.borderColor.replace("#", ""),
    },
    rowH,
    margin: [4, 8, 4, 8],
    autoPage: false,
  });

  return totalH;
}
