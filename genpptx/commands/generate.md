---
description: 既存のspec.yamlからPPTXとHTMLを生成する
allowed-tools: Read, Bash
---

# /genpptx:generate

既存の `spec.yaml` からPPTX・HTMLファイルを生成します。spec.yamlを手動で作成・編集した後に使います。

## 引数

- `<spec-yaml-path>` — spec.yaml のパス（必須）
- `--skip-html` — HTML出力をスキップする
- `--skip-images` — 画像生成をスキップする

## 手順

1. **spec.yaml の確認**
   - 引数で渡された `<spec-yaml-path>` が存在することを確認する
   - ファイルが存在しない場合はエラーを報告して終了する

2. **生成コマンドの実行**
   - まず、プラグインのスクリプトディレクトリを特定する:
     ```bash
     PLUGIN_DIR=$(find ~/.claude/plugins/cache -path "*/genpptx/*/plugin.json" 2>/dev/null | sort -r | head -1 | xargs dirname 2>/dev/null)
     ```
   - 以下のコマンドを実行する（オプションに応じて引数を追加）:
     ```bash
     bash "$PLUGIN_DIR/scripts/run.sh" generate.mjs <spec-yaml-path>
     ```
   - `--skip-html` が指定された場合:
     ```bash
     bash "$PLUGIN_DIR/scripts/run.sh" generate.mjs <spec-yaml-path> --skip-html
     ```
   - `--skip-images` が指定された場合:
     ```bash
     bash "$PLUGIN_DIR/scripts/run.sh" generate.mjs <spec-yaml-path> --skip-images
     ```
   - 両方指定された場合は両オプションを付けて実行する

3. **完了報告**
   - 生成されたファイルのパスを報告する
   - エラーが発生した場合はエラー内容を報告する

## 使用例

```
/genpptx:generate output/my-project/spec.yaml
/genpptx:generate output/my-project/spec.yaml --skip-html
/genpptx:generate output/my-project/spec.yaml --skip-images
```
