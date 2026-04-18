---
description: Add or remove specialist agents from a team
allowed-tools: Read, Write, Bash
argument-hint: "<subcommand> <team> <template|agent-id>"
---
# /dev-forge:agent

Manage individual agents within teams. Add specialist agents from templates or remove existing ones.

## Subcommands

### add

```
/dev-forge:agent add <team-name> <template-name> [--id <custom-id>]
```

Available templates: `security-auditor`, `performance-analyst`, `devops-engineer`, `doc-writer`

1. Verify template file exists in `agents/templates/<template-name>.md`
2. Generate agent ID: `<template-name>-<team-name>` (or use `--id` override)
3. Add to `devforge.yaml` under team members:
   ```yaml
   - id: <agent-id>
     role: <template-name>
     can_contact: [team-<team>-lead]
   ```
4. Resolve default model from active profile, then insert into SQLite:
   ```bash
   DB=".dev-forge/dev-forge.db"
   ACTIVE_PROFILE=$(sqlite3 "$DB" "SELECT value FROM config WHERE key='model_profile'" 2>/dev/null || echo "balanced")
   DEFAULT_ALIAS=$(awk "/^model_profiles:/{p=1} p && /^  $ACTIVE_PROFILE:/{q=1} q && /^    default:/{print \$2; exit}" devforge.yaml)
   case "${DEFAULT_ALIAS:-sonnet}" in
     opus)   DEFAULT_MODEL="claude-opus-4-6" ;;
     sonnet) DEFAULT_MODEL="claude-sonnet-4-6" ;;
     haiku)  DEFAULT_MODEL="claude-haiku-4-5-20251001" ;;
     *)      DEFAULT_MODEL="${DEFAULT_ALIAS:-claude-sonnet-4-6}" ;;
   esac
   sqlite3 "$DB" "INSERT OR REPLACE INTO agent_status (agent_name, status, model, last_active) VALUES ('$AGENT_ID', 'stopped', '$DEFAULT_MODEL', datetime('now'))"
   sqlite3 "$DB" "INSERT OR REPLACE INTO communication_rules (from_agent, to_agent, allowed) VALUES ('$AGENT_ID', 'team-$TEAM-lead', 1)"
   sqlite3 "$DB" "INSERT OR REPLACE INTO communication_rules (from_agent, to_agent, allowed) VALUES ('team-$TEAM-lead', '$AGENT_ID', 1)"
   ```
5. Output: `Agent '$AGENT_ID' (template: $TEMPLATE) added to team '$TEAM'. Run /dev-forge:stop && /dev-forge:start to activate.`

### remove

```
/dev-forge:agent remove <team-name> <agent-id>
```

1. Check for pending unread messages for this agent
2. Kill tmux session if running
3. Remove from `devforge.yaml`
4. Update `agent_status` to `stopped`
5. Remove communication rules

### list

```
/dev-forge:agent list [<team-name>]
```

Display all agents, optionally filtered by team. Show agent ID, role, model, and current status from SQLite.
