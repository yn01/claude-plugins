# mcpg

A Claude Code plugin to generate MCP server scaffold and tool implementation code from a natural language description.
Choose TypeScript or Python, describe what tools you want, and get a working server skeleton — ready to install.

## Role vs mcpd / mcpx / mcpr

| Plugin | Role |
|---|---|
| **mcpd** | Diagnostics — connectivity checks, env var validation, health reports |
| **mcpx** | Exploration — browsing available tools and inspecting input schemas |
| **mcpr** | Execution — calling tools directly and inspecting responses |
| **mcpg** | Generation — scaffolding new MCP servers from a natural language description |

## Prerequisites

- macOS
- Claude Code installed
- Node.js (for TypeScript servers) or Python 3.10+ (for Python servers)

## Installation

```
/plugin marketplace add yn01/claude-plugins
```

Then enable the plugin:

```
/plugin install mcpg
```

## Commands

### `/mcpg:generate` — Generate an MCP server from a description

#### Direct mode (with arguments)

Generate immediately without interactive prompts.

```
/mcpg:generate --name <name> --lang <typescript|python> --description <text>
```

**Arguments:**

| Argument | Required | Description |
|---|---|---|
| `--name <name>` | Yes | Server directory name (e.g. `my-github-server`) |
| `--lang <typescript\|python>` | Yes | Language to generate |
| `--description <text>` | Yes | Natural language description of the server and its tools |

**Examples:**

```
/mcpg:generate --name my-github-server --lang typescript --description "GitHubのissueを検索・作成・クローズするツールを作りたい"
```

```
/mcpg:generate --name file-utils --lang python --description "テキストファイルの読み書きと正規表現での検索ができるツール"
```

#### Interactive mode (no arguments)

When called without arguments, walks you through language → name → description step by step.

```
/mcpg:generate
```

---

## Generated file structure

### TypeScript

```
<server-name>/
├── package.json       # Dependencies including @modelcontextprotocol/sdk
├── tsconfig.json      # ES2020 / NodeNext module config
└── src/
    └── index.ts       # MCP server with all tools implemented
```

### Python

```
<server-name>/
├── pyproject.toml     # Dependencies including mcp>=1.0.0
└── server.py          # MCP server with all tools implemented
```

---

## Next steps after generation

### TypeScript

```bash
cd <server-name>
npm install
npm run build
```

Add to Claude Code:

```bash
claude mcp add <server-name> node dist/index.js
```

### Python

```bash
cd <server-name>
pip install -e .
```

Add to Claude Code:

```bash
claude mcp add <server-name> python server.py
```
