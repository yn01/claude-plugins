---
description: Tail and display MCP server stderr logs in real time
allowed-tools: Bash
argument-hint: "[--server <name>] [--lines <n>]"
---

# /mcpl:tail

MCPサーバーのstderrログをリアルタイムでtailして整形表示する。
引数の有無によって以下の2つのモードで動作する。

---

**【引数ありモード】**

`--server <name>` が渡された場合、そのサーバーのログのみを表示する。

```
/mcpl:tail --server github
/mcpl:tail --server my-api-server --lines 50
```

オプション:
- `--server <name>` （必須）: 対象のMCPサーバー名
- `--lines <n>` （省略可能、デフォルト: 20）: 遡って表示する過去ログの行数

---

**【引数なしモード】**

引数が何も渡されなかった場合、設定ファイルから全サーバーを読み込み、
すべてのサーバーのログをまとめてリアルタイム表示する。

設定ファイルの読み込みパスは以下の順で探索する:
- `~/Library/Application Support/Claude/claude_desktop_config.json`
- `~/.claude/claude_desktop_config.json`
- `~/.claude.json`
- カレントディレクトリの `.mcp.json`
- カレントディレクトリの `.claude/settings.json`

---

**【ログファイルのパス】**

Claude CodeのMCPログは以下のパスに出力される:
- `~/Library/Logs/Claude/mcp-server-<name>.log`（Claude Desktop / macOS）
- `~/.claude/logs/mcp-server-<name>.log`（Claude Code）

両方のパスを探索し、存在するファイルをtailする。
ファイルが見つからない場合はその旨を表示する:

```
⚠️  github: ログファイルが見つかりません
    試したパス:
      ~/Library/Logs/Claude/mcp-server-github.log
      ~/.claude/logs/mcp-server-github.log
```

---

**【ログの表示フォーマット】（両モード共通）**

ヘッダーを表示してからログをリアルタイムで流す。

複数サーバーの場合:

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

特定サーバーのみの場合はサーバー名プレフィックスを省略する:

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

ログレベルに応じて以下のアイコンを先頭に付ける:
- `ERROR` / `error` を含む行 → `❌` を先頭に追加
- `WARN` / `warning` を含む行 → `⚠️` を先頭に追加
- `INFO` / `info` を含む行 → `ℹ️` を先頭に追加
- その他 → そのまま表示

---

**【実装方針】**

実装は `tail -f` コマンドを使用する。
複数サーバーの場合は各サーバーのログファイルを並行してtailし、
タイムスタンプとサーバー名プレフィックスを付けて統合表示する。

具体的には以下のステップで実装する:

1. 引数を解析して `--server` と `--lines` を取得する
2. `--server` が指定されている場合は単一サーバーモード、指定なしの場合は全サーバーモード
3. 全サーバーモードの場合、上記の設定ファイルパスを順に読み込んでサーバー名一覧を取得する
4. 各サーバーについてログファイルパスを探索する（`~/Library/Logs/Claude/mcp-server-<name>.log` と `~/.claude/logs/mcp-server-<name>.log`）
5. 見つかったファイルに対して `tail -f -n <lines>` を実行する
6. 複数ファイルの場合はバックグラウンドで並行実行し、出力をマージしてサーバー名・タイムスタンプを付与して表示する
7. ログ行のレベルを判定してアイコンを付ける
8. Ctrl+C で全プロセスを終了する
