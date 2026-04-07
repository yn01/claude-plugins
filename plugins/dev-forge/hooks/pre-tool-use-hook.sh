#!/usr/bin/env bash
# dev-forge pre-tool-use hook
# Validates communication rules before an agent sends a message via SQLite INSERT.
# Blocks unauthorized sends and logs violations.

DB=".dev-forge/dev-forge.db"
TOOL_INPUT="${CLAUDE_TOOL_INPUT:-}"

if [ ! -f "$DB" ] || [ -z "$TOOL_INPUT" ]; then
  exit 0
fi

# Only check if this is a messages INSERT
if ! echo "$TOOL_INPUT" | grep -q "INSERT INTO messages"; then
  exit 0
fi

# Extract from_agent and to_agent using grep
FROM=$(echo "$TOOL_INPUT" | grep -oP "from_agent['\",\s]+'\K[^']+" | head -1)
TO=$(echo "$TOOL_INPUT" | grep -oP "to_agent['\",\s]+'\K[^']+" | head -1)

if [ -z "$FROM" ] || [ -z "$TO" ]; then
  exit 0
fi

# Check communication rules
allowed=$(sqlite3 "$DB" "SELECT COALESCE(allowed, 0) FROM communication_rules WHERE from_agent='${FROM}' AND to_agent='${TO}'" 2>/dev/null)

if [ "${allowed:-0}" = "0" ]; then
  # Log violation
  snippet="${TOOL_INPUT:0:200}"
  sqlite3 "$DB" "INSERT INTO violation_log (from_agent, to_agent, message_content, attempted_at) VALUES ('${FROM}', '${TO}', '${snippet//\'/}', datetime('now'))" 2>/dev/null

  echo "COMMUNICATION VIOLATION: '${FROM}' is not authorized to contact '${TO}'."
  echo "Message blocked and logged to violation_log."
  echo ""
  echo "Allowed contacts for '${FROM}':"
  sqlite3 "$DB" "SELECT to_agent FROM communication_rules WHERE from_agent='${FROM}' AND allowed=1" 2>/dev/null | sed 's/^/  - /'
  exit 1
fi
