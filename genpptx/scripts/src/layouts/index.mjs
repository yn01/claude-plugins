import { buildCoverSlide } from "./cover.mjs";
import { buildContentSlide } from "./content.mjs";
import { buildSectionSlide } from "./section.mjs";
import { buildTwoColumnSlide } from "./two-column.mjs";
import { buildTableSlide } from "./table.mjs";
import { buildImageTextSlide } from "./image-text.mjs";
import { buildImageFullSlide } from "./image-full.mjs";
import { buildChartSlide } from "./chart.mjs";
import { buildSummarySlide } from "./summary.mjs";
import { buildClosingSlide } from "./closing.mjs";

const layoutBuilders = {
  cover: buildCoverSlide,
  content: buildContentSlide,
  section: buildSectionSlide,
  "two-column": buildTwoColumnSlide,
  table: buildTableSlide,
  "image-text": buildImageTextSlide,
  "image-full": buildImageFullSlide,
  chart: buildChartSlide,
  summary: buildSummarySlide,
  closing: buildClosingSlide,
};

/**
 * Get the layout builder function for a given layout name.
 * @param {string} name - Layout name
 * @returns {Function} Layout builder function
 */
export function getLayoutBuilder(name) {
  const builder = layoutBuilders[name];
  if (!builder) {
    const available = Object.keys(layoutBuilders).join(", ");
    throw new Error(`Unknown layout "${name}". Available: ${available}`);
  }
  return builder;
}

/**
 * Register a new layout builder.
 * @param {string} name - Layout name
 * @param {Function} builder - Builder function
 */
export function registerLayout(name, builder) {
  layoutBuilders[name] = builder;
}

/**
 * List all available layout names.
 * @returns {string[]}
 */
export function listLayouts() {
  return Object.keys(layoutBuilders);
}
