---
description: 全レイアウトのサンプルカタログを生成する
allowed-tools: Bash
---

# /genpptx:catalog

全10レイアウトのサンプルをPPTX+HTMLで生成します。テーマの確認や新テーマ追加時の検証に使います。

## 引数

- `--theme <theme-name>` — 使用するテーマ名（省略時: base）

## 手順

1. **カタログ生成コマンドの実行**
   - テーマ指定なしの場合:
     ```bash
     node src/catalog.mjs
     ```
   - `--theme <theme-name>` が指定された場合:
     ```bash
     node src/catalog.mjs --theme <theme-name>
     ```

2. **完了報告**
   - `output/catalog/` 配下に生成されたファイル一覧を報告する:
     - `output/catalog/catalog-<theme-name>.pptx`
     - `output/catalog/catalog-<theme-name>.html`
   - 各レイアウトの用途をあわせて案内する

## 使用例

```
/genpptx:catalog
/genpptx:catalog --theme corporate-yellow
```
