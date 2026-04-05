/**
 * Base theme - all themes inherit from this via spread.
 * Override only what differs in child themes.
 */
const base = {
  name: "base",
  meta: {
    description: "Base theme with shared defaults",
    source: null,
  },

  // Presentation-level settings
  presentation: {
    layout: "LAYOUT_WIDE", // 16:9
    author: "",
  },

  // Color tokens
  colors: {
    primary:       "#2563EB",
    primaryLight:  "#EFF6FF",
    primaryBorder: "#1D4ED8",
    text:          "#000000",
    textSub:       "#4B5563",
    bg:            "#FFFFFF",
    surface:       "#F9FAFB",
    border:        "#D1D5DB",
    white:         "#FFFFFF",
  },

  // Typography (pptxgenjs uses pt for fontSize)
  typography: {
    coverTitle:   { fontSize: 36, fontFace: "Noto Sans JP", bold: true, color: null },
    pageTitle:    { fontSize: 24, fontFace: "Noto Sans JP", bold: true, color: null },
    sectionTitle: { fontSize: 20, fontFace: "Noto Sans JP", bold: true, color: null },
    heading:      { fontSize: 16, fontFace: "Noto Sans JP", bold: true, color: null },
    body:         { fontSize: 12, fontFace: "Noto Sans JP", bold: false, color: null },
    caption:      { fontSize: 10, fontFace: "Noto Sans JP", bold: false, color: null },
    footnote:     { fontSize: 8,  fontFace: "Noto Sans JP", bold: false, color: null },
  },

  // Spacing in inches (pptxgenjs uses inches)
  spacing: {
    slideMargin: { top: 0.5, left: 0.6, right: 0.6, bottom: 0.4 },
    titleGap: 0.2,
    contentPadding: 0.3,
    sidebarWidth: 1.5,
  },

  // Available layout types
  layouts: [
    "cover", "content", "section", "two-column",
    "image-full", "image-text", "table", "chart",
    "summary", "closing",
  ],

  // Component style tokens
  components: {
    table: {
      headerBg: "#4B5563",
      headerColor: "#FFFFFF",
      zebraEven: "#F9FAFB",
      zebraOdd: "#FFFFFF",
      borderColor: "#D1D5DB",
      borderWidth: 0.5,
    },
    badge: {
      bg: "#2563EB",
      color: "#FFFFFF",
      paddingTop: 0.03,
      paddingBottom: 0.03,
      paddingLeft: 0.1,
      paddingRight: 0.1,
      borderRadius: 0,
    },
    card: {
      bg: "#FFFFFF",
      borderColor: "#D1D5DB",
      borderWidth: 0.5,
      padding: 0.2,
    },
    highlightBox: {
      bg: "#EFF6FF",
      borderColor: "#1D4ED8",
      borderWidth: 1,
      padding: 0.2,
    },
    footer: {
      fontSize: 8,
      color: "#9CA3AF",
      marginBottom: 0.15,
      marginRight: 0.3,
    },
  },

  // Style modifier appended to image generation prompts
  imageStyle: "clean, minimal, professional illustration style, flat design, white background, no text in image",

  // Patterns to avoid (enforced by Claude Code)
  prohibited: [
    "No gradients",
    "No heavy shadows",
    "No emoji",
    "No hardcoded colors (use theme tokens)",
    "No excessive border-radius",
    "No decorative icons (data and logos only)",
    "No text-only slides",
    "No AI-generated text in images",
  ],
};

export default base;
