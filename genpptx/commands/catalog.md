---
description: 全レイアウトのサンプルカタログを生成する
allowed-tools: Bash
---

# /genpptx:catalog

全10レイアウトのサンプルをPPTX+HTMLで生成します。テーマの確認や新テーマ追加時の検証に使います。

## 引数

- `--theme <theme-name>` — 使用するテーマ名（省略時: base）
- `--output <dir>` — 出力先ディレクトリ（省略時: `output/catalog`）
- `--quiet` — レイアウト参照表の出力を抑制する

## 手順

1. **カタログ生成コマンドの実行**
   - まず、プラグインのスクリプトディレクトリを特定する:
     ```bash
     PLUGIN_DIR=$(find ~/.claude/plugins/cache -path "*/genpptx/*/plugin.json" 2>/dev/null | sort -r | head -1 | xargs dirname 2>/dev/null)
     ```
   - 引数に応じて以下のようにオプションを組み合わせて実行する:
     ```bash
     bash "$PLUGIN_DIR/scripts/run.sh" catalog.mjs [--theme <theme-name>] [--output <dir>] [--quiet]
     ```
   - 例:
     ```bash
     bash "$PLUGIN_DIR/scripts/run.sh" catalog.mjs
     bash "$PLUGIN_DIR/scripts/run.sh" catalog.mjs --theme corporate-yellow
     bash "$PLUGIN_DIR/scripts/run.sh" catalog.mjs --theme corporate-yellow --output output/my-catalog
     bash "$PLUGIN_DIR/scripts/run.sh" catalog.mjs --quiet
     ```

2. **完了報告**
   - 生成されたファイルのパスを報告する:
     - `<output-dir>/catalog-<theme-name>.pptx`
     - `<output-dir>/catalog-<theme-name>.html`
   - `--quiet` が指定されていない場合は、以下のレイアウト参照表もあわせて案内する:

     | レイアウト | 用途 |
     |-----------|------|
     | `cover` | 表紙（1枚固定、冒頭に必ず配置） |
     | `section` | セクション区切り（章の開始） |
     | `content` | 主張＋箇条書き（基本形） |
     | `two-column` | Before/After・A vs B 比較 |
     | `table` | 数値・仕様の比較（最大6列×8行） |
     | `chart` | 時系列・構成比データ（bar/line/pie/doughnut） |
     | `image-text` | 画像＋説明文 |
     | `image-full` | 全面画像 |
     | `summary` | セクションまとめ・ポイント整理 |
     | `closing` | 最終スライド（1枚固定、末尾に必ず配置） |

## 使用例

```
/genpptx:catalog
/genpptx:catalog --theme corporate-yellow
/genpptx:catalog --theme corporate-yellow --output output/my-catalog
/genpptx:catalog --quiet
```
