# mcpd

> Diagnose MCP server configuration, connectivity, and available tools — all in one command.

## Overview

`mcpd` is a Claude Code plugin that provides a comprehensive diagnostic tool for MCP (Model Context Protocol) servers. It reads all MCP configuration files, checks environment variables, verifies server connectivity, and lists available tools — giving you a clear picture of your MCP setup in seconds.

## Requirements

- macOS
- Claude Code (with plugin support)

## Installation

```
/plugin marketplace add yn01/claude-plugins
/plugin install mcpd
```

## Commands

### `/mcpd:doctor`

Run a full MCP server diagnostic report.

```
/mcpd:doctor
/mcpd:doctor --server <name>
/mcpd:doctor --scope global
/mcpd:doctor --scope project
```

**Options:**

| Option | Description |
|--------|-------------|
| `--server <name>` | Diagnose only the specified server |
| `--scope global` | Read only global configuration files |
| `--scope project` | Read only project-level configuration files |

**Example output:**

```
🩺 MCP Doctor — Diagnostic Report
══════════════════════════════════════

📋 Configuration Sources
  ✅ Global:  ~/.claude/claude_desktop_config.json  (3 servers)
  ✅ Project: .mcp.json                             (1 server)
  ⚠️  Conflict: "filesystem" defined in both (project takes precedence)

🔌 Server Status
  ✅ filesystem   stdio   OK        12 tools
  ✅ github       stdio   OK        8 tools
  ❌ my-api       sse     FAILED    → connection refused (http://localhost:3000)
  ⚠️  stripe       stdio   OK        5 tools  → ENV missing: STRIPE_API_KEY

🌿 Environment Variables
  ✅ GITHUB_TOKEN     set    (github)
  ❌ STRIPE_API_KEY   NOT SET  (stripe)

🛠  Available Tools  (25 total)
  filesystem  [12]  read_file · write_file · list_directory ...
  github      [8]   create_issue · list_prs · get_commit ...
  stripe      [5]   create_payment · list_customers ...

══════════════════════════════════════
✅ 3 servers healthy   ❌ 1 failed   ⚠️  1 warnings
```

## Diagnostic Items

### 1. Configuration Sources

Searches the following locations for MCP server definitions:

| Path | Scope | Description |
|------|-------|-------------|
| `~/Library/Application Support/Claude/claude_desktop_config.json` | Global | Claude Desktop (macOS) |
| `~/.claude/claude_desktop_config.json` | Global | Claude Code global config |
| `.mcp.json` | Project | Project-level MCP config |
| `.claude/settings.json` | Project | Claude Code project settings |

If the same server name appears in both global and project configs, it is flagged as a conflict. Project-level configuration takes precedence.

### 2. Environment Variables

Checks each `env` block in server configurations to verify that required environment variables are actually set in the current shell. Missing variables are shown as warnings.

### 3. Server Connectivity

- **`stdio` servers**: Verifies the command exists and is executable using `which` or `ls`
- **`sse` / `http` servers**: Tests connectivity to the URL using `curl` with a 5-second timeout

### 4. Available Tools

Displays the list of tools registered in each MCP server. Uses `claude mcp list` when available, otherwise reports tool counts as unknown.
