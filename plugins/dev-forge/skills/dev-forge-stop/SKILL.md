---
description: Stop all dev-forge agents and archive unread messages
allowed-tools: Bash, Glob
---
# dev-forge:stop skill

## When to use this skill
Use this skill when:
- The user says "stop dev-forge", "shut down the team", or "end the session"
- A `/dev-forge:stop` command is issued
- The development session is ending and agents need to be gracefully terminated

## Steps
Refer to `commands/stop.md` for the full implementation steps:
1. Archive unread messages to `.dev-forge/archive/`
2. Kill all `dev-forge-*` tmux sessions (or Windows processes)
3. Update all `agent_status` rows to `stopped`
4. Output summary of terminated sessions and archived messages
