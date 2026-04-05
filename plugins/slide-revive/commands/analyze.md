---
description: PDFをVision AIで解析してspec.yamlを生成する（PPTX生成はしない）
allowed-tools: Read, Write, Bash
argument-hint: "<pdf-path> [--theme <theme-name>] [--output <output-dir>]"
---

# /slide-revive:analyze

NotebookLMが生成したPDFをVision AIで解析し、`spec.yaml` を生成するが、PPTX生成は行わない。生成した `spec.yaml` を手動で確認・編集してから `/slide-revive:convert` で改めて生成する用途に使う。

## 引数

- `<pdf-path>` — 入力PDFファイルのパス（必須）
- `--theme <theme-name>` — テーマ名（デフォルト: base）
- `--output <output-dir>` — 出力ディレクトリ（デフォルト: カレントディレクトリ直下の `output/<pdf-basename>/`）

## 手順

### Step 1: 引数のパース

引数から以下を取得する:
- `PDF_PATH`: 最初の引数（必須）
- `THEME`: `--theme` の値（省略時は `base`）
- `OUTPUT_BASE`: `--output` の値（省略時は `output/<pdf-basename>/`）

PDFファイルの存在を確認する:

```bash
[ -f "<PDF_PATH>" ] && echo "OK" || echo "ERROR: ファイルが見つかりません: <PDF_PATH>"
```

存在しない場合はエラーを表示して終了する。

`PDF_BASENAME` = PDFファイル名（拡張子なし）。

### Step 2: プラグインディレクトリの特定

```bash
SLIDE_REVIVE_DIR=$(find ~/.claude/plugins/cache -path "*/slide-revive/*/plugin.json" 2>/dev/null | sort -r | head -1 | xargs dirname 2>/dev/null | xargs dirname 2>/dev/null)
echo "slide-revive: $SLIDE_REVIVE_DIR"
```

`SLIDE_REVIVE_DIR` が空の場合は以下を表示して終了する:

```
❌ エラー: slide-reviveプラグインのディレクトリが特定できません。
プラグインが正しくインストールされているか確認してください。
```

### Step 3: PDFページを画像として抽出

一時ディレクトリを作成し、PDFの各ページをPNG画像として抽出する:

```bash
EXTRACT_TMPDIR=$(python3 -c "import tempfile; print(tempfile.mkdtemp())")
python3 "$SLIDE_REVIVE_DIR/src/extract_pages.py" "<PDF_PATH>" --output-dir "$EXTRACT_TMPDIR" --dpi 150
```

出力されたJSONを解析して以下を取得する:
- `TOTAL_PAGES`: 総ページ数
- `PAGES`: 各ページ画像のファイルパスの配列

エラーが発生した場合はエラーメッセージをそのまま表示して終了する。

「PDFから `<TOTAL_PAGES>` ページを抽出しました。Vision AIで解析します...」と表示する。

### Step 4: 各スライドをVision AIで解析

抽出された各ページ画像を順番に `Read` ツールで読み込み、スライドの構造を解析してJSONオブジェクトを生成する。

**各スライドの解析手順:**

1. `Read` ツールで画像ファイルを開いて内容を確認する
2. 以下のJSONフォーマットでスライドの構造を記述する

**出力JSONスキーマ（各スライドごと）:**

```json
{
  "slide_number": <ページ番号>,
  "layout_type": "<レイアウトタイプ>",
  "title": "<スライドのタイトルテキスト>",
  "subtitle": "<サブタイトル（存在する場合のみ）>",
  "body_text": "<主要な本文テキスト（箇条書きに変換できない場合）>",
  "bullets": ["<箇条書き項目1>", "<箇条書き項目2>"],
  "headers": ["<テーブルヘッダー1>", "<テーブルヘッダー2>"],
  "rows": [["<セル1-1>", "<セル1-2>"], ["<セル2-1>", "<セル2-2>"]],
  "left_column": {"heading": "<左カラム見出し>", "bullets": ["<左項目1>"]},
  "right_column": {"heading": "<右カラム見出し>", "bullets": ["<右項目1>"]},
  "points": [{"title": "<ポイント名>", "description": "<説明文>"}],
  "notes": "<再現不要な要素のメモ（ロゴ・装飾的アイコン等）>"
}
```

**`layout_type` の選択基準:**

| layout_type | 使用条件 |
|-------------|---------|
| `cover` | タイトルスライド（大きなタイトル＋サブタイトルが中央） |
| `section` | セクション区切り・チャプター見出しのみ |
| `content` | 箇条書き・フロー図・同心円・アーキテクチャ図・3カラムカード（テキスト中心） |
| `two_column` | 明確な左右2カラム比較 |
| `table` | 行と列で構成される比較表・データグリッド |
| `timeline` | フェーズ・ロードマップ・時系列（contentにマッピングされる） |
| `summary` | まとめ・キーポイント・Proofリスト |
| `closing` | 最終スライド・クロージング |

**解析上の注意:**
- 日本語テキストはそのまま正確に書き起こす
- フロー図・同心円図・アーキテクチャ図は `content` レイアウトで各要素を `bullets` に記述
- テーブルは `headers` と `rows` を正確に転記する

全スライドの解析が完了したら、すべてのJSONオブジェクトを配列にまとめる。

### Step 5: 解析結果をJSONファイルに保存

上記で生成したJSON配列を `Write` ツールを使って保存する:
- 保存先: `$EXTRACT_TMPDIR/analyses.json`
- 内容: 全スライドのJSONオブジェクトの配列

### Step 6: spec.yamlを生成

出力ディレクトリ: `<OUTPUT_BASE>` が指定された場合はそのディレクトリ、指定がない場合は `output/<PDF_BASENAME>/`

```bash
python3 "$SLIDE_REVIVE_DIR/src/to_spec.py" \
  "$EXTRACT_TMPDIR/analyses.json" \
  "<OUTPUT_DIR>/spec.yaml" \
  --theme "<THEME>" \
  --title "<PDF_BASENAME>"
```

### Step 7: 完了報告

以下の形式で結果を報告し、次のステップを案内する:

```
✅ 解析完了！
══════════════════════════════════════
  Spec : <OUTPUT_DIR>/spec.yaml
══════════════════════════════════════
spec.yaml を確認・編集してから、以下のコマンドでPPTXを生成してください:

  SLIDE_REVIVE_DIR=$(find ~/.claude/plugins/cache -path "*/slide-revive/*/plugin.json" 2>/dev/null | sort -r | head -1 | xargs dirname 2>/dev/null | xargs dirname 2>/dev/null)
  bash "$SLIDE_REVIVE_DIR/scripts/run.sh" generate.mjs <OUTPUT_DIR>/spec.yaml --skip-images
```

## 使用例

```
/slide-revive:analyze path/to/notebooklm-output.pdf
/slide-revive:analyze path/to/notebooklm-output.pdf --theme corporate-yellow
/slide-revive:analyze path/to/notebooklm-output.pdf --output output/draft/
```
