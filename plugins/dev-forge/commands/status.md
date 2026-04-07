---
description: Show agent status, message queue counts, and active contracts
allowed-tools: Bash
---
# /dev-forge:status

Display a real-time dashboard of agent status, unread message counts, and active sprint contracts.

## Steps

### 1. Query agent status and cross-reference with tmux

```bash
DB=".dev-forge/dev-forge.db"

if [ ! -f "$DB" ]; then
  echo "dev-forge not initialized. Run /dev-forge:start first."
  exit 0
fi

echo "=== Agent Status ==="
echo ""
printf "%-25s %-12s %-20s %-28s\n" "Agent" "DB Status" "Live Session" "Last Active"
printf "%-25s %-12s %-20s %-28s\n" "─────────────────────────" "───────────" "────────────────────" "────────────────────────────"

sqlite3 "$DB" "SELECT agent_name, status, model, last_active FROM agent_status ORDER BY agent_name" | while IFS='|' read agent db_status model last_active; do
  live="stopped"
  tmux has-session -t "dev-forge-$agent" 2>/dev/null && live="running"
  printf "%-25s %-12s %-20s %-28s\n" "$agent" "$db_status" "$live" "${last_active:-never}"
done
```

### 2. Show unread message counts per agent

```bash
echo ""
echo "=== Message Queue ==="
echo ""
sqlite3 "$DB" "SELECT to_agent, COUNT(*) as count FROM messages WHERE status='unread' GROUP BY to_agent ORDER BY count DESC" | while IFS='|' read agent count; do
  echo "  $agent: $count unread"
done

total=$(sqlite3 "$DB" "SELECT COUNT(*) FROM messages WHERE status='unread'" 2>/dev/null || echo 0)
echo ""
echo "  Total unread: $total"
```

### 3. Show active contracts

```bash
echo ""
echo "=== Active Contracts ==="
echo ""
sqlite3 "$DB" "SELECT id, team_lead, task, created_at FROM contracts WHERE status='active' ORDER BY created_at" | while IFS='|' read id lead task created; do
  echo "  [$id] -> $lead"
  echo "     Task: $task"
  echo "     Started: $created"
  echo ""
done

active=$(sqlite3 "$DB" "SELECT COUNT(*) FROM contracts WHERE status='active'" 2>/dev/null || echo 0)
echo "  Total active: $active"
```

**Windows (PowerShell):** Use `sqlite3.exe` and replace tmux check with process name check.
