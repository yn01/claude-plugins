# obsidian-archive

Claude Codeのセッションサマリーを自動生成してObsidianに保存するClaude Codeプラグインです。

## 概要

`obsidian-archive` は以下の機能を提供します:

- **自動保存**: Claude Codeセッション終了時に自動的にサマリーを生成してObsidianに保存
- **定期中間保存**: 設定した間隔（デフォルト30分）ごとに中間保存を実行
- **手動保存**: `/obsidian-archive:archive` コマンドで任意のタイミングで保存
- **設定管理**: `/obsidian-archive:config` コマンドで設定を確認・変更

## インストール方法

```
/plugin marketplace add yn01/obsidian-archive
```

## 初期設定

インストール後、まず `vault_path` をあなたのObsidian Vaultのパスに変更してください。

```
/obsidian-archive:config vault_path ~/Documents/Obsidian/MyVault
```

設定確認:

```
/obsidian-archive:config
```

## コマンド一覧

### `/obsidian-archive:archive`

現在のセッションのサマリーを即座に生成してObsidianに保存します。

```
/obsidian-archive:archive
```

**出力例:**
```
✓ セッションサマリーを保存しました:
  ~/Documents/Obsidian/Claude-Dev/Sessions/2026-03-18_14-30_my-project.md
```

### `/obsidian-archive:config`

設定の確認・更新を行います。

```
# 設定の表示
/obsidian-archive:config

# 設定の更新
/obsidian-archive:config <key> <value>
```

**使用例:**
```
/obsidian-archive:config vault_path ~/Documents/Obsidian/MyVault
/obsidian-archive:config folder WorkSessions
/obsidian-archive:config auto_save_interval_minutes 60
/obsidian-archive:config include_git_diff false
```

## 設定項目（obsidian-archive.json）

プラグインディレクトリの `obsidian-archive.json` で設定を管理します。

```json
{
  "vault_path": "~/Documents/Obsidian/Claude-Dev",
  "folder": "Sessions",
  "filename_format": "YYYY-MM-DD_HH-mm_{project}",
  "auto_save_interval_minutes": 30,
  "include_git_diff": true,
  "tags": ["claude-code", "session"]
}
```

| キー | 型 | デフォルト値 | 説明 |
|------|-----|-------------|------|
| `vault_path` | string | `~/Documents/Obsidian/Claude-Dev` | ObsidianのVaultパス（`~` 展開対応） |
| `folder` | string | `Sessions` | Vault内のセッション保存フォルダ名 |
| `filename_format` | string | `YYYY-MM-DD_HH-mm_{project}` | ファイル名フォーマット |
| `auto_save_interval_minutes` | number | `30` | 自動中間保存の間隔（分）。`0` で無効化 |
| `include_git_diff` | boolean | `true` | サマリーにgit diffを含めるか |
| `tags` | array | `["claude-code", "session"]` | Obsidianノートに付与するタグ |

### filename_format の変数

| 変数 | 内容 |
|------|------|
| `YYYY` | 年（4桁） |
| `MM` | 月（2桁） |
| `DD` | 日（2桁） |
| `HH` | 時（2桁） |
| `mm` | 分（2桁） |
| `{project}` | プロジェクト名（カレントディレクトリ名） |

## 保存されるノートの構造

```markdown
---
date: 2026-03-18
project: my-project
tags: ["claude-code", "session"]
---

# セッションサマリー：my-project（2026-03-18 14:30）

## 作業概要
...

## 主な変更点
...

## 決定事項・学び
...

## 未完了・次回への持ち越し
- [ ] 未完了タスク...

## git diff サマリー
...
```

### 中間保存ファイル

中間保存ファイルは `{vault_path}/{folder}/intermediate/` に保存されます:

```
YYYY-MM-DD_HH-mm_{project}_autosave.md
```

## devteamとの組み合わせ

`obsidian-archive` は `devteam` プラグインと独立して動作しますが、併用することでより強力なワークフローを構築できます。

### 推奨ワークフロー

```
# 1. devteam で開発を開始
/devteam:start

# 2. 開発作業...
/devteam:send orchestrator 新機能の実装をお願いします

# 3. 重要なマイルストーンで手動保存
/obsidian-archive:archive

# 4. devteam を停止
/devteam:stop

# → セッション終了時に obsidian-archive が自動的にサマリーを保存
```

### devteamのエージェント出力をアーカイブする

devteamの各エージェントの作業結果もセッションサマリーに含まれるため、マルチエージェントの作業内容を自動的に記録できます。

## フック動作の詳細

### SessionStop フック

Claude Codeセッション終了時に自動実行:
1. `obsidian-archive.json` から設定を読み込む
2. `obsidian-archive:summarizer` エージェントを起動
3. セッション全体のサマリーを生成
4. `{vault_path}/{folder}/{filename}.md` に保存

### PostToolUse フック（定期保存）

ツール使用ごとに最終保存からの経過時間を確認し、`auto_save_interval_minutes` を超えていた場合に中間保存を実行:
1. `/tmp/obsidian-archive-last-save` で最終保存時刻を管理
2. 設定間隔を超えていた場合のみ実行（毎回は実行しない）
3. `{vault_path}/{folder}/intermediate/{filename}_autosave.md` に保存

## ライセンス

MIT
