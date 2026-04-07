#!/usr/bin/env bash
# dev-forge pre-compact hook
# Persists agent working state to SQLite before Claude Code compacts context.

DB=".dev-forge/dev-forge.db"
AGENT="${DEV_FORGE_AGENT_NAME:-}"
TASK="${DEV_FORGE_CURRENT_TASK:-}"

if [ ! -f "$DB" ] || [ -z "$AGENT" ]; then
  exit 0
fi

sqlite3 "$DB" "UPDATE agent_status SET last_active=datetime('now'), current_task='${TASK}' WHERE agent_name='${AGENT}'" 2>/dev/null

echo "dev-forge: State persisted for agent '${AGENT}' before context compaction."
