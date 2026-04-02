---
description: Run an MCP server tool directly and inspect the response
allowed-tools: Bash, Read, Glob
argument-hint: "[--server <name> --tool <name> [--args <json>]]"
---

# /mcpr:run

MCPサーバーのツールを呼び出し、レスポンスを表示する。
引数の有無によって以下の2つのモードで動作する。

---

## 引数の解析

以下の引数が渡されているか確認する:

- `--server <name>`: 呼び出すMCPサーバー名
- `--tool <name>`: 呼び出すツール名
- `--args <json>`: ツールに渡すJSON形式の引数（省略時は `{}`）

`--server` と `--tool` の両方が渡されている場合は**引数ありモード**で動作する。
それ以外は**引数なしモード**で動作する。

---

## 【引数ありモード】

`--server` と `--tool` が渡された場合、インタラクティブなステップをスキップして、
直接「実行と結果表示」へ進む。

`--args` が省略された場合は `{}` を引数として使用する。

---

## 【引数なしモード】

引数が渡されなかった場合、以下の手順でインタラクティブに入力を受け付ける。

### Step 1: 設定ファイルの読み込み

以下のパスを探索し、存在するファイルから `mcpServers` キーのサーバー定義を収集する:

- `~/Library/Application Support/Claude/claude_desktop_config.json`
- `~/.claude/claude_desktop_config.json`
- `~/.claude.json`
- カレントディレクトリの `.mcp.json`
- カレントディレクトリの `.claude/settings.json`

次に以下のコマンドで現在接続中のサーバー一覧を取得し、設定から収集したサーバー情報と突合する:

```bash
claude mcp list 2>/dev/null
```

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

### Step 2: サーバー選択

以下のフォーマットで表示し、ユーザーに番号の入力を求める:

```
⚡ MCP Runner
══════════════════════════════════════
サーバーを選択してください:

  1. filesystem   (stdio)
  2. github       (stdio)
  3. notion       (stdio)

番号を入力 (q で終了):
```

- ユーザーが `q` を入力したら「終了しました。」と表示して処理を終える
- 範囲外の番号が入力された場合は「無効な番号です。もう一度入力してください。」と伝え、再度一覧を表示する

### Step 3: ツール選択

選択されたサーバーのツール一覧を取得し、以下のフォーマットで表示する:

```
📦 github のツール
══════════════════════════════════════
  1. create_issue       Create a new GitHub issue
  2. list_prs           List pull requests
  3. get_commit         Get commit details

番号を入力 (b で戻る / q で終了):
```

- ツールの説明が取得できない場合は説明欄を空白にする
- ユーザーが `b` を入力したら Step 2（サーバー選択）に戻る
- ユーザーが `q` を入力したら「終了しました。」と表示して処理を終える

### Step 4: 引数の入力

選択されたツールの inputSchema を参照し、各パラメータを1つずつ入力させる:

```
🛠  github › create_issue
══════════════════════════════════════
引数を入力してください (Enterでスキップ):

  owner  (string, required):
  repo   (string, required):
  title  (string, required):
  body   (string, optional):
```

- `required` のパラメータは `(型, required)` と表示する
- `optional` のパラメータは `(型, optional)` と表示する
- ユーザーが Enter のみ（空入力）でスキップした場合:
  - `required` パラメータは「必須項目です。入力してください。」と伝えて再入力を促す
  - `optional` パラメータはそのフィールドを引数から省略する
- すべての入力が完了したら、入力値をもとにJSON形式の引数オブジェクトを組み立てて「実行と結果表示」へ進む

---

## 【実行と結果表示】（両モード共通）

対象のMCPツールを呼び出し、以下のフォーマットで結果を表示する:

```
⚡ MCP Runner
══════════════════════════════════════
Server : github
Tool   : create_issue
Args   : {"owner":"yn01","repo":"test","title":"hello"}

🔄 実行中...

✅ 成功
──────────────────────────────────────
{
  "number": 42,
  "title": "hello",
  "url": "https://github.com/yn01/test/issues/42",
  "state": "open"
}
══════════════════════════════════════
```

エラーが発生した場合:

```
❌ エラー
──────────────────────────────────────
Not Found: Repository yn01/test does not exist
══════════════════════════════════════
```

- レスポンスが JSON の場合は整形（pretty-print）して表示する
- レスポンスがテキストの場合はそのまま表示する
- 引数なしモードで実行した場合、結果表示後に「もう一度実行しますか？ (y / n):」と尋ね、`y` なら Step 3（ツール選択）に戻り、`n` なら「終了しました。」と表示して処理を終える
