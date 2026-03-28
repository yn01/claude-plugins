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
   - 以下のコマンドを実行する:
     ```bash
     node src/read.mjs <file-path> --extract-theme <theme-name>
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
   - 抽出したデザイントークンをもとに `src/themes/<theme-name>.mjs` を直接生成する（PPTXと同様のフォーマット）

3. **完了報告と次のステップの案内**
   - 生成されたテーマファイルのパスを報告する:
     - `src/themes/<theme-name>.mjs`
   - PDFの場合は推定値が含まれる旨を案内し、確認・調整を促す
   - 以下の次のステップを案内する:
     1. `src/themes/<theme-name>.mjs` の内容を確認・調整する
     2. `src/themes/index.mjs` にテーマを登録する（importとgetTheme関数への追加）
     3. `node src/catalog.mjs --theme <theme-name>` でカタログを確認する

## 使用例

```
/genpptx:theme refs/sample.pptx my-theme
/genpptx:theme refs/corporate.pptx corporate-blue
/genpptx:theme refs/proposal.pdf proposal-theme
/genpptx:theme refs/brand-guide.pdf brand-colors
```
