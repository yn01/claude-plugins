---
description: Generate MCP server scaffold and tool implementation code from a natural language description
allowed-tools: Bash, Read, Write, Edit
argument-hint: "[--name <name> --lang <typescript|python> --description <text>]"
---

# /mcpg:generate

MCPサーバーの雛形とツール実装コードを生成する。
引数の有無によって以下の2つのモードで動作する。

---

## 引数の解析

以下の引数が渡されているか確認する:

- `--name <name>`: 生成するMCPサーバーの名前
- `--lang <typescript|python>`: 生成する言語
- `--description <text>`: サーバーの概要と作りたいツールの説明

`--name`・`--lang`・`--description` がすべて渡されている場合は**引数ありモード**で動作する。
それ以外は**引数なしモード**で動作する。

---

## 【引数なしモード】

引数が渡されなかった場合、以下の手順でインタラクティブに入力を受け付ける。

### Step 1: 言語選択

```
🔧 MCP Generator
══════════════════════════════════════
言語を選択してください:

  1. TypeScript
  2. Python

番号を入力 (q で終了):
```

- `1` が入力されたら TypeScript を選択する
- `2` が入力されたら Python を選択する
- `q` が入力されたら「終了しました。」と表示して処理を終える
- 範囲外の入力は「無効な番号です。もう一度入力してください。」と伝えて再表示する

### Step 2: サーバー名の入力

```
サーバー名を入力してください:
例: my-github-server, file-utils, slack-notifier

>
```

- 空入力の場合は「サーバー名は必須です。入力してください。」と伝えて再入力を促す
- スペースを含む名前はハイフン区切りに変換する

### Step 3: 説明の入力

```
作りたいサーバーの概要とツールを説明してください:
例: GitHubのissueを検索・作成・クローズするツールを作りたい

>
```

- 空入力の場合は「説明は必須です。入力してください。」と伝えて再入力を促す

---

## 【生成処理】（両モード共通）

入力された説明を解析し、実装すべきツールを特定する。
各ツールの名前・用途・必要なパラメータを説明文から推定して、
実際に動作するコードを生成する。実現が難しい部分は TODO コメントで補足する。

### TypeScript の場合

以下の3ファイルを `<server-name>/` ディレクトリに生成する:

**`package.json`**
- name に server-name を設定する
- `@modelcontextprotocol/sdk` を dependencies に含める
- scripts に `build: tsc` および `start: node dist/index.js` を含める

**`tsconfig.json`**
- target: ES2020
- module: NodeNext
- moduleResolution: NodeNext
- outDir: ./dist
- strict: true

**`src/index.ts`**
- `@modelcontextprotocol/sdk/server/index.js` から `Server` をインポートする
- `@modelcontextprotocol/sdk/server/stdio.js` から `StdioServerTransport` をインポートする
- `@modelcontextprotocol/sdk/types.js` から必要な型をインポートする
- 説明から読み取ったツールをすべて実装する
- 各ツールには以下を含める:
  - `name`: ツール名（snake_case）
  - `description`: ツールの説明
  - `inputSchema`: 必要なパラメータのJSON Schema
  - ハンドラーロジック: 実際に動作するコード
- `ListToolsRequestSchema` ハンドラーでツール一覧を返す
- `CallToolRequestSchema` ハンドラーで各ツールを呼び出す
- `StdioServerTransport` を使って起動する

### Python の場合

以下の2ファイルを `<server-name>/` ディレクトリに生成する:

**`pyproject.toml`**
- name に server-name を設定する
- `mcp>=1.0.0` を dependencies に含める
- Python 3.10 以上を要求する
- `[project.scripts]` に起動コマンドを定義する

**`server.py`**
- `from mcp.server.fastmcp import FastMCP` でインポートする
- `mcp = FastMCP("<server-name>")` でインスタンスを生成する
- 説明から読み取ったツールをすべて実装する
- 各ツールには以下を含める:
  - `@mcp.tool()` デコレータ
  - 型アノテーション付きの引数
  - docstring（ツールの説明）
  - 実際に動作するハンドラーロジック
- `if __name__ == "__main__": mcp.run()` で起動する

---

## 【生成後の表示】

すべてのファイルを出力した後、以下のフォーマットで結果を表示する:

```
🔧 MCP Generator
══════════════════════════════════════
✅ 生成完了: <server-name> (TypeScript|Python)
──────────────────────────────────────
生成ファイル:
  <server-name>/package.json
  <server-name>/tsconfig.json
  <server-name>/src/index.ts

実装したツール:
  - <tool-name>   <ツールの説明>
  - <tool-name>   <ツールの説明>

次のステップ:
  cd <server-name>
  npm install        # TypeScript の場合
  npm run build      # TypeScript の場合

Claude Code への追加:
  claude mcp add <server-name> node dist/index.js   # TypeScript の場合
  claude mcp add <server-name> python server.py     # Python の場合
══════════════════════════════════════
```

- 言語に応じて「次のステップ」と「Claude Code への追加」コマンドを切り替える
- 実装したツールは生成したすべてのツールを列挙する
