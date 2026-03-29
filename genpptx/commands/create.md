---
description: コンテンツファイルからspec.yamlを設計してPPTXを生成する
allowed-tools: Read, Write, Bash, Glob, Agent
---

# /genpptx:create

コンテンツファイル（議事録・メモ）からPowerPointプレゼンテーションを生成します。

## 引数

- `<content-file>` — 元になるコンテンツファイルのパス（必須）
- `--theme <theme-name>` — 使用するテーマ名（省略時: base）
- `--story-type <A|B|C>` — ストーリー型を強制指定（省略時: エージェントが自動選択）
  - `A` : 課題解決型（Pain→Solution→Evidence）— 提案・商談・プロダクト紹介
  - `B` : 比較優位型（現状→選択肢→なぜ自社か）— コンペ・切り替え提案
  - `C` : 成果逆算型（理想の姿→ギャップ→ロードマップ）— 中長期提案・経営層向け

## 手順

1. **コンテンツファイルの読み込み**
   - 引数で渡された `<content-file>` を読み込む
   - ファイルが存在しない場合はエラーを報告して終了する
   - `project-name` はコンテンツファイルの親ディレクトリ名とする
     - 例: `output/my-project/content.md` → `project-name = my-project`
     - 親ディレクトリ名が取れない場合はファイル名（拡張子除く）を使う

2. **テーマの確認と選択**
   - `--theme` が指定されている場合はこのステップをスキップする
   - `--theme` が指定されていない場合、利用可能なテーマを列挙して選択を求める:
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

3. **slide-designer エージェントの呼び出し**
   - `genpptx:slide-designer` エージェントを呼び出す
   - 以下の情報を渡す:
     - コンテンツファイルの内容
     - 出力先: `output/<project-name>/spec.yaml`
     - テーマ名（手順2で確定したテーマ名）
     - ストーリー型（`--story-type` で指定された場合は「ストーリー型を X に固定してください」と明示して渡す）
   - エージェントが `output/<project-name>/spec.yaml` を生成するまで待機する

4. **PPTX・HTML の生成**
   - spec.yaml が生成されたことを確認する
   - プラグインのスクリプトディレクトリを特定し、生成コマンドを実行する:
     ```bash
     PLUGIN_DIR=$(find ~/.claude/plugins/cache -path "*/genpptx/*/plugin.json" 2>/dev/null | sort -r | head -1 | xargs dirname 2>/dev/null)
     bash "$PLUGIN_DIR/scripts/run.sh" generate.mjs output/<project-name>/spec.yaml
     ```
   - エラーが発生した場合はエラー内容を報告して終了する

5. **完了報告**
   - 生成されたファイルのパスを報告する:
     - `output/<project-name>/presentation.pptx`
     - `output/<project-name>/presentation.html`
   - HTMLファイルをブラウザで開くか案内する

## 使用例

```
/genpptx:create output/my-project/content.md
/genpptx:create output/my-project/content.md --theme corporate-yellow
/genpptx:create output/my-project/content.md --story-type A
/genpptx:create output/my-project/content.md --theme corporate-yellow --story-type B
```
