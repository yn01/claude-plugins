---
description: コンテンツファイルからspec.yamlを設計してPPTXを生成する
allowed-tools: Read, Write, Bash, Glob, Agent
---

# /genpptx:create

コンテンツファイル（議事録・メモ）からPowerPointプレゼンテーションを生成します。

## 引数

- `<content-file>` — 元になるコンテンツファイルのパス（必須）
- `--theme <theme-name>` — 使用するテーマ名（省略時: base）

## 手順

1. **コンテンツファイルの読み込み**
   - 引数で渡された `<content-file>` を読み込む
   - ファイルが存在しない場合はエラーを報告して終了する
   - `project-name` はコンテンツファイルの親ディレクトリ名とする
     - 例: `output/my-project/content.md` → `project-name = my-project`
     - 親ディレクトリ名が取れない場合はファイル名（拡張子除く）を使う

2. **slide-designer エージェントの呼び出し**
   - `genpptx:slide-designer` エージェントを呼び出す
   - 以下の情報を渡す:
     - コンテンツファイルの内容
     - 出力先: `output/<project-name>/spec.yaml`
     - テーマ名（`--theme` で指定された場合はその値、省略時は `base`）
   - エージェントが `output/<project-name>/spec.yaml` を生成するまで待機する

3. **PPTX・HTML の生成**
   - spec.yaml が生成されたことを確認する
   - 以下のコマンドを実行する:
     ```bash
     node src/generate.mjs output/<project-name>/spec.yaml
     ```
   - エラーが発生した場合はエラー内容を報告して終了する

4. **完了報告**
   - 生成されたファイルのパスを報告する:
     - `output/<project-name>/presentation.pptx`
     - `output/<project-name>/presentation.html`
   - HTMLファイルをブラウザで開くか案内する

## 使用例

```
/genpptx:create output/my-project/content.md
/genpptx:create output/my-project/content.md --theme corporate-yellow
```
