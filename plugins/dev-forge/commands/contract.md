---
description: Manage sprint contracts (create, list, complete, report)
allowed-tools: Read, Write, Bash, Glob, Grep
argument-hint: "<subcommand> [args]"
---
# /dev-forge:contract

Manage sprint contracts backed by the SQLite `contracts` table.

## Subcommands

### create

```
/dev-forge:contract create <team-lead> "<task description>"
```

**Steps:**
1. Generate contract ID: `CONTRACT-$(date +%Y%m%d-%H%M%S)`
2. Prompt the user to enter acceptance criteria (one per line, blank line to finish)
3. Convert criteria to JSON array: `'["criterion 1", "criterion 2"]'`
4. Insert into contracts:
   ```bash
   DB=".dev-forge/dev-forge.db"
   sqlite3 "$DB" "INSERT INTO contracts (id, task, team_lead, status, criteria, created_at) VALUES ('$CONTRACT_ID', '$TASK', '$TEAM_LEAD', 'active', '$CRITERIA_JSON', datetime('now'))"
   ```
5. Send notification to team lead:
   ```bash
   sqlite3 "$DB" "INSERT INTO messages (to_agent, from_agent, content, status, created_at) VALUES ('$TEAM_LEAD', 'user', 'New sprint contract assigned: $CONTRACT_ID\nTask: $TASK\nCriteria: $CRITERIA_JSON', 'unread', datetime('now'))"
   ```
6. Output: `Contract $CONTRACT_ID created and assigned to $TEAM_LEAD`

### list

```
/dev-forge:contract list [active|completed|blocked]
```

Query contracts with optional status filter:
```bash
FILTER="${1:-}"
if [ -n "$FILTER" ]; then
  WHERE="WHERE status='$FILTER'"
fi
sqlite3 "$DB" "SELECT id, status, team_lead, task, created_at FROM contracts $WHERE ORDER BY created_at DESC"
```

Display as a formatted table.

### complete

```
/dev-forge:contract complete <contract-id> [notes]
```

1. Verify contract exists and is active
2. Update:
   ```bash
   sqlite3 "$DB" "UPDATE contracts SET status='completed', completed_at=datetime('now'), notes='$NOTES' WHERE id='$CONTRACT_ID'"
   ```
3. Notify orchestrator:
   ```bash
   sqlite3 "$DB" "INSERT INTO messages (to_agent, from_agent, content, status, created_at) VALUES ('orchestrator', 'user', 'Contract $CONTRACT_ID marked complete.', 'unread', datetime('now'))"
   ```

### report

```
/dev-forge:contract report
```

Generate a sprint summary from completed contracts:
```bash
sqlite3 "$DB" "SELECT id, task, team_lead, completed_at, notes FROM contracts WHERE status='completed' ORDER BY completed_at DESC"
```

Display as a formatted Markdown report with total count and completion dates.
