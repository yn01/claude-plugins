import fs from "fs";
import path from "path";
import { program } from "commander";
import yaml from "js-yaml";
import { readPptx, formatSummary, extractTheme } from "./utils/pptx-reader.mjs";

program
  .name("read")
  .description("Read and analyze an existing PPTX file")
  .argument("<file>", "Path to .pptx file")
  .option("-f, --format <type>", "Output format: text, json, yaml", "text")
  .option(
    "--extract-theme [name]",
    "Extract design tokens and generate a theme .mjs skeleton"
  )
  .action(async (file, options) => {
    try {
      // ── Theme extraction mode ─────────────────────────────────────────
      if (options.extractTheme !== undefined) {
        const themeName =
          typeof options.extractTheme === "string" && options.extractTheme
            ? options.extractTheme
            : path.basename(file, ".pptx").toLowerCase().replace(/[^a-z0-9-]/g, "-");

        console.log(`Extracting design tokens from: ${file}`);
        console.log(`Theme name: ${themeName}\n`);

        const result = await extractTheme(file, themeName);

        // Print summary
        const s = result.summary;
        console.log("── Extracted Tokens ────────────────────────────");
        console.log(`  Primary:      ${s.primary}`);
        console.log(`  Text:         ${s.text}`);
        console.log(`  Background:   ${s.bg}`);
        console.log(`  Surface:      ${s.surface}`);
        console.log(`  Text (sub):   ${s.textSub}`);
        console.log(`  Heading font: ${s.headingFont}`);
        console.log(`  Body font:    ${s.bodyFont}`);
        console.log(`  Font sizes:   ${s.topFontSizes.join(", ")} pt`);
        console.log("────────────────────────────────────────────────\n");

        // Write theme file
        const outPath = path.resolve(`src/themes/${themeName}.mjs`);
        fs.writeFileSync(outPath, result.source, "utf-8");
        console.log(`Theme skeleton written: ${outPath}`);
        console.log(
          `\nNext steps:\n  1. Review and adjust values in ${outPath}\n  2. Register in src/themes/index.mjs\n  3. Run: node src/catalog.mjs --theme ${themeName}`
        );
        return;
      }

      // ── Standard read mode ────────────────────────────────────────────
      const data = await readPptx(file);

      switch (options.format) {
        case "json":
          console.log(JSON.stringify(data, null, 2));
          break;
        case "yaml":
          console.log(yaml.dump(data, { lineWidth: 120, noRefs: true }));
          break;
        default:
          console.log(formatSummary(data));
      }
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
