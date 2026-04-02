/**
 * Add a card container to a slide.
 * @param {object} slide - pptxgenjs slide
 * @param {object} pres - pptxgenjs presentation (for ShapeType)
 * @param {object} theme - Theme object
 * @param {object} options - { x, y, w, h, title, text, bullets }
 */
export function addCard(slide, pres, theme, options) {
  const card = theme.components.card;
  const typo = theme.typography;
  const colors = theme.colors;

  // Card border
  slide.addShape(pres.ShapeType.rect, {
    x: options.x,
    y: options.y,
    w: options.w,
    h: options.h,
    fill: { color: card.bg.replace("#", "") },
    line: {
      color: card.borderColor.replace("#", ""),
      width: card.borderWidth,
    },
    rectRadius: 0,
  });

  let innerY = options.y + card.padding;
  const innerX = options.x + card.padding;
  const innerW = options.w - card.padding * 2;

  // Title
  if (options.title) {
    slide.addText(options.title, {
      x: innerX,
      y: innerY,
      w: innerW,
      h: 0.35,
      fontSize: typo.heading.fontSize - 2,
      fontFace: typo.heading.fontFace,
      bold: true,
      color: (typo.heading.color || colors.text).replace("#", ""),
      align: "left",
    });
    innerY += 0.4;
  }

  // Text or bullets
  if (options.text) {
    slide.addText(options.text, {
      x: innerX,
      y: innerY,
      w: innerW,
      h: options.h - (innerY - options.y) - card.padding,
      fontSize: typo.body.fontSize,
      fontFace: typo.body.fontFace,
      color: (typo.body.color || colors.text).replace("#", ""),
      align: "left",
      valign: "top",
      lineSpacingMultiple: 1.3,
    });
  }

  if (options.bullets) {
    const rows = options.bullets.map((text) => ({
      text,
      options: {
        fontSize: typo.body.fontSize,
        fontFace: typo.body.fontFace,
        color: (typo.body.color || colors.text).replace("#", ""),
        bullet: { code: "2022" },
        paraSpaceAfter: 4,
      },
    }));
    slide.addText(rows, {
      x: innerX,
      y: innerY,
      w: innerW,
      h: options.h - (innerY - options.y) - card.padding,
      valign: "top",
    });
  }
}
