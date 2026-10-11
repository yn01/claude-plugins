---
description: obsidian-archive の設定を表示・変更する
allowed-tools: Bash
argument-hint: "[<key> <value>]"
---
# /obsidian-archive:config

引数: `$ARGUMENTS`

## 引数がないとき — 表示

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" --data "${CLAUDE_PLUGIN_DATA}"
```

出力をそのまま見せます。`(default)` は既定値のままの項目です。`ignored` の行があれば、その設定はもう使われていないと伝えます。

## 引数があるとき — 変更

1 つ目の語がキー、残りが値です。値はそのまま渡します（引用符で 1 つにまとめる）。

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/config.mjs" --data "${CLAUDE_PLUGIN_DATA}" <key> "<value>"
```

スクリプトが型を判定して保存し、`前 → 後` を表示します。エラーならその内容を伝えます。

## 設定項目

| キー | 型 | 既定値 | 説明 |
|------|-----|-------|------|
| `vault_path` | string | `~/Documents/Obsidian/Claude-Dev` | Obsidian の vault のパス（`~` 可） |
| `folder` | string | `Summaries` | vault の中の保存フォルダ |
| `include_git_diff` | boolean | `true` | git の変更の節を付けるか |
| `tags` | array | `["claude-code", "session-summary"]` | `["a", "b"]` または `a, b` |
| `auto_save` | boolean | `true` | セッション終了時に自動で要約を保存するか |
| `auto_save_model` | string | `sonnet` | 自動保存の要約に使うモデル（`haiku` / `sonnet` / `opus` など） |

設定ファイルはプラグインのデータフォルダ（`${CLAUDE_PLUGIN_DATA}/config.json`）にあり、プラグインを更新しても消えません。
