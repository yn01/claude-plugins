---
description: 既存のPPTX・PDFファイルを読み取り内容を表示する
allowed-tools: Read, Bash
---

# /genpptx:read

既存のPPTX・PDFファイルを読み取り、スライド・ページ内容をわかりやすく表示します。ブラッシュアップや内容確認に使います。

## 引数

- `<file-path>` — 読み取るファイルのパス（必須）。`.pptx` または `.pdf`

## 手順

1. **ファイルの確認**
   - 引数で渡された `<file-path>` が存在することを確認する
   - 拡張子が `.pptx` または `.pdf` であることを確認する
   - それ以外の拡張子の場合はエラーを報告して終了する
   - ファイルが存在しない場合はエラーを報告して終了する

2. **ファイルの読み取り**

   **PPTXの場合:**
   - 以下のコマンドを実行する:
     ```bash
     node src/read.mjs <file-path>
     ```

   **PDFの場合:**
   - `Read` ツールを使ってPDFを読み取る
   - PDFが大きい場合（10ページ超）は `pages` パラメータで範囲を指定して分割読み取りする

3. **内容の整理と表示**
   - 以下の形式で整理して表示する:

   **PPTXの場合:**
   - スライド番号・タイトル・レイアウト
   - 各スライドのテキスト内容
   - スライド数の合計

   **PDFの場合:**
   - ページ番号・見出し（識別できる場合）
   - 各ページの主要テキスト内容
   - 総ページ数

   - 必要に応じて改善提案を行う

## 使用例

```
/genpptx:read output/my-project/presentation.pptx
/genpptx:read refs/sample.pptx
/genpptx:read refs/proposal.pdf
/genpptx:read refs/report.pdf
```
