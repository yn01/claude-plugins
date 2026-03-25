---
description: 既存PPTXからデザイントークンを抽出してテーマを生成する
allowed-tools: Bash
---

# /genpptx:theme

既存のPPTXファイルからデザイントークン（色・フォント）を抽出してテーマファイルの雛形を生成します。

## 引数

- `<pptx-file-path>` — 参考にするPPTXファイルのパス（必須）
- `<theme-name>` — 生成するテーマ名（必須）

## 手順

1. **引数の確認**
   - `<pptx-file-path>` が存在することを確認する
   - `<theme-name>` がアルファベット・数字・ハイフンのみで構成されていることを確認する
   - どちらかが不正な場合はエラーを報告して終了する

2. **テーマ抽出コマンドの実行**
   - 以下のコマンドを実行する:
     ```bash
     node src/read.mjs <pptx-file-path> --extract-theme <theme-name>
     ```
   - 抽出されたデザイントークン（Primary色・テキスト色・背景色・フォント名など）を表示する

3. **完了報告と次のステップの案内**
   - 生成されたテーマファイルのパスを報告する:
     - `src/themes/<theme-name>.mjs`
   - 以下の次のステップを案内する:
     1. `src/themes/<theme-name>.mjs` の内容を確認・調整する
     2. `src/themes/index.mjs` にテーマを登録する（importとgetTheme関数への追加）
     3. `node src/catalog.mjs --theme <theme-name>` でカタログを確認する

## 使用例

```
/genpptx:theme refs/sample.pptx my-theme
/genpptx:theme refs/corporate.pptx corporate-blue
```
