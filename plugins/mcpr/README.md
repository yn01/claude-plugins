# mcpr

A Claude Code plugin to run MCP server tools directly and inspect their responses.
Supports both direct execution with arguments and interactive mode for guided tool invocation.

## Role vs mcpd / mcpx

| Plugin | Role |
|---|---|
| **mcpd** | Diagnostics — connectivity checks, env var validation, health reports |
| **mcpx** | Exploration — browsing available tools and inspecting input schemas |
| **mcpr** | Execution — calling tools directly and inspecting responses |

Use `mcpd:doctor` to check server health, `mcpx:browse` to explore tool schemas, and `mcpr:run` to actually call a tool and see what it returns.

## Prerequisites

- macOS
- Claude Code installed
- At least one MCP server configured (e.g. `~/.claude.json` or `.mcp.json`)

## Installation

```
/plugin marketplace add yn01/claude-plugins
```

Then enable the plugin:

```
/plugin install mcpr
```

## Commands

### `/mcpr:run` — Run an MCP tool and inspect the response

#### Direct mode (with arguments)

Call a tool immediately without any interactive prompts.

```
/mcpr:run --server <name> --tool <name> [--args <json>]
```

**Arguments:**

| Argument | Required | Description |
|---|---|---|
| `--server <name>` | Yes | MCP server name |
| `--tool <name>` | Yes | Tool name to call |
| `--args <json>` | No | JSON-encoded arguments (default: `{}`) |

**Examples:**

```
/mcpr:run --server github --tool create_issue --args '{"owner":"yn01","repo":"test","title":"hello"}'
```

```
/mcpr:run --server filesystem --tool read_file --args '{"path":"/tmp/test.txt"}'
```

```
/mcpr:run --server filesystem --tool list_directory
```

#### Interactive mode (no arguments)

When called without arguments, guides you through server → tool → argument input step by step.

```
/mcpr:run
```

1. Select a server from the detected list
2. Select a tool from that server
3. Enter each parameter interactively (required fields are enforced)
4. View the result, then optionally run another tool

## Output format

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
