---
description: Check that jev-toolscope is running — config layers in effect, the catalog, and the last judgement and guard check
allowed-tools: Bash
---
# /jev-toolscope:doctor

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs"
```

Show the output, then explain any ⚠️ line:

- **No catalog** — run `/jev-toolscope:scan`. Without it, tools are judged by name only, and only when the transcript lists them.
- **`no_api_key`** — the key is a per-plugin option: `/plugin` > Installed > jev-toolscope > Configure options, then start a new session. This command cannot test the key itself; the key reaches hooks only.
- **`timeout`** — Jev answered slower than `timeoutMs`; every such prompt ran with an open scope.
- **`scan-only` source** — the transcript gave no live tool list. Either tool search is off (all MCP tools load up front), or Claude Code changed its internal transcript format. The whole catalog is judged instead, which still works but may include servers that are not connected.
- **No prompt judged yet** — send any prompt in a session where the plugin is enabled, then run this again.
