/**
 * Add a horizontal flow chart to a slide.
 * @param {object} slide - pptxgenjs slide
 * @param {object} pres - pptxgenjs presentation (for ShapeType)
 * @param {object} theme - Theme object
 * @param {object} options - { x, y, w, h, steps: string[], accentFirst, accentLast }
 */
export function addFlowChart(slide, pres, theme, options) {
  const colors = theme.colors;
  const typo = theme.typography;
  const steps = options.steps || [];
  if (steps.length === 0) return;

  const arrowW = 0.3;
  const totalArrowW = (steps.length - 1) * arrowW;
  const boxW = (options.w - totalArrowW) / steps.length;
  const boxH = options.h;

  steps.forEach((step, idx) => {
    const x = options.x + idx * (boxW + arrowW);
    const isAccent =
      (options.accentFirst && idx === 0) ||
      (options.accentLast && idx === steps.length - 1);

    // Box
    slide.addShape(pres.ShapeType.rect, {
      x,
      y: options.y,
      w: boxW,
      h: boxH,
      fill: { color: isAccent ? colors.primary.replace("#", "") : colors.bg.replace("#", "") },
      line: {
        color: colors.border.replace("#", ""),
        width: 0.5,
      },
      rectRadius: 0,
    });

    // Text
    slide.addText(step, {
      x,
      y: options.y,
      w: boxW,
      h: boxH,
      fontSize: typo.body.fontSize - 1,
      fontFace: typo.body.fontFace,
      bold: isAccent,
      color: colors.text.replace("#", ""),
      align: "center",
      valign: "middle",
    });

    // Arrow
    if (idx < steps.length - 1) {
      slide.addText("\u25B6", {
        x: x + boxW,
        y: options.y,
        w: arrowW,
        h: boxH,
        fontSize: 10,
        color: colors.textSub.replace("#", ""),
        align: "center",
        valign: "middle",
      });
    }
  });
}
