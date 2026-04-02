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

2. **テーマの確認と選択**
   - `--theme` が指定されている場合はこのステップをスキップする
   - `--theme` が指定されていない場合:
     - spec.yaml を読み込み、`theme:` フィールドがあれば「spec.yaml のテーマ `<name>` を使用します」と表示して続行する（プロンプトなし）
     - `theme:` フィールドがない場合、利用可能なテーマを列挙して選択を求める:
       ```bash
       PLUGIN_DIR=$(find ~/.claude/plugins/cache -path "*/genpptx/*/plugin.json" 2>/dev/null | sort -r | head -1 | xargs dirname 2>/dev/null)
       echo "=== 組み込みテーマ ===" && ls "$PLUGIN_DIR/scripts/src/themes/"*.mjs 2>/dev/null | grep -v index | xargs -I{} basename {} .mjs | sort
       echo "=== プロジェクトテーマ ===" && ls themes/*.mjs 2>/dev/null | xargs -I{} basename {} .mjs 2>/dev/null | sort || echo "(なし)"
       ```
     - 取得結果をもとに以下の形式でユーザーに提示する:
       ```
       利用可能なテーマ:
         [組み込み] base, corporate-yellow
         [プロジェクト] my-theme  ← themes/ に .mjs があれば表示、なければこの行を省く

       --theme が指定されていません。デフォルトは `base` です。
       このまま続行する場合は "continue"、別のテーマを使う場合はテーマ名を入力してください。
       ```
     - ユーザーの応答を受け取る:
       - `continue` または空 → テーマ名を `base` とする
       - テーマ名を入力 → そのテーマ名を使用する（一覧にないテーマ名はエラーを報告して再確認を求める）

3. **生成コマンドの実行**
   - まず、プラグインのスクリプトディレクトリを特定する:
     ```bash
     PLUGIN_DIR=$(find ~/.claude/plugins/cache -path "*/genpptx/*/plugin.json" 2>/dev/null | sort -r | head -1 | xargs dirname 2>/dev/null)
     ```
   - 手順2で確定したテーマ名を `--theme` に付けて実行する（spec.yaml に `theme:` があった場合も `--theme` で明示する）:
     ```bash
     bash "$PLUGIN_DIR/scripts/run.sh" generate.mjs <spec-yaml-path> --theme <theme-name>
     ```
   - `--skip-html` が指定された場合は `--skip-html` を追加する
   - `--skip-images` が指定された場合は `--skip-images` を追加する

4. **完了報告**
   - 生成されたファイルのパスを報告する
   - エラーが発生した場合はエラー内容を報告する

## 使用例

```
/genpptx:generate output/my-project/spec.yaml
/genpptx:generate output/my-project/spec.yaml --skip-html
/genpptx:generate output/my-project/spec.yaml --skip-images
```
