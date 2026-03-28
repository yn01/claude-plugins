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
   - 抽出したデザイントークンをもとに、プラグインキャッシュ内のテーマファイルを直接生成する（PPTXと同様のフォーマット）:
     ```bash
     PLUGIN_DIR=$(find ~/.claude/plugins/cache -path "*/genpptx/*/plugin.json" 2>/dev/null | sort -r | head -1 | xargs dirname 2>/dev/null)
     ```
     - `$PLUGIN_DIR/scripts/src/themes/<theme-name>.mjs` にテーマファイルを生成する（`Write` ツールを使う）
     - `$PLUGIN_DIR/scripts/src/themes/index.mjs` にテーマを登録する（importとthemes.setへの追加）

3. **完了報告と次のステップの案内**
   - 生成されたテーマファイルのパスを報告する:
     - `$PLUGIN_DIR/scripts/src/themes/<theme-name>.mjs`
   - PDFの場合は推定値が含まれる旨を案内し、確認・調整を促す
   - 以下の次のステップを案内する:
     1. `$PLUGIN_DIR/scripts/src/themes/<theme-name>.mjs` の内容を確認・調整する
     2. `bash "$PLUGIN_DIR/scripts/run.sh" catalog.mjs --theme <theme-name>` でカタログを確認する
   - **注意**: プラグインを再インストール・アップデートするとカスタムテーマは消えます。テーマファイルのコピーをプロジェクト内に保存しておくことを推奨する

## 使用例

```
/genpptx:theme refs/sample.pptx my-theme
/genpptx:theme refs/corporate.pptx corporate-blue
/genpptx:theme refs/proposal.pdf proposal-theme
/genpptx:theme refs/brand-guide.pdf brand-colors
```
