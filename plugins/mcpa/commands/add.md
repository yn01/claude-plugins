---
description: Add a stdio MCP server to Claude Code interactively or with arguments
allowed-tools: Bash
argument-hint: "[--name <name> --command <cmd> [--args <args>] [--env KEY=VALUE] [--scope user|project]]"
---

# /mcpa:add

stdioタイプのMCPサーバーをClaude Codeに追加する。
引数の有無によって以下の2つのモードで動作する。

---

## 引数の解析

以下の引数が渡されているか確認する:

- `--name <name>`: サーバー名
- `--command <cmd>`: 起動コマンド（例: `npx`, `node`, `python`）
- `--args <args>`: コマンドに渡す引数（スペース区切り）
- `--env <KEY=VALUE>`: 環境変数（複数指定可能）
- `--scope <user|project>`: 追加するスコープ（省略時は `user`）

`--name` と `--command` の両方が渡されている場合は**引数ありモード**で動作する。
それ以外は**引数なしモード**で動作する。

---

## 【引数ありモード】

`--name` と `--command` が渡された場合、インタラクティブなステップをスキップして直接実行する。

- `--scope` が省略された場合は `user` をデフォルトとして使用する
- `--args` が省略された場合はコマンド引数なしで実行する
- `--env` が省略された場合は環境変数なしで実行する

---

## 【引数なしモード】

引数が渡されなかった場合、以下の手順でインタラクティブに入力を受け付ける。

### Step 1: スコープ選択

```
➕ MCP Add
══════════════════════════════════════
追加するスコープを選択してください:

  1. user    グローバル (~/.claude.json) — すべてのプロジェクトで利用可能
  2. project プロジェクト (.mcp.json)   — このプロジェクトのみで利用可能

番号を入力 (q で終了):
```

- `1` が入力されたら `user` スコープを選択する
- `2` が入力されたら `project` スコープを選択する
- `q` が入力されたら「終了しました。」と表示して処理を終える
- 範囲外の入力は「無効な番号です。もう一度入力してください。」と伝えて再表示する

### Step 2: サーバー名の入力

```
サーバー名を入力してください:
例: github, filesystem, my-api-server

>
```

- 空入力の場合は「サーバー名は必須です。入力してください。」と伝えて再入力を促す

### Step 3: コマンドの入力

```
起動コマンドを入力してください:
例: npx, node, python

>
```

- 空入力の場合は「コマンドは必須です。入力してください。」と伝えて再入力を促す

### Step 4: コマンド引数の入力

```
コマンド引数を入力してください（不要な場合はEnter）:
例: -y @modelcontextprotocol/server-github
例: dist/index.js

>
```

- 空入力の場合はコマンド引数なしとして次へ進む

### Step 5: 環境変数の入力

```
環境変数を入力してください（不要な場合はEnter）:
形式: KEY=VALUE（複数ある場合は1行ずつ入力、空行で完了）

>
```

- `KEY=VALUE` 形式で1行ずつ受け付ける
- 空行が入力されたら環境変数の入力を終了して次へ進む
- 環境変数が1つも入力されなかった場合は環境変数なしとして次へ進む

### Step 6: 確認

収集した情報を以下のフォーマットで表示し、実行確認を求める:

```
以下の内容でMCPサーバーを追加します:

  スコープ  : user
  サーバー名: github
  コマンド  : npx -y @modelcontextprotocol/server-github
  環境変数  : GITHUB_TOKEN=xxx

実行しますか？ (y / n):
```

- 環境変数がない場合は「環境変数」行を省略する
- `n` が入力されたら「キャンセルしました。」と表示して処理を終える
- `y` が入力されたら「実行と結果表示」へ進む

---

## 【実行と結果表示】（両モード共通）

以下の形式で `claude mcp add` コマンドを組み立てて実行する:

```bash
claude mcp add --scope <scope> <name> <command> [args...]
```

環境変数がある場合は `-e KEY=VALUE` フラグを各変数に対して追加する:

```bash
claude mcp add --scope user github npx -y @modelcontextprotocol/server-github -e GITHUB_TOKEN=xxx
```

コマンドが成功した場合:

```
➕ MCP Add
══════════════════════════════════════
✅ 追加完了
──────────────────────────────────────
  スコープ  : user
  サーバー名: github
  コマンド  : npx -y @modelcontextprotocol/server-github
  環境変数  : GITHUB_TOKEN=xxx

確認するには /mcpd:doctor を実行してください。
══════════════════════════════════════
```

エラーが発生した場合:

```
❌ エラー
──────────────────────────────────────
<エラー内容>
══════════════════════════════════════
```

- 環境変数がない場合は「環境変数」行を省略する
