---
description: Interactively browse MCP server tools and their input schemas
allowed-tools: Bash, Read, Glob
argument-hint: "[--server <name>]"
---

# /mcpx:browse

MCPサーバーのツールをインタラクティブに探索する。以下の手順で進めること。

引数の解析:
- `--server <name>` が渡された場合は、Step 2をスキップし、そのサーバーのツール一覧（Step 3）から開始する

---

## Step 1: 設定ファイルの読み込み

以下のパスを探索し、存在するファイルから `mcpServers` キーのサーバー定義を収集する:

- `~/Library/Application Support/Claude/claude_desktop_config.json`
- `~/.claude/claude_desktop_config.json`
- `~/.claude.json`
- カレントディレクトリの `.mcp.json`
- カレントディレクトリの `.claude/settings.json`

各ファイルを `Read` ツールで読み込み、`mcpServers` オブジェクトに含まれるサーバー名・タイプ（`stdio` / `sse` / `http`）を収集する。
同名サーバーが複数のファイルに存在する場合はプロジェクト設定を優先し、重複を除去する。

次に以下のコマンドで現在接続中のサーバーとツール数を取得する:

```bash
claude mcp list 2>/dev/null
```

設定ファイルから得たサーバー一覧と突合し、各サーバーのツール数を補完する（取得できない場合は `?` と表示）。

設定ファイルが1つも見つからない場合は以下を表示して終了する:

```
⚠️  MCPの設定ファイルが見つかりませんでした。
    確認済みパス:
      - ~/Library/Application Support/Claude/claude_desktop_config.json
      - ~/.claude/claude_desktop_config.json
      - ~/.claude.json
      - .mcp.json
      - .claude/settings.json
```

---

## Step 2: サーバー一覧を表示し、選択を促す

`--server <name>` が渡された場合はこのステップをスキップして Step 3 へ進む。

以下のフォーマットで表示し、ユーザーに番号の入力を求める:

```
🔍 MCP Explorer
══════════════════════════════════════
サーバーを選択してください:

  1. filesystem   (stdio)   12 tools
  2. github       (stdio)    8 tools
  3. notion       (stdio)    5 tools

番号を入力 (q で終了):
```

- ツール数が不明なサーバーは `? tools` と表示する
- ユーザーが `q` を入力したら「終了しました。」と表示して処理を終える
- 範囲外の番号が入力された場合は「無効な番号です。もう一度入力してください。」と伝え、再度一覧を表示する

---

## Step 3: 選択されたサーバーのツール一覧を表示し、選択を促す

`--server <name>` で指定または Step 2 で選択されたサーバーについて、`claude mcp list` の出力やシステム上で利用可能な情報からツール一覧を取得する。

以下のフォーマットで表示し、ユーザーに番号の入力を求める:

```
📦 github のツール (8)
══════════════════════════════════════
  1. create_issue       Create a new GitHub issue
  2. list_prs           List pull requests
  3. get_commit         Get commit details
  4. search_repos       Search repositories
  ...

番号を入力 (b で戻る / q で終了):
```

- ツールの説明が取得できない場合は説明欄を空白にする
- ユーザーが `b` を入力したら Step 2（サーバー一覧）に戻る
- ユーザーが `q` を入力したら「終了しました。」と表示して処理を終える
- `--server <name>` で直接指定された場合、`b` を入力してもサーバー一覧には戻らず「終了しました。」と表示する

---

## Step 4: 選択されたツールのスキーマを整形表示する

選択されたツールの inputSchema（JSON Schema）をもとに、以下のフォーマットで整形して表示する:

```
🛠  github › create_issue
══════════════════════════════════════
Description:
  Create a new GitHub issue in the specified repository.

Parameters:
  owner   string    required   Repository owner (username or org)
  repo    string    required   Repository name
  title   string    required   Issue title
  body    string    optional   Issue body (Markdown supported)
  labels  string[]  optional   List of label names to apply

══════════════════════════════════════
b で戻る / q で終了:
```

- `required` 配列に含まれるプロパティは `required`、それ以外は `optional` と表示する
- 型が配列の場合は `string[]` のように表示する（`items.type` を参照）
- `description` がないプロパティは説明欄を空白にする
- スキーマが取得できないツールは「スキーマ情報を取得できませんでした。」と表示する
- ユーザーが `b` を入力したら Step 3（ツール一覧）に戻る
- ユーザーが `q` を入力したら「終了しました。」と表示して処理を終える
