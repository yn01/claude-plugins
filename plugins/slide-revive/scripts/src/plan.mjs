import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { program } from "commander";
import { createInterface } from "readline/promises";
import "dotenv/config";

const GUIDELINE_PATH = new URL("../docs/SLIDE_STRUCTURE_GUIDELINE.md", import.meta.url).pathname;
const MODEL = "claude-sonnet-4-6";

// Lazy init
let _anthropic = null;
async function getClient() {
  if (!_anthropic) {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error("Error: ANTHROPIC_API_KEY is not set in .env");
      process.exit(1);
    }
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    _anthropic = new Anthropic();
  }
  return _anthropic;
}

/**
 * Turn 1: Analyze content and produce a structure plan (intermediate JSON).
 */
async function analyzeContent(content, guideline, themeName, storyTypeOverride) {
  const client = await getClient();

  const storyTypeInstruction = storyTypeOverride
    ? `\n\nIMPORTANT: The user has forced the story type to "${storyTypeOverride}". You MUST use this story type regardless of content.`
    : "";

  const systemPrompt = `${guideline}${storyTypeInstruction}

You are a presentation structure specialist. Analyze the provided content and output a structure plan in the JSON format specified in Rule 7. Output JSON only — no preamble, no explanation, no markdown code blocks.`;

  const userMessage = `Theme: ${themeName}

Content to analyze:
---
${content}
---

Design the slide structure following the guidelines. Output the intermediate JSON only.`;

  console.log(`Analyzing content with Claude (${MODEL})...`);
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const rawText = response.content[0].text.trim();

  try {
    return JSON.parse(rawText);
  } catch {
    console.error("\nError: Claude did not return valid JSON. Raw response:");
    console.error(rawText);
    process.exit(1);
  }
}

/**
 * Turn 2: Convert the structure plan to spec.yaml.
 */
async function generateSpecYaml(content, guideline, structurePlan, themeName) {
  const client = await getClient();

  const systemPrompt = `${guideline}

You are a presentation structure specialist. Convert the provided structure plan into a spec.yaml file following the schema in Rule 5. Output YAML only — no preamble, no explanation, no markdown code blocks.`;

  const userMessage = `Theme: ${themeName}

Original content:
---
${content}
---

Approved structure plan (JSON):
${JSON.stringify(structurePlan, null, 2)}

Generate the complete spec.yaml based on this structure plan and the original content. Fill in all slide content (titles, bullets, text, etc.) from the original content. Output YAML only.`;

  console.log("Generating spec.yaml...");
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const rawText = response.content[0].text.trim();

  try {
    yaml.load(rawText); // validate
    return rawText;
  } catch {
    console.error("\nError: Claude did not return valid YAML. Raw response:");
    console.error(rawText);
    process.exit(1);
  }
}

/**
 * Format the structure plan for human review.
 */
function formatStructurePlan(plan) {
  const typeLabel = { A: "A. 課題解決型", B: "B. 比較優位型", C: "C. 成果逆算型" };
  const importanceLabel = { high: "★ キー（山）", low: "谷", bridge: "固定" };

  let lines = [];
  lines.push("─".repeat(60));
  lines.push("構成案");
  lines.push("─".repeat(60));
  lines.push(`ストーリー型: ${typeLabel[plan.storyType] || plan.storyType} — ${plan.storyTypeName}`);
  lines.push(`理由: ${plan.storyTypeReason}`);
  lines.push(`タイトル: ${plan.title}`);
  lines.push("");

  let totalSlides = 0;
  for (const section of plan.sections) {
    const label = importanceLabel[section.importance] || section.importance;
    const slideCount = section.slides.length;
    totalSlides += slideCount;

    if (section.sectionNumber === 0) {
      lines.push(`[全体像] ${section.message}（${slideCount}枚）`);
    } else {
      lines.push(`[Section ${section.sectionNumber}] ${section.sectionTitle}  [${label}]  ${slideCount}枚`);
      lines.push(`  → ${section.message}`);
    }

    for (const slide of section.slides) {
      const keyMark = slide.isKeySlide ? " ← キースライド" : "";
      lines.push(`    ${slide.layout.padEnd(12)} "${slide.title}"${keyMark}`);
    }
  }

  lines.push("");
  lines.push(`合計: ${totalSlides}枚`);
  lines.push("─".repeat(60));

  return lines.join("\n");
}

/**
 * Prompt user for confirmation.
 */
async function confirm(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim().toLowerCase();
}

/**
 * Main planning function.
 */
async function plan(contentPath, options) {
  // Read content
  if (!fs.existsSync(contentPath)) {
    console.error(`Error: Content file not found: ${contentPath}`);
    process.exit(1);
  }
  const content = fs.readFileSync(contentPath, "utf-8");

  // Read guideline
  const guideline = fs.readFileSync(GUIDELINE_PATH, "utf-8");

  const themeName = options.theme || "base";
  const storyTypeOverride = options.storyType || null;

  // Turn 1: Analyze content → intermediate JSON
  const structurePlan = await analyzeContent(content, guideline, themeName, storyTypeOverride);

  // Display structure plan
  console.log("\n" + formatStructurePlan(structurePlan));

  // Dry-run: stop here
  if (options.dryRun) {
    console.log("\n[dry-run] spec.yaml は生成されませんでした。");
    return;
  }

  // Confirm
  const answer = await confirm("\nこの構成で spec.yaml を生成しますか？ (y/n): ");
  if (answer !== "y" && answer !== "yes") {
    console.log("キャンセルしました。");
    return;
  }

  // Turn 2: Generate spec.yaml
  const specYaml = await generateSpecYaml(content, guideline, structurePlan, themeName);

  // Determine output path
  const contentDir = path.dirname(path.resolve(contentPath));
  const outputPath = options.output || path.join(contentDir, "spec.yaml");
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, specYaml, "utf-8");

  console.log(`\nWritten: ${outputPath}`);
  console.log(`Run: node src/generate.mjs ${outputPath}`);
}

// CLI
program
  .name("plan")
  .description("Generate spec.yaml from a content file using Claude")
  .argument("<content>", "Path to content file (markdown, text, etc.)")
  .option("-t, --theme <name>", "Theme name", "base")
  .option("-o, --output <path>", "Output spec.yaml path")
  .option("--story-type <type>", "Force story type: A, B, or C")
  .option("--dry-run", "Show structure plan only, do not write spec.yaml")
  .action(async (contentPath, options) => {
    try {
      await plan(contentPath, options);
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
