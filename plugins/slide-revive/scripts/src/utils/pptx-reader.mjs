import fs from "fs";
import path from "path";
import JSZip from "jszip";
import { parseStringPromise } from "xml2js";

/**
 * Read and parse a PPTX file into a structured representation.
 * PPTX is a ZIP containing XML files.
 * @param {string} filePath - Path to the .pptx file
 * @returns {Promise<object>} Structured representation of the presentation
 */
export async function readPptx(filePath) {
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);

  const result = {
    file: filePath,
    slides: [],
    metadata: {},
  };

  // Read presentation metadata
  const coreXml = zip.file("docProps/core.xml");
  if (coreXml) {
    const coreContent = await coreXml.async("string");
    const coreParsed = await parseStringPromise(coreContent, { explicitArray: false });
    const props = coreParsed["cp:coreProperties"] || {};
    result.metadata = {
      title: props["dc:title"] || "",
      creator: props["dc:creator"] || "",
      lastModifiedBy: props["cp:lastModifiedBy"] || "",
      created: props["dcterms:created"]?._ || "",
      modified: props["dcterms:modified"]?._ || "",
    };
  }

  // Find all slide files
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => {
      const numA = parseInt(a.match(/slide(\d+)/)[1]);
      const numB = parseInt(b.match(/slide(\d+)/)[1]);
      return numA - numB;
    });

  result.slideCount = slideFiles.length;

  // Parse each slide
  for (const slideFile of slideFiles) {
    const slideContent = await zip.file(slideFile).async("string");
    const slideParsed = await parseStringPromise(slideContent, {
      explicitArray: false,
      preserveChildrenOrder: true,
    });

    const slideData = {
      number: parseInt(slideFile.match(/slide(\d+)/)[1]),
      texts: [],
      images: [],
      shapes: [],
    };

    // Extract text content recursively
    extractTexts(slideParsed, slideData.texts);

    // Extract images
    extractImages(slideParsed, slideData.images);

    result.slides.push(slideData);
  }

  return result;
}

/**
 * Recursively extract text elements from parsed XML.
 */
function extractTexts(obj, texts, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 20) return;

  // Look for text paragraphs (a:p -> a:r -> a:t)
  if (obj["a:t"] !== undefined) {
    const text = typeof obj["a:t"] === "string" ? obj["a:t"] : obj["a:t"]._ || "";
    if (text.trim()) {
      const props = obj["a:rPr"] || {};
      texts.push({
        content: text.trim(),
        bold: props.$?.b === "1",
        fontSize: props.$?.sz ? parseInt(props.$.sz) / 100 : null,
      });
    }
    return;
  }

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        extractTexts(item, texts, depth + 1);
      }
    } else if (typeof value === "object") {
      extractTexts(value, texts, depth + 1);
    }
  }
}

/**
 * Extract image references from parsed XML.
 */
function extractImages(obj, images, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 20) return;

  // Look for blip references (a:blip with r:embed)
  if (obj["a:blip"]) {
    const blip = obj["a:blip"];
    const embed = blip.$?.["r:embed"];
    if (embed) {
      images.push({ relationId: embed });
    }
  }

  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (Array.isArray(value)) {
      for (const item of value) {
        extractImages(item, images, depth + 1);
      }
    } else if (typeof value === "object") {
      extractImages(value, images, depth + 1);
    }
  }
}

/**
 * Extract design tokens (colors, fonts) from a PPTX file and generate
 * a theme skeleton .mjs file ready for customization.
 * @param {string} filePath - Path to the .pptx file
 * @param {string} themeName - Name for the new theme
 * @returns {Promise<object>} Extracted token data + generated source code
 */
