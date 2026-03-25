---
description: 既存のPPTXファイルを読み取り内容を表示する
allowed-tools: Bash
---

# /genpptx:read

既存のPPTXファイルを読み取り、スライド内容をわかりやすく表示します。ブラッシュアップや内容確認に使います。

## 引数

- `<pptx-file-path>` — 読み取るPPTXファイルのパス（必須）

## 手順

1. **ファイルの確認**
   - 引数で渡された `<pptx-file-path>` が存在することを確認する
   - 拡張子が `.pptx` であることを確認する
   - ファイルが存在しない場合はエラーを報告して終了する

2. **PPTXの読み取り**
   - 以下のコマンドを実行する:
     ```bash
     node src/read.mjs <pptx-file-path>
     ```

3. **内容の整理と表示**
   - 出力されたスライド内容を以下の形式で整理して表示する:
     - スライド番号・タイトル・レイアウト
     - 各スライドのテキスト内容
     - スライド数の合計
   - 必要に応じて改善提案を行う

## 使用例

```
/genpptx:read output/my-project/presentation.pptx
/genpptx:read refs/sample.pptx
```
