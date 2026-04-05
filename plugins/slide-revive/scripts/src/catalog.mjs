import fs from "fs";
import path from "path";
import { program } from "commander";
import PptxGenJS from "pptxgenjs";
import { getTheme, listThemes, loadProjectThemes } from "./themes/index.mjs";
import { listLayouts, getLayoutBuilder } from "./layouts/index.mjs";
import { exportToHtml } from "./html-export.mjs";

/**
 * Sample content for each layout — used in the catalog.
 * Demonstrates required fields and typical usage.
 */
const LAYOUT_META = {
  cover: {
    label: "表紙 (cover)",
    usage: "プレゼン冒頭の1枚。タイトル・サブタイトル・日付を配置。",
    spec: {
      layout: "cover",
      title: "プレゼンテーション タイトル",
      subtitle: "サブタイトル・発表日・担当者名",
      date: "2026-01-01",
    },
  },
  section: {
    label: "セクション区切り (section)",
    usage: "章の開始を示す区切りスライド。1セクション=1メッセージ。",
    spec: {
      layout: "section",
      title: "セクションタイトル",
      subtitle: "このセクションで伝えること",
    },
  },
  content: {
    label: "コンテンツ (content)",
    usage: "主張＋根拠の基本形。箇条書きは最大6行まで。",
    spec: {
      layout: "content",
      title: "コンテンツスライドのタイトル",
      bullets: [
        "箇条書き1 — 主張と根拠を1行で簡潔に",
        "箇条書き2 — 具体的な数値や事実を添える",
        "箇条書き3 — 最大6行まで（それ以上はスライドを分ける）",
      ],
    },
  },
  "two-column": {
    label: "2カラム比較 (two-column)",
    usage: "Before/After・A案vs B案など対比を見せる場面。",
    spec: {
      layout: "two-column",
      title: "導入前後の比較",
      left: {
        heading: "Before（現状）",
        bullets: ["課題A — 手作業で非効率", "課題B — 属人化が進む", "課題C — ミスが多い"],
      },
      right: {
        heading: "After（改善後）",
        bullets: ["解決策A — 自動化で効率化", "解決策B — 標準化で共有", "解決策C — チェックを自動化"],
      },
    },
  },
  table: {
    label: "テーブル (table)",
    usage: "数値・仕様の比較。最大6列×8行まで。",
    spec: {
      layout: "table",
      title: "機能別の導入効果",
      headers: ["対象業務", "現状", "改善策", "効果"],
      rows: [
        ["受注管理", "Excel手入力", "システム一元管理", "入力工数 60% 削減"],
        ["承認フロー", "メール往復", "ワークフロー自動化", "承認リード 50% 短縮"],
        ["月次レポート", "手作業で集計", "自動生成", "作業ゼロに"],
      ],
    },
  },
  "image-text": {
    label: "画像＋テキスト (image-text)",
    usage: "ビジュアルと説明文をセットで見せる場面。キーセクション向け。",
    spec: {
      layout: "image-text",
      title: "画像とテキストの組み合わせ",
      text: "左側に画像、右側に説明文が入ります。ビジュアルと説明を組み合わせることで訴求力が高まります。画像には image.path または image.prompt を指定します。",
    },
  },
  "image-full": {
    label: "全面画像 (image-full)",
    usage: "インパクトのある1枚絵・写真を全面表示する場面。",
    spec: {
      layout: "image-full",
      title: "全面画像スライド",
    },
  },
  chart: {
    label: "チャート (chart)",
    usage: "時系列・構成比データの可視化。bar / line / pie / doughnut に対応。",
    spec: {
      layout: "chart",
      title: "売上推移（四半期）",
      chartType: "bar",
      chartData: [
        { name: "売上（万円）", labels: ["Q1", "Q2", "Q3", "Q4"], values: [120, 150, 130, 190] },
      ],
    },
  },
  summary: {
    label: "まとめ (summary)",
    usage: "セクションのまとめ・クロージング前のポイント整理。",
    spec: {
      layout: "summary",
      title: "このセクションのまとめ",
      points: [
        { title: "ポイント1", description: "キーメッセージを1行で簡潔に" },
        { title: "ポイント2", description: "数値や具体的な根拠を添えて説明" },
        { title: "ポイント3", description: "次のアクションや依頼事項を明確に" },
      ],
    },
  },
  closing: {
    label: "クロージング (closing)",
    usage: "最終スライド1枚固定。お礼・連絡先・QA案内。",
    spec: {
      layout: "closing",
      title: "ご清聴ありがとうございました",
      subtitle: "ご質問・詳細なお見積はお気軽にご相談ください",
    },
  },
};

async function buildCatalog(options) {
  await loadProjectThemes();
  const themeName = options.theme || "base";
  const theme = getTheme(themeName);

  const outputDir = options.output
    ? path.resolve(options.output)
    : path.resolve("output/catalog");
  fs.mkdirSync(outputDir, { recursive: true });

  // Build slide list in canonical layout order
  const layouts = listLayouts();
  const slides = layouts
    .map((name) => LAYOUT_META[name])
    .filter(Boolean)
    .map((meta) => meta.spec);

  const spec = {
    theme: themeName,
    title: `テンプレートカタログ — ${themeName}`,
    slides,
  };

  console.log(`Theme: ${theme.name}`);
  console.log(`Layouts: ${layouts.length}`);
  console.log(`Output: ${outputDir}\n`);

  // Generate PPTX
  const pres = new PptxGenJS();
  pres.layout = theme.presentation.layout;
  pres.title = spec.title;

  const totalPages = slides.length;
  for (let i = 0; i < slides.length; i++) {
    const slideSpec = slides[i];
    const meta = LAYOUT_META[slideSpec.layout];
    const builder = getLayoutBuilder(slideSpec.layout);
    builder(pres, slideSpec, theme, i + 1, totalPages);
    console.log(`  [${i + 1}/${totalPages}] ${meta.label}`);
  }

  const pptxPath = path.join(outputDir, `catalog-${themeName}.pptx`);
  await pres.writeFile({ fileName: pptxPath });
  console.log(`\nGenerated: ${pptxPath}`);

  // Generate HTML
  const htmlPath = path.join(outputDir, `catalog-${themeName}.html`);
  exportToHtml(spec, theme, htmlPath);
  console.log(`Generated: ${htmlPath}`);

  // Print layout reference table
  if (!options.quiet) {
    console.log("\n--- Layout Reference ---");
    layouts.forEach((name) => {
      const meta = LAYOUT_META[name];
      if (meta) console.log(`  ${meta.label}\n    ${meta.usage}`);
    });
  }
}

// CLI
program
  .name("catalog")
  .description(
    "Generate a template catalog PPTX+HTML showing all available layouts"
  )
  .option("-t, --theme <name>", `Theme name (available: ${listThemes().join(", ")})`, "base")
  .option("-o, --output <dir>", "Output directory", "output/catalog")
  .option("-q, --quiet", "Suppress layout reference table")
  .action(async (options) => {
    try {
      await buildCatalog(options);
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  });

program.parse();
