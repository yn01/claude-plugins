# mcpl — MCP Log Tail

MCPサーバーのstderrログをリアルタイムでtailして整形表示するClaude Codeプラグイン。

## 他のMCPプラグインとの役割分担

| プラグイン | 役割 |
|-----------|------|
| **mcpa** | MCPサーバーをClaude Codeに登録する |
| **mcpd** | MCP設定・接続・ツール一覧を診断する |
| **mcpx** | MCPサーバーのツールとスキーマを対話的に探索する |
| **mcpr** | MCPサーバーのツールを直接実行して結果を確認する |
| **mcpg** | MCPサーバーのスキャフォルドをコード生成する |
| **mcpl** | MCPサーバーのstderrログをリアルタイムで監視する |

## 前提条件

- macOS
- Claude Code がインストール済みであること
- 対象MCPサーバーのログが以下のいずれかに出力されていること:
  - `~/Library/Logs/Claude/mcp-server-<name>.log`（Claude Desktop）
  - `~/.claude/logs/mcp-server-<name>.log`（Claude Code）

## インストール

```
/plugin marketplace add yn01/claude-plugins
/plugin install mcpl
```

## コマンド

### `/mcpl:tail` — ログをリアルタイム表示

#### 引数なし（全サーバーモード）

設定ファイルに登録されているすべてのMCPサーバーのログを統合表示する。

```
/mcpl:tail
```

読み込む設定ファイル（順に探索）:
- `~/Library/Application Support/Claude/claude_desktop_config.json`
- `~/.claude/claude_desktop_config.json`
- `~/.claude.json`
- `.mcp.json`（カレントディレクトリ）
- `.claude/settings.json`（カレントディレクトリ）

出力例:

```
📋 MCP Log Tail
══════════════════════════════════════
対象サーバー: github, filesystem, notion
Ctrl+C で終了
──────────────────────────────────────

[14:32:01] [github]      Server started on stdio
[14:32:01] [filesystem]  Server started on stdio
[14:32:05] [github]      Tool called: search_repos
[14:32:05] [github]      → {"q":"mcp","sort":"stars"}
[14:32:06] [github]      ✓ Returned 10 results (230ms)
[14:32:10] [notion]      ❌ ERROR: NOTION_API_KEY is not set
[14:32:15] [filesystem]  Tool called: read_file
[14:32:15] [filesystem]  → {"path":"/tmp/test.txt"}
[14:32:15] [filesystem]  ✓ OK (12ms)
```

#### `--server <name>`（単一サーバーモード）

特定サーバーのログのみを表示する。サーバー名プレフィックスは省略される。

```
/mcpl:tail --server github
/mcpl:tail --server my-api-server --lines 50
```

オプション:
- `--server <name>` — 対象のMCPサーバー名
- `--lines <n>` — 遡って表示する過去ログの行数（デフォルト: 20）

出力例:

```
📋 MCP Log Tail — github
══════════════════════════════════════
Ctrl+C で終了
──────────────────────────────────────

[14:32:01] Server started on stdio
[14:32:05] Tool called: search_repos
[14:32:05] → {"q":"mcp","sort":"stars"}
[14:32:06] ✓ Returned 10 results (230ms)
```

## ログファイルのパス

Claude CodeのMCPサーバーログは以下の2箇所に出力される:

| 環境 | パス |
|------|------|
| Claude Desktop (macOS) | `~/Library/Logs/Claude/mcp-server-<name>.log` |
| Claude Code | `~/.claude/logs/mcp-server-<name>.log` |

両方のパスを探索し、存在するファイルをtailする。見つからない場合:

```
⚠️  github: ログファイルが見つかりません
    試したパス:
      ~/Library/Logs/Claude/mcp-server-github.log
      ~/.claude/logs/mcp-server-github.log
```

## ログレベルのアイコン

| アイコン | 対象キーワード |
|---------|--------------|
| ❌ | `ERROR`、`error` を含む行 |
| ⚠️ | `WARN`、`warning` を含む行 |
| ℹ️ | `INFO`、`info` を含む行 |
| （なし） | その他 |
