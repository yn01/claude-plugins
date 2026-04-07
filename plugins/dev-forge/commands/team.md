---
description: Manage dev-forge teams dynamically (add, remove, list)
allowed-tools: Read, Write, Bash
argument-hint: "<subcommand> [args]"
---
# /dev-forge:team

Manage dev-forge teams. Team changes are saved to `devforge.yaml` and the SQLite database. A restart (`/dev-forge:stop && /dev-forge:start`) is required to launch new agents.

## Subcommands

### add

```
/dev-forge:team add <team-name>
```

1. Read `devforge.yaml`
2. Check team name doesn't already exist
3. Append new team entry with default members (lead, implementer, evaluator, reviewer):
   ```yaml
   - name: <team-name>
     lead:
       model: claude-sonnet-4-6
       can_contact: [orchestrator, doc-manager, release-manager, explorer, implementer-<name>, evaluator-<name>, reviewer-<name>]
     members:
       - id: implementer-<name>
         role: implementer
         model: claude-sonnet-4-6
         can_contact: [team-<name>-lead, evaluator-<name>, reviewer-<name>]
       - id: evaluator-<name>
         role: evaluator
         model: claude-sonnet-4-6
         can_contact: [team-<name>-lead, implementer-<name>]
       - id: reviewer-<name>
         role: reviewer
         model: claude-sonnet-4-6
         can_contact: [team-<name>-lead, implementer-<name>]
   ```
4. Write back to `devforge.yaml`
5. Pre-register in SQLite:
   ```bash
   DB=".dev-forge/dev-forge.db"
   for agent in "team-$NAME-lead" "implementer-$NAME" "evaluator-$NAME" "reviewer-$NAME"; do
     sqlite3 "$DB" "INSERT OR IGNORE INTO agent_status (agent_name, status, model, last_active) VALUES ('$agent', 'stopped', 'claude-sonnet-4-6', datetime('now'))"
   done
   ```
6. Also add orchestrator -> team-lead can_contact rule:
   ```bash
   sqlite3 "$DB" "INSERT OR REPLACE INTO communication_rules (from_agent, to_agent, allowed) VALUES ('orchestrator', 'team-$NAME-lead', 1)"
   ```
7. Output: `Team '$NAME' added to devforge.yaml. Run /dev-forge:stop && /dev-forge:start to launch agents.`

### remove

```
/dev-forge:team remove <team-name>
```

1. Check for active contracts assigned to this team's lead:
   ```bash
   active=$(sqlite3 "$DB" "SELECT COUNT(*) FROM contracts WHERE team_lead='team-$NAME-lead' AND status='active'")
   ```
   If >0, abort with warning.
2. Kill tmux sessions for the team (if running)
3. Remove team from `devforge.yaml`
4. Update `agent_status` to `stopped` for all team agents
5. Remove `communication_rules` rows

### list

```
/dev-forge:team list
```

Parse `devforge.yaml` teams section and cross-reference with `agent_status` for live state. Display formatted team summary.
