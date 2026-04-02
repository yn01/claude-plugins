# mcpx

A Claude Code plugin to interactively explore MCP server tools and their input schemas.
Drill down from server → tool → schema to inspect what each tool expects.

## Role vs mcpd

| Plugin | Role |
|---|---|
| **mcpd** | Diagnostics — connectivity checks, env var validation, health reports |
| **mcpx** | Exploration — browsing available tools and inspecting input schemas |

Use `mcpd:doctor` to check if your servers are healthy.
Use `mcpx:browse` to explore what tools are available and how to call them.

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
/plugin install mcpx
```

## Commands

### `/mcpx:browse` — Interactively browse MCP server tools

Reads MCP server configuration files and lets you navigate servers, tools, and schemas interactively.

**Usage:**

```
/mcpx:browse
```

Start directly from a specific server:

```
/mcpx:browse --server github
```

---

## How It Works

### Step 1: Load configuration files

Collects `mcpServers` definitions from the following paths:

- `~/Library/Application Support/Claude/claude_desktop_config.json` — Claude Desktop (macOS)
- `~/.claude/claude_desktop_config.json` — Claude Code global
- `~/.claude.json` — Claude Code user scope
- `.mcp.json` — Project-local
- `.claude/settings.json` — Project-local (Claude Code)

### Step 2: Select a server

Lists all detected MCP servers with their type and tool count.

```
🔍 MCP Explorer
══════════════════════════════════════
Select a server:

  1. filesystem   (stdio)   12 tools
  2. github       (stdio)    8 tools
  3. notion       (stdio)    5 tools

Enter number (q to quit):
```

### Step 3: Select a tool

Lists all available tools for the selected server.

```
📦 github tools (8)
══════════════════════════════════════
  1. create_issue       Create a new GitHub issue
  2. list_prs           List pull requests
  ...

Enter number (b to go back / q to quit):
```

### Step 4: View tool schema

Displays the input schema for the selected tool, including parameter names, types, required/optional status, and descriptions.

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
b to go back / q to quit:
```

## Navigation

| Input | Action |
|---|---|
| number | Select item |
| `b` | Go back one level |
| `q` | Quit |
