---
description: 既存のPPTX・PDFからデザイントークンを抽出してテーマを生成する
allowed-tools: Read, Write, Bash
---

# /genpptx:theme

既存のPPTX・PDFファイルからデザイントークン（色・フォント）を抽出してテーマファイルの雛形を生成します。

## 引数

- `<file-path>` — 参考にするファイルのパス（必須）。`.pptx` または `.pdf`
- `<theme-name>` — 生成するテーマ名（必須）

## 手順

1. **引数の確認**
   - `<file-path>` が存在することを確認する
   - 拡張子が `.pptx` または `.pdf` であることを確認する
   - `<theme-name>` がアルファベット・数字・ハイフンのみで構成されていることを確認する
   - どれかが不正な場合はエラーを報告して終了する

2. **デザイントークンの抽出**

   **PPTXの場合:**
   - プラグインのスクリプトディレクトリを特定し、コマンドを実行する:
     ```bash
     PLUGIN_DIR=$(find ~/.claude/plugins/cache -path "*/genpptx/*/plugin.json" 2>/dev/null | sort -r | head -1 | xargs dirname 2>/dev/null)
     bash "$PLUGIN_DIR/scripts/run.sh" read.mjs <file-path> --extract-theme <theme-name>
     ```
   - 抽出されたデザイントークン（Primary色・テキスト色・背景色・フォント名など）を表示する

   **PDFの場合:**
   - `Read` ツールを使ってPDFを読み取る（先頭5ページ程度で十分）
   - 視覚的に以下のデザイン要素を分析・推定する:
     - **背景色** — スライド/ページの地色
     - **Primary色** — タイトルや強調に使われている主要カラー
     - **テキスト色** — 本文テキストの色
     - **アクセント色** — グラフ・アイコン・ボーダー等に使われている色
     - **フォント** — タイトル・本文それぞれの書体（特定できる場合）
   - 抽出結果は目視分析に基づく推定値であることを明示する
   - 抽出したデザイントークンをもとに、プロジェクト内の `themes/<theme-name>.mjs` を直接生成する:
     - `themes/` ディレクトリが存在しない場合は `Bash` で `mkdir -p themes` して作成する
     - `themes/<theme-name>.mjs` を `Write` ツールで生成する
     - **必ず以下の完全なスタンドアロン形式を使う（`import` 文は一切書かない）**:
       ```javascript
       // Extracted from: <file-path>
       // Review and adjust values before use.

       const theme = {
         name: "<theme-name>",
         meta: {
           description: "Extracted from <filename>",
           source: "<file-path>",
         },

         presentation: {
           layout: "LAYOUT_WIDE",
           author: "",
         },

         colors: {
           primary:       "<extracted or #2563EB>",
           primaryLight:  "<lightened primary>",
           primaryBorder: "<darkened primary>",
           text:          "<extracted or #000000>",
           textSub:       "<extracted or #4B5563>",
           bg:            "<extracted or #FFFFFF>",
           surface:       "<extracted or #F9FAFB>",
           border:        "<extracted or #D1D5DB>",
           white:         "#FFFFFF",
         },

         typography: {
           coverTitle:   { fontSize: 36, fontFace: "<heading font>", bold: true,  color: null },
           pageTitle:    { fontSize: 24, fontFace: "<heading font>", bold: true,  color: null },
           sectionTitle: { fontSize: 20, fontFace: "<heading font>", bold: true,  color: null },
           heading:      { fontSize: 16, fontFace: "<heading font>", bold: true,  color: null },
           body:         { fontSize: 12, fontFace: "<body font>",    bold: false, color: null },
           caption:      { fontSize: 10, fontFace: "<body font>",    bold: false, color: null },
           footnote:     { fontSize: 8,  fontFace: "<body font>",    bold: false, color: null },
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
             headerBg:    "<textSub color>",
             headerColor: "#FFFFFF",
             zebraEven:   "<surface color>",
             zebraOdd:    "#FFFFFF",
             borderColor: "#D1D5DB",
             borderWidth: 0.5,
           },
           badge: {
             bg:            "<primary color>",
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
             bg:          "<primaryLight color>",
             borderColor: "<primaryBorder color>",
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
       ```
     - `<...>` のプレースホルダーを抽出した実際の値で置き換える

3. **完了報告と次のステップの案内**
   - 生成されたテーマファイルのパスを報告する:
     - `themes/<theme-name>.mjs`
   - PDFの場合は推定値が含まれる旨を案内し、確認・調整を促す
   - 以下の次のステップを案内する:
     1. `themes/<theme-name>.mjs` の内容を確認・調整する
     2. プラグインのスクリプトディレクトリを特定してカタログを確認する:
        ```bash
        PLUGIN_DIR=$(find ~/.claude/plugins/cache -path "*/genpptx/*/plugin.json" 2>/dev/null | sort -r | head -1 | xargs dirname 2>/dev/null)
        bash "$PLUGIN_DIR/scripts/run.sh" catalog.mjs --theme <theme-name>
        ```
   - テーマはプロジェクト内に保存されるため、プラグインを更新・再インストールしても失われないことを伝える

## 使用例

```
/genpptx:theme refs/sample.pptx my-theme
/genpptx:theme refs/corporate.pptx corporate-blue
/genpptx:theme refs/proposal.pdf proposal-theme
/genpptx:theme refs/brand-guide.pdf brand-colors
```
