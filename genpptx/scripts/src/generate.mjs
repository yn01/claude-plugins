import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import PptxGenJS from "pptxgenjs";
import { program } from "commander";
import { getTheme, loadProjectThemes } from "./themes/index.mjs";
import { getLayoutBuilder } from "./layouts/index.mjs";
import { processImages } from "./image-gen.mjs";
import { exportToHtml } from "./html-export.mjs";

/**
 * Generate a PPTX presentation from a YAML spec file.
 * @param {string} specPath - Path to the YAML spec file
 * @param {object} options - CLI options
 */
async function generate(specPath, options) {
  // Read and parse spec
  const specContent = fs.readFileSync(specPath, "utf-8");
  const spec = yaml.load(specContent);

  // Resolve theme (load project-local themes first)
  await loadProjectThemes();
  const themeName = options.theme || spec.theme || "base";
  const theme = getTheme(themeName);
  console.log(`Theme: ${theme.name}`);

  // Determine output path
  const specDir = path.dirname(path.resolve(specPath));
  const outputPath = options.output || path.join(specDir, "presentation.pptx");
  const outputDir = path.dirname(outputPath);
  fs.mkdirSync(outputDir, { recursive: true });

  // Process images (generate via DALL-E if prompts exist and no --skip-images)
  if (!options.skipImages) {
    const hasImagePrompts = (spec.slides || []).some((s) => s.image?.prompt && !s.image?.path);
    if (hasImagePrompts) {
      console.log("Processing images...");
      await processImages(spec, specDir, theme);
    }
  }

  // Create presentation
  const pres = new PptxGenJS();
  pres.layout = theme.presentation.layout;
  if (spec.author || theme.presentation.author) {
    pres.author = spec.author || theme.presentation.author;
  }
  if (spec.title) {
    pres.title = spec.title;
  }

  // Build slides
  const slides = spec.slides || [];
  const totalPages = slides.length;
  console.log(`Building ${totalPages} slides...`);

  for (let i = 0; i < slides.length; i++) {
    const slideSpec = slides[i];
    const layoutName = slideSpec.layout || "content";
    const builder = getLayoutBuilder(layoutName);
    builder(pres, slideSpec, theme, i + 1, totalPages);
    console.log(`  [${i + 1}/${totalPages}] ${layoutName}: ${slideSpec.title || "(untitled)"}`);
  }

  // Write PPTX
  await pres.writeFile({ fileName: outputPath });
  console.log(`\nGenerated: ${outputPath}`);

  // Export HTML (for viewing without PowerPoint)
  if (!options.skipHtml) {
    const htmlPath = outputPath.replace(/\.pptx$/, ".html");
    exportToHtml(spec, theme, htmlPath);
    console.log(`Generated: ${htmlPath}`);
  }
}

// CLI
program
  .name("generate")
  .description("Generate PPTX from a YAML spec file")
  .argument("<spec>", "Path to YAML spec file")
  .option("-t, --theme <name>", "Override theme name")
  .option("-o, --output <path>", "Output file path")
  .option("--skip-images", "Skip image generation")
  .option("--skip-html", "Skip HTML export")
  .action(async (spec, options) => {
    try {
      await generate(spec, options);
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
