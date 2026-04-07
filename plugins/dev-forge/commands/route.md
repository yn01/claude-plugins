---
description: Manage communication routing rules in the dev-forge database
allowed-tools: Bash
argument-hint: "<subcommand> [args]"
---
# /dev-forge:route

Manage the `communication_rules` table directly. Route changes take effect immediately (no restart needed).

## Subcommands

### list

```
/dev-forge:route list
```

```bash
DB=".dev-forge/dev-forge.db"
echo "From Agent              -> To Agent               Allowed"
echo "──────────────────────────────────────────────────────────"
sqlite3 "$DB" "SELECT from_agent, to_agent, allowed FROM communication_rules ORDER BY from_agent, to_agent" | while IFS='|' read from to allowed; do
  status="allowed"
  [ "$allowed" = "0" ] && status="blocked"
  printf "%-24s -> %-24s %s\n" "$from" "$to" "$status"
done
```

### show

```
/dev-forge:route show <agent-name>
```

Show all routes for a specific agent (both outgoing and incoming):

```bash
sqlite3 "$DB" "SELECT 'OUT', to_agent, allowed FROM communication_rules WHERE from_agent='$AGENT'
UNION ALL
SELECT 'IN', from_agent, allowed FROM communication_rules WHERE to_agent='$AGENT'
ORDER BY 1, 2"
```

### add

```
/dev-forge:route add <from-agent> <to-agent>
```

```bash
sqlite3 "$DB" "INSERT OR REPLACE INTO communication_rules (from_agent, to_agent, allowed) VALUES ('$FROM', '$TO', 1)"
echo "Route added: $FROM -> $TO"
```

### remove

```
/dev-forge:route remove <from-agent> <to-agent>
```

```bash
sqlite3 "$DB" "UPDATE communication_rules SET allowed=0 WHERE from_agent='$FROM' AND to_agent='$TO'"
echo "Route disabled: $FROM -> $TO"
```

### save

```
/dev-forge:route save
```

Export current `communication_rules` table back to `devforge.yaml` `can_contact` fields, persisting runtime changes across restarts.

Read all routes from SQLite, group by `from_agent`, and update the corresponding `can_contact` lists in `devforge.yaml`.
