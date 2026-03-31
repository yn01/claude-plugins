---
description: Diagnose MCP server configuration, connectivity, environment variables, and available tools
allowed-tools: Bash, Read, Glob, Grep
argument-hint: "[--server <name>] [--scope global|project]"
---

# /mcpd:doctor

MCPサーバーの診断を行い、以下を順番に実行・報告すること。

引数の解析:
- `--server <name>` が渡された場合は、そのサーバー名のみ診断対象とする
- `--scope global` が渡された場合は、グローバル設定ファイルのみ読み込む
- `--scope project` が渡された場合は、プロジェクト設定ファイルのみ読み込む
- 引数なしの場合はすべてのスコープを対象とする

## 手順

### 1. 設定ファイルの読み込み

以下のパスを探索し、存在するファイルを読み込む:

**グローバル設定（`--scope project` でなければ読み込む）:**
- `~/Library/Application Support/Claude/claude_desktop_config.json`（Claude Desktop / macOS）
- `~/.claude/claude_desktop_config.json`（Claude Code グローバル）

**プロジェクト設定（`--scope global` でなければ読み込む）:**
- カレントディレクトリの `.mcp.json`
- カレントディレクトリの `.claude/settings.json`

各ファイルから `mcpServers` キーのサーバー定義を収集する。

同名サーバーがグローバルとプロジェクトの両方に存在する場合は競合として記録し、プロジェクト設定が優先されることを明記する。

`--server <name>` が指定された場合は、収集したサーバー一覧をそのサーバー名でフィルタリングする。

### 2. 環境変数チェック

各サーバー設定の `env` ブロックに記載されたすべての環境変数について、以下のコマンドで実際にセットされているか確認する:

```bash
printenv VAR_NAME
```

未設定の変数は警告として記録する。

### 3. サーバー接続確認

各サーバーのタイプに応じて接続可否を確認する:

**`stdio` タイプ:**
`command` フィールドのコマンドが存在し実行可能かを以下で確認する:
```bash
which COMMAND_NAME 2>/dev/null || ls COMMAND_PATH 2>/dev/null
```
コマンドが見つかれば OK、見つからなければ FAILED とする。

**`sse` / `http` タイプ:**
`url` フィールドのURLへの疎通確認を以下で行う:
```bash
curl -s -o /dev/null -w "%{http_code}" --max-time 5 URL
```
HTTP ステータスコードが返れば接続可能、タイムアウト・接続拒否は FAILED とする。

### 4. ツール一覧表示

まず以下のコマンドで現在接続中のMCPサーバーのツール一覧を取得する:
```bash
claude mcp list 2>/dev/null
```

コマンドが失敗した場合や出力が空の場合は、設定ファイルから読み込んだサーバー情報をもとに、接続成功したサーバーに対して利用可能なツール数を「不明」として表示する。

### 5. 診断レポートの出力

収集した情報を以下のフォーマットで出力する:

```
🩺 MCP Doctor — Diagnostic Report
══════════════════════════════════════

📋 Configuration Sources
  ✅ Global:  ~/.claude/claude_desktop_config.json  (N servers)
  ✅ Project: .mcp.json                             (N servers)
  ⚠️  Conflict: "xxx" defined in both (project takes precedence)

🔌 Server Status
  ✅ <server>   stdio   OK        N tools
  ❌ <server>   sse     FAILED    → <error reason>
  ⚠️  <server>   stdio   OK        N tools  → ENV missing: VAR_NAME

🌿 Environment Variables
  ✅ VAR_NAME   set    (<server>)
  ❌ VAR_NAME   NOT SET  (<server>)

🛠  Available Tools  (N total)
  <server>  [N]  tool1 · tool2 · tool3 ...

══════════════════════════════════════
✅ N servers healthy   ❌ N failed   ⚠️  N warnings
```

設定ファイルが1つも見つからない場合は:
```
⚠️  No MCP configuration files found.
    Checked:
      - ~/Library/Application Support/Claude/claude_desktop_config.json
      - ~/.claude/claude_desktop_config.json
      - .mcp.json
      - .claude/settings.json
```
と表示する。

`--server <name>` で指定したサーバーが見つからない場合は:
```
❌ Server "<name>" not found in any configuration.
```
と表示する。
