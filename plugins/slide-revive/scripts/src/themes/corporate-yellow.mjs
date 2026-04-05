import base from "./base.mjs";

/**
 * Corporate Yellow theme
 * Ported from the slides project SLIDE_SYSTEM.md (Nikon-inspired design).
 * Sharp, data-heavy corporate style with yellow accent.
 */
const corporateYellow = {
  ...base,
  name: "corporate-yellow",
  meta: {
    description: "Sharp, data-heavy corporate style with yellow accent",
    source: "refs/26third_all.pdf (Nikon financial report)",
  },

  colors: {
    ...base.colors,
    primary:       "#FFE100",
    primaryLight:  "#FFFCE6",
    primaryBorder: "#E6CB00",
    text:          "#000000",
    textSub:       "#3D3D3D",
    bg:            "#FFFFFF",
    surface:       "#F7F7F7",
    border:        "#D0D0D0",
  },

  typography: {
    coverTitle:   { fontSize: 36, fontFace: "Noto Sans JP", bold: true, color: "#000000" },
    pageTitle:    { fontSize: 24, fontFace: "Noto Sans JP", bold: true, color: "#000000" },
    sectionTitle: { fontSize: 20, fontFace: "Noto Sans JP", bold: true, color: "#000000" },
    heading:      { fontSize: 16, fontFace: "Noto Sans JP", bold: true, color: "#000000" },
    body:         { fontSize: 12, fontFace: "Noto Sans JP", bold: false, color: "#000000" },
    caption:      { fontSize: 10, fontFace: "Noto Sans JP", bold: false, color: "#3D3D3D" },
    footnote:     { fontSize: 8,  fontFace: "Noto Sans JP", bold: false, color: "#3D3D3D" },
  },

  spacing: {
    ...base.spacing,
    slideMargin: { top: 0.5, left: 0.6, right: 0.6, bottom: 0.4 },
    sidebarWidth: 1.2,
  },

  components: {
    ...base.components,
    table: {
      headerBg: "#3D3D3D",
      headerColor: "#FFFFFF",
      zebraEven: "#F7F7F7",
      zebraOdd: "#FFFFFF",
      borderColor: "#D0D0D0",
      borderWidth: 0.5,
    },
    badge: {
      bg: "#FFE100",
      color: "#000000",
      paddingTop: 0.03,
      paddingBottom: 0.03,
      paddingLeft: 0.1,
      paddingRight: 0.1,
      borderRadius: 0,
    },
    card: {
      bg: "#FFFFFF",
      borderColor: "#D0D0D0",
      borderWidth: 0.5,
      padding: 0.2,
    },
    highlightBox: {
      bg: "#FFFCE6",
      borderColor: "#E6CB00",
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

  imageStyle: "clean, minimal, professional illustration, flat design, corporate style, white background, yellow accent color #FFE100, no text in image",

  prohibited: [
    "No gradients",
    "No heavy shadows (shadow-sm maximum)",
    "No emoji",
    "No border-left color bars",
    "No hardcoded colors (use theme tokens)",
    "No excessive border-radius (badges and borders must have radius: 0)",
    "No decorative icons/illustrations (data and logos only)",
    "White background base - no heavy background colors",
    "No top color bar",
    "No text-only slides",
  ],
};

export default corporateYellow;