export async function extractTheme(filePath, themeName = "extracted") {
  const data = fs.readFileSync(filePath);
  const zip = await JSZip.loadAsync(data);
  const basename = path.basename(filePath);

  const tokens = {
    colors: {},
    fonts: { major: null, minor: null },
    fontSizes: [],
  };

  // ── 1. Theme XML: color scheme + font scheme ──────────────────────────
  const themeFile =
    zip.file("ppt/theme/theme1.xml") ||
    zip.file("ppt/theme/Theme1.xml");

  if (themeFile) {
    const xml = await themeFile.async("string");
    const parsed = await parseStringPromise(xml, { explicitArray: false });
    const elements =
      parsed?.["a:theme"]?.["a:themeElements"] ||
      parsed?.["p:theme"]?.["a:themeElements"] ||
      {};

    // Color scheme
    const clr = elements["a:clrScheme"] || {};
    tokens.colors.dk1  = resolveColor(clr["a:dk1"]);
    tokens.colors.lt1  = resolveColor(clr["a:lt1"]);
    tokens.colors.dk2  = resolveColor(clr["a:dk2"]);
    tokens.colors.lt2  = resolveColor(clr["a:lt2"]);
    tokens.colors.acc1 = resolveColor(clr["a:accent1"]);
    tokens.colors.acc2 = resolveColor(clr["a:accent2"]);
    tokens.colors.acc3 = resolveColor(clr["a:accent3"]);

    // Font scheme
    const font = elements["a:fontScheme"] || {};
    tokens.fonts.major = font["a:majorFont"]?.["a:latin"]?.$?.typeface || null;
    tokens.fonts.minor = font["a:minorFont"]?.["a:latin"]?.$?.typeface || null;
  }

  // ── 2. Slide master: background color ────────────────────────────────
  const masterFile =
    zip.file("ppt/slideMasters/slideMaster1.xml") ||
    zip.file("ppt/slideMasters/SlideMaster1.xml");

  if (masterFile) {
    const xml = await masterFile.async("string");
    const parsed = await parseStringPromise(xml, { explicitArray: false });
    const bg = parsed?.["p:sldMaster"]?.["p:cSld"]?.["p:bg"];
    const solidFill = bg?.["p:bgPr"]?.["a:solidFill"] || bg?.["p:bgRef"];
    if (solidFill) {
      const c = resolveColor(solidFill);
      if (c) tokens.colors.masterBg = c;
    }
  }

  // ── 3. Scan slides: collect font sizes ───────────────────────────────
  const slideFiles = Object.keys(zip.files)
    .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
    .slice(0, 5); // sample first 5 slides

  const sizeMap = new Map(); // size → count
  for (const sf of slideFiles) {
    const xml = await zip.file(sf).async("string");
    const parsed = await parseStringPromise(xml, { explicitArray: false });
    collectFontSizes(parsed, sizeMap);
  }

  // Top sizes descending → map to typography roles
  tokens.fontSizes = Array.from(sizeMap.entries())
    .sort((a, b) => b[0] - a[0])
    .slice(0, 6)
    .map(([sz]) => sz);

  // ── 4. Build theme source code ────────────────────────────────────────
  const c = tokens.colors;
  const primary       = c.acc1  || "#2563EB";
  const text          = c.dk1   || "#000000";
  const bg            = c.lt1   || "#FFFFFF";
  const surface       = c.lt2   || "#F9FAFB";
  const textSub       = c.dk2   || "#4B5563";
  const primaryLight  = lighten(primary);
  const primaryBorder = darken(primary);

  const headingFont = tokens.fonts.major || "Noto Sans JP";
  const bodyFont    = tokens.fonts.minor || "Noto Sans JP";

  const [sz1 = 36, sz2 = 24, sz3 = 20, sz4 = 16, sz5 = 12, sz6 = 10] =
    tokens.fontSizes;

  const source = `// Auto-extracted from: ${basename}
// Review and adjust values before use.

const theme = {
  name: "${themeName}",
  meta: {
    description: "Extracted from ${basename}",
    source: "refs/${basename}",
  },

  presentation: {
    layout: "LAYOUT_WIDE",
    author: "",
  },

  colors: {
    primary:       "${primary}",
    primaryLight:  "${primaryLight}",
    primaryBorder: "${primaryBorder}",
    text:          "${text}",
    textSub:       "${textSub}",
    bg:            "${bg}",
    surface:       "${surface}",
    border:        "${c.acc3 || "#D1D5DB"}",
    white:         "#FFFFFF",
  },

  typography: {
    coverTitle:   { fontSize: ${sz1}, fontFace: "${headingFont}", bold: true,  color: null },
    pageTitle:    { fontSize: ${sz2}, fontFace: "${headingFont}", bold: true,  color: null },
    sectionTitle: { fontSize: ${sz3}, fontFace: "${headingFont}", bold: true,  color: null },
    heading:      { fontSize: ${sz4}, fontFace: "${headingFont}", bold: true,  color: null },
    body:         { fontSize: ${sz5}, fontFace: "${bodyFont}",    bold: false, color: null },
    caption:      { fontSize: ${sz6}, fontFace: "${bodyFont}",    bold: false, color: null },
    footnote:     { fontSize: 8,      fontFace: "${bodyFont}",    bold: false, color: null },
  },

  spacing: {
    slideMargin: { top: 0.5, left: 0.6, right: 0.6, bottom: 0.4 },
    titleGap: 0.2,
    contentPadding: 0.3,
    sidebarWidth: 1.5,
  },

  layouts: [
    "cover", "content", "section", "two-column",
    "image-full", "image-text", "table", "chart",
    "summary", "closing",
  ],

  components: {
    table: {
      headerBg:    "${textSub}",
      headerColor: "#FFFFFF",
      zebraEven:   "${surface}",
      zebraOdd:    "#FFFFFF",
      borderColor: "#D1D5DB",
      borderWidth: 0.5,
    },
    badge: {
      bg:            "${primary}",
      color:         "#FFFFFF",
      paddingTop:    0.03,
      paddingBottom: 0.03,
      paddingLeft:   0.1,
      paddingRight:  0.1,
      borderRadius:  0,
    },
    card: {
      bg:          "#FFFFFF",
      borderColor: "#D1D5DB",
      borderWidth: 0.5,
      padding:     0.2,
    },
    highlightBox: {
      bg:          "${primaryLight}",
      borderColor: "${primaryBorder}",
      borderWidth: 1,
      padding:     0.2,
    },
    footer: {
      fontSize:     8,
      color:        "#9CA3AF",
      marginBottom: 0.15,
      marginRight:  0.3,
    },
  },

  imageStyle: "clean, minimal, professional illustration style, flat design, white background, no text in image",

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

export default theme;
`;

  return {
    themeName,
    tokens,
    source,
    summary: {
      primary, text, bg, surface, textSub,
      headingFont, bodyFont,
      topFontSizes: tokens.fontSizes,
    },
  };
}

