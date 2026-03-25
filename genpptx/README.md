# genpptx

Claude Code プラグイン — コンテンツ（議事録・メモ）からPowerPointプレゼンテーションを自動生成します。

## 概要

`genpptx` は `../pptx` のPPTX生成システムをClaude Codeから手軽に使えるようにしたプラグインです。
コンテンツファイルを渡すだけで、AIがストーリー型のスライド構成を設計し、`spec.yaml` の生成から `.pptx` / `.html` の出力まで一気通貫で実行します。

## 前提条件

- **Node.js 18 以上**
- **PPTX生成システム** がプロジェクト内に存在すること
  - `src/generate.mjs`、`src/catalog.mjs`、`src/read.mjs` が利用可能な状態
  - `npm install` 済み

## インストール

```
/plugin marketplace add yn01/claude-plugins
/plugin install genpptx
```

## コマンド一覧

### `/genpptx:create` — コンテンツからPPTXを生成（メイン）

最も重要なコマンドです。コンテンツファイルを渡すだけで、スライド設計から生成まで自動で実行します。

```
/genpptx:create output/my-project/content.md
/genpptx:create output/my-project/content.md --theme corporate-yellow
```

**処理の流れ:**
1. コンテンツファイルを読み込む
2. `slide-designer` エージェントがストーリー型のスライド構成を設計
3. `output/<project-name>/spec.yaml` を生成
4. `node src/generate.mjs` を実行してPPTX・HTMLを生成
5. 生成ファイルのパスを報告

---

### `/genpptx:generate` — spec.yaml からPPTXを生成

既存の `spec.yaml` を手動で作成・編集した後に使います。

```
/genpptx:generate output/my-project/spec.yaml
/genpptx:generate output/my-project/spec.yaml --skip-html
/genpptx:generate output/my-project/spec.yaml --skip-images
```

---

### `/genpptx:catalog` — レイアウトカタログを生成

全10レイアウトのサンプルをPPTX+HTMLで確認できます。テーマ確認や新テーマ追加時に使います。

```
/genpptx:catalog
/genpptx:catalog --theme corporate-yellow
```

出力先: `output/catalog/catalog-<theme-name>.pptx` / `.html`

---

### `/genpptx:read` — 既存PPTXを読み取る

既存のPPTXファイルの内容をテキストで確認します。ブラッシュアップ・修正時に使います。

```
/genpptx:read output/my-project/presentation.pptx
/genpptx:read refs/sample.pptx
```

---

### `/genpptx:theme` — PPTXからテーマを抽出する

参考PPTXのデザイントークン（色・フォント）を抽出してテーマファイルの雛形を生成します。

```
/genpptx:theme refs/sample.pptx my-theme
/genpptx:theme refs/corporate.pptx corporate-blue
```

生成先: `src/themes/<theme-name>.mjs`（生成後に `src/themes/index.mjs` への登録が必要）

---

## 対応レイアウト一覧

| レイアウト | 用途 |
|-----------|------|
| `cover` | 表紙（1枚固定） |
| `section` | セクション区切り |
| `content` | 主張＋箇条書き（基本形） |
| `two-column` | Before/After・A vs B 比較 |
| `table` | 数値・仕様の比較（最大6列×8行） |
| `chart` | 時系列・構成比データ（bar/line/pie/doughnut） |
| `image-text` | 画像＋説明文 |
| `image-full` | 全面画像 |
| `summary` | セクションまとめ |
| `closing` | 最終スライド（1枚固定） |

## ワークフロー例

### content.md からPPTX生成（推奨フロー）

```
1. output/my-project/content.md を作成（議事録・メモをそのまま書く）

2. /genpptx:create output/my-project/content.md
   → slide-designer が構成を設計
   → output/my-project/spec.yaml が生成される
   → output/my-project/presentation.pptx + .html が生成される

3. ブラウザで output/my-project/presentation.html を開いて確認

4. 修正が必要なら output/my-project/spec.yaml を編集して:
   /genpptx:generate output/my-project/spec.yaml
```

### 新しいテーマを追加するフロー

```
1. /genpptx:theme refs/sample.pptx my-theme
   → src/themes/my-theme.mjs が生成される

2. src/themes/my-theme.mjs の色・フォントを調整

3. src/themes/index.mjs に登録

4. /genpptx:catalog --theme my-theme
   → output/catalog/catalog-my-theme.pptx でデザインを確認
```
