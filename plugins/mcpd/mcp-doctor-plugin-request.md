以下の仕様でClaude Codeプラグインを作成してください。

## 目的
MCPサーバーの診断・デバッグを行う `mcpd` プラグインを作成してください。
設定ファイルの読み込み・接続確認・環境変数チェック・ツール一覧表示を1コマンドで行います。

## 前提
カレントディレクトリは /Users/yoheinakanishi/Dev/claude-plugins です。
mcpd/ 配下にプラグインファイル群を作成してください。
（ディレクトリ /Users/yoheinakanishi/Dev/claude-plugins/mcpd は作成済みです）

## 作成するファイル構成
mcpd/
├── .claude-plugin/plugin.json
├── commands/
│   └── doctor.md       # /mcpd:doctor
├── hooks/
│   └── hooks.json
└── README.md

## plugin.json の内容
{
  "name": "mcpd",
  "version": "1.0.0",
  "description": "Diagnose MCP server configuration, connectivity, and available tools",
  "author": {"name": "Yohei Nakanishi"},
  "commands": "./commands"
}

## 各コマンドの動作仕様
各コマンドの .md ファイルはnodeコマンドを直接実行するのではなく、
Claude Codeへの自然言語プロンプトとして記述してください。

### commands/doctor.md（/mcpd:doctor）
以下の内容をプロンプトとして記述してください:

MCPサーバーの診断を行い、以下を順番に実行・報告すること:

**1. 設定ファイルの読み込み**
以下のパスを探索し、存在するファイルを読み込む:
- `~/Library/Application Support/Claude/claude_desktop_config.json`（Claude Desktop / macOS）
- `~/.claude/claude_desktop_config.json`（Claude Code グローバル）
- カレントディレクトリの `.mcp.json`（プロジェクト）
- カレントディレクトリの `.claude/settings.json`（プロジェクト）

同名サーバーがグローバルとプロジェクトの両方に存在する場合は競合として警告する。

**2. 環境変数チェック**
各サーバー設定の `env` ブロックに記載された環境変数が実際にセットされているか確認する。
未設定のものは警告として表示する。

**3. サーバー接続確認**
- `stdio` タイプ: コマンドが存在し実行可能かチェック（`which` または `ls` で確認）
- `sse` / `http` タイプ: URLへの疎通確認（curlで接続可否を確認）

**4. ツール一覧表示**
接続中のMCPサーバーに登録されているツール名を一覧表示する。
（Claude Code の `mcp` コマンドまたは設定から読み取れる範囲で表示）

**5. 診断レポートの出力**
以下のフォーマットで結果をまとめて表示する:

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

引数として `--server <name>` が渡された場合は、そのサーバーのみ診断する。
引数として `--scope global` または `--scope project` が渡された場合は、対象スコープのみ読み込む。

## hooks/hooks.json
フックは不要なので以下の内容で作成してください:
{
  "hooks": {}
}

## README.md に含める内容
- プラグインの概要
- 前提条件（macOS / Claude Code 環境）
- インストール方法: `/plugin marketplace add yn01/claude-plugins`
- コマンドの使い方と例（オプション含む）
- 診断項目の説明

作成後、以下を実行してバリデーションしてください:
claude plugin validate mcpd

エラーがあれば修正してください。