/** Resolve a color element to a hex string (#RRGGBB). */
function resolveColor(el) {
  if (!el || typeof el !== "object") return null;
  if (el["a:srgbClr"]) {
    const v = el["a:srgbClr"]?.$?.val;
    return v ? `#${v.toUpperCase()}` : null;
  }
  if (el["a:sysClr"]) {
    const v = el["a:sysClr"]?.$?.lastClr;
    return v ? `#${v.toUpperCase()}` : null;
  }
  // Some files nest differently
  const keys = Object.keys(el).filter((k) => k !== "$");
  for (const k of keys) {
    const result = resolveColor(el[k]);
    if (result) return result;
  }
  return null;
}

/** Collect font sizes (in pt) from parsed XML into a Map(size → count). */
function collectFontSizes(obj, map, depth = 0) {
  if (!obj || typeof obj !== "object" || depth > 25) return;
  if (obj["a:rPr"]?.$?.sz) {
    const sz = Math.round(parseInt(obj["a:rPr"].$.sz) / 100);
    if (sz >= 8 && sz <= 72) map.set(sz, (map.get(sz) || 0) + 1);
  }
  for (const v of Object.values(obj)) {
    if (Array.isArray(v)) v.forEach((i) => collectFontSizes(i, map, depth + 1));
    else if (typeof v === "object") collectFontSizes(v, map, depth + 1);
  }
}

/** Naive color lighten: blend toward white by 80%. */
function lighten(hex) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    Math.round(r + (255 - r) * 0.8),
    Math.round(g + (255 - g) * 0.8),
    Math.round(b + (255 - b) * 0.8)
  );
}

/** Naive color darken: blend toward black by 15%. */
function darken(hex) {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHex(
    Math.round(r * 0.85),
    Math.round(g * 0.85),
    Math.round(b * 0.85)
  );
}

function hexToRgb(hex) {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, "0").toUpperCase()).join("")}`;
}

/**
 * Format the parsed PPTX data as a readable summary.
 * @param {object} pptxData - Output from readPptx
 * @returns {string} Formatted summary
 */
export function formatSummary(pptxData) {
  const lines = [];
  lines.push(`File: ${pptxData.file}`);
  lines.push(`Slides: ${pptxData.slideCount}`);

  if (pptxData.metadata.title) {
    lines.push(`Title: ${pptxData.metadata.title}`);
  }
  if (pptxData.metadata.creator) {
    lines.push(`Author: ${pptxData.metadata.creator}`);
  }

  lines.push("");

  for (const slide of pptxData.slides) {
    lines.push(`--- Slide ${slide.number} ---`);
    if (slide.texts.length > 0) {
      for (const t of slide.texts) {
        const prefix = t.bold ? "[B] " : "    ";
        lines.push(`${prefix}${t.content}`);
      }
    } else {
      lines.push("    (no text)");
    }
    if (slide.images.length > 0) {
      lines.push(`    [Images: ${slide.images.length}]`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
