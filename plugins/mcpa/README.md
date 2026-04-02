# mcpa

A Claude Code plugin to add stdio MCP servers to Claude Code interactively or with arguments.
A wrapper around `claude mcp add` that guides you through server name, command, args, env vars, and scope.

## Role vs mcpd / mcpx / mcpr / mcpg

| Plugin | Role |
|---|---|
| **mcpd** | Diagnostics — connectivity checks, env var validation, health reports |
| **mcpx** | Exploration — browsing available tools and inspecting input schemas |
| **mcpr** | Execution — calling tools directly and inspecting responses |
| **mcpg** | Generation — scaffolding new MCP servers from a natural language description |
| **mcpa** | Registration — adding MCP servers to Claude Code interactively or with arguments |

Use `mcpg:generate` to create a new server, then `mcpa:add` to register it with Claude Code.

## Prerequisites

- macOS
- Claude Code installed

## Installation

```
/plugin marketplace add yn01/claude-plugins
```

Then enable the plugin:

```
/plugin install mcpa
```

## Commands

### `/mcpa:add` — Add a stdio MCP server to Claude Code

#### Direct mode (with arguments)

Add a server immediately without interactive prompts.

```
/mcpa:add --name <name> --command <cmd> [--args <args>] [--env KEY=VALUE] [--scope user|project]
```

**Arguments:**

| Argument | Required | Description |
|---|---|---|
| `--name <name>` | Yes | Server name |
| `--command <cmd>` | Yes | Startup command (e.g. `npx`, `node`, `python`) |
| `--args <args>` | No | Arguments passed to the command (space-separated) |
| `--env <KEY=VALUE>` | No | Environment variable — can be specified multiple times |
| `--scope <user\|project>` | No | Scope to add the server to (default: `user`) |

**Examples:**

```
/mcpa:add --name github --command npx --args "-y @modelcontextprotocol/server-github" --env GITHUB_TOKEN=xxx --scope user
```

```
/mcpa:add --name my-server --command node --args "dist/index.js" --scope project
```

```
/mcpa:add --name file-utils --command python --args "server.py"
```

#### Interactive mode (no arguments)

When called without arguments, walks you through each field step by step.

```
/mcpa:add
```

Steps: scope → server name → command → command args → env vars → confirmation

---

## Scope

| Scope | Config file | Availability |
|---|---|---|
| `user` | `~/.claude.json` | All projects on this machine |
| `project` | `.mcp.json` (current directory) | Current project only |

Use `user` scope for shared tools you want available everywhere (e.g. GitHub, filesystem).
Use `project` scope for project-specific servers that should be committed to the repository.

---

## What happens under the hood

The plugin constructs and runs the following command:

```bash
claude mcp add --scope <scope> <name> <command> [args...] [-e KEY=VALUE ...]
```

After adding, run `/mcpd:doctor` to verify the server is configured correctly and connected.
