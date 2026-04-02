import { addFooter } from "../components/footer.mjs";

/**
 * Build a chart slide using pptxgenjs chart API.
 * Supports: bar, line, pie, doughnut
 */
export function buildChartSlide(pres, slideSpec, theme, pageNum, totalPages) {
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
  const contentW = slideW - spacing.slideMargin.left - spacing.slideMargin.right;

  // Chart type mapping
  const chartTypeMap = {
    bar: pres.ChartType.bar,
    line: pres.ChartType.line,
    pie: pres.ChartType.pie,
    doughnut: pres.ChartType.doughnut,
    area: pres.ChartType.area,
  };

  const chartType = chartTypeMap[slideSpec.chartType || "bar"] || pres.ChartType.bar;
  const chartData = slideSpec.chartData || [];

  // Default chart colors from theme
  const chartColors = slideSpec.chartColors || [
    colors.primary.replace("#", ""),
    colors.textSub.replace("#", ""),
    colors.border.replace("#", ""),
    colors.primaryBorder?.replace("#", "") || "E6CB00",
  ];

  if (chartData.length > 0) {
    slide.addChart(chartType, chartData, {
      x: spacing.slideMargin.left,
      y: contentY,
      w: contentW,
      h: contentH,
      showTitle: false,
      showLegend: true,
      legendPos: "b",
      legendFontSize: typography.caption.fontSize,
      legendFontFace: typography.caption.fontFace,
      chartColors,
      valAxisLabelFontSize: typography.caption.fontSize,
      catAxisLabelFontSize: typography.caption.fontSize,
    });
  } else {
    slide.addText("[Chart: No data provided]", {
      x: spacing.slideMargin.left,
      y: contentY,
      w: contentW,
      h: contentH,
      fontSize: typography.heading.fontSize,
      fontFace: typography.heading.fontFace,
      color: colors.textSub.replace("#", ""),
      align: "center",
      valign: "middle",
    });
  }

  addFooter(slide, theme, pageNum, totalPages);
  return slide;
}
