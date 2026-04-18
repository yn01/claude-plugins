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

# Helper: convert full model ID to short alias for display
short_model() {
  case "$1" in
    claude-opus-4-6)            echo "opus" ;;
    claude-sonnet-4-6)          echo "sonnet" ;;
    claude-haiku-4-5-20251001)  echo "haiku" ;;
    *)                          echo "$1" ;;
  esac
}

# Read active profile and compute expected model per agent for override detection
ACTIVE_PROFILE=$(sqlite3 "$DB" "SELECT value FROM config WHERE key='model_profile'" 2>/dev/null || echo "balanced")

# Build expected model map from devforge.yaml profile (if file exists)
declare -A EXPECTED_MODEL
if [ -f "devforge.yaml" ]; then
  while IFS= read -r agent_name; do
    # Look up agent-specific override in profile, else use default
    agent_alias=$(awk "
      /^model_profiles:/ { in_profiles=1; next }
      in_profiles && /^  $ACTIVE_PROFILE:/ { in_profile=1; next }
      in_profile && /^  [a-z]/ && !/^  $ACTIVE_PROFILE:/ { in_profile=0 }
      in_profile && /^    $agent_name:/ { print \$2; exit }
    " devforge.yaml)
    if [ -z "$agent_alias" ]; then
      agent_alias=$(awk "
        /^model_profiles:/ { in_profiles=1; next }
        in_profiles && /^  $ACTIVE_PROFILE:/ { in_profile=1; next }
        in_profile && /^  [a-z]/ && !/^  $ACTIVE_PROFILE:/ { in_profile=0 }
        in_profile && /^    default:/ { print \$2; exit }
      " devforge.yaml)
    fi
    case "${agent_alias:-sonnet}" in
      opus)   EXPECTED_MODEL[$agent_name]="claude-opus-4-6" ;;
      sonnet) EXPECTED_MODEL[$agent_name]="claude-sonnet-4-6" ;;
      haiku)  EXPECTED_MODEL[$agent_name]="claude-haiku-4-5-20251001" ;;
      *)      EXPECTED_MODEL[$agent_name]="${agent_alias}" ;;
    esac
  done < <(sqlite3 "$DB" "SELECT agent_name FROM agent_status ORDER BY agent_name")
fi

echo "=== Agent Status ===  [profile: $ACTIVE_PROFILE]"
echo ""
printf "%-25s %-10s %-12s %-20s %-28s\n" "Agent" "Model" "DB Status" "Live Session" "Last Active"
printf "%-25s %-10s %-12s %-20s %-28s\n" "─────────────────────────" "──────────" "───────────" "────────────────────" "────────────────────────────"

OVERRIDE_COUNT=0
sqlite3 "$DB" "SELECT agent_name, status, model, last_active FROM agent_status ORDER BY agent_name" | while IFS='|' read agent db_status model last_active; do
  live="stopped"
  tmux has-session -t "dev-forge-$agent" 2>/dev/null && live="running"
  short=$(short_model "$model")
  # Mark overrides with *
  expected="${EXPECTED_MODEL[$agent]}"
  if [ -n "$expected" ] && [ "$model" != "$expected" ]; then
    short="${short}*"
    OVERRIDE_COUNT=$((OVERRIDE_COUNT + 1))
  fi
  printf "%-25s %-10s %-12s %-20s %-28s\n" "$agent" "$short" "$db_status" "$live" "${last_active:-never}"
done

if [ "$OVERRIDE_COUNT" -gt 0 ]; then
  echo ""
  echo "  * = overridden from profile default. Use /dev-forge:model reset to restore."
fi
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
