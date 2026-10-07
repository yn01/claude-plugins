---
description: Build the jev-toolscope tool catalog — start each stdio MCP server configured for this project and record its tools and descriptions
allowed-tools: Bash
argument-hint: "[--server <name>]"
---
# /jev-toolscope:scan

Build the catalog the prompt hook judges against: tool names, descriptions and server instructions.

**Usage:**
- `/jev-toolscope:scan` — every server in `~/.claude.json` and `.mcp.json` for this project
- `/jev-toolscope:scan --server github` — one server only

---

## Steps

### 1. Run the scan

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/scan.mjs" --cwd "$PWD" $ARGUMENTS
```

This starts each stdio server with the command and env from its config, asks it for its tools, and stops it. HTTP / SSE servers, plugin-provided servers and claude.ai connectors are reported as `skipped`: their tools are still judged, by name only, from the session transcript.

### 2. Report

Show the table as printed. For each `error` row, say what the error suggests (a missing env var, a command not on `PATH`, a server slower than `scan.serverTimeoutMs`). Do not try to fix server configs unless the user asks.

Re-run the scan after adding, removing or upgrading an MCP server.
