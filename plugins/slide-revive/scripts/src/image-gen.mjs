import fs from "fs";
import path from "path";
import crypto from "crypto";
import "dotenv/config";

let _openai = null;
async function getClient() {
  if (!_openai) {
    const { default: OpenAI } = await import("openai");
    _openai = new OpenAI();
  }
  return _openai;
}

/**
 * Generate an image using OpenAI DALL-E.
 * Results are cached by prompt hash to avoid regeneration.
 *
 * @param {object} options
 * @param {string} options.prompt - Image generation prompt
 * @param {string} [options.size="1792x1024"] - Image size
 * @param {string} options.outputDir - Directory to save the image
 * @param {object} [options.theme] - Theme object (for imageStyle)
 * @param {string} [options.model="dall-e-3"] - Model to use
 * @returns {Promise<string>} Path to the generated image
 */
export async function generateImage({ prompt, size, outputDir, theme, model }) {
  // Enhance prompt with theme style
  let fullPrompt = prompt;
  if (theme?.imageStyle) {
    fullPrompt = `${prompt}. Style: ${theme.imageStyle}`;
  }

  // Check cache
  const hash = crypto.createHash("sha256").update(fullPrompt).digest("hex").slice(0, 16);
  const cachedPath = path.join(outputDir, `${hash}.png`);
  if (fs.existsSync(cachedPath)) {
    console.log(`  Image cached: ${cachedPath}`);
    return cachedPath;
  }

  // Ensure output directory exists
  fs.mkdirSync(outputDir, { recursive: true });

  // Generate image
  console.log(`  Generating image: "${prompt.slice(0, 60)}..."`);
  const openai = await getClient();
  const response = await openai.images.generate({
    model: model || "dall-e-3",
    prompt: fullPrompt,
    n: 1,
    size: size || "1792x1024",
    response_format: "b64_json",
  });

  // Save image
  const imageData = response.data[0].b64_json;
  const buffer = Buffer.from(imageData, "base64");
  fs.writeFileSync(cachedPath, buffer);
  console.log(`  Image saved: ${cachedPath}`);

  return cachedPath;
}

/**
 * Process all image prompts in a spec's slides.
 * @param {object} spec - Parsed YAML spec
 * @param {string} outputDir - Base output directory
 * @param {object} theme - Theme object
 * @returns {Promise<object>} Updated spec with generatedPath fields
 */
export async function processImages(spec, outputDir, theme) {
  const imagesDir = path.join(outputDir, "images");
  const slides = spec.slides || [];

  for (const slideSpec of slides) {
    if (slideSpec.image?.prompt && !slideSpec.image.path) {
      try {
        const imagePath = await generateImage({
          prompt: slideSpec.image.prompt,
          outputDir: imagesDir,
          theme,
          size: slideSpec.image.size,
        });
        slideSpec.image.generatedPath = imagePath;
      } catch (err) {
        console.error(`  Image generation failed: ${err.message}`);
      }
    }
  }

  return spec;
}
