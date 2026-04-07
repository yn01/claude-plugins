#!/usr/bin/env bash
# dev-forge session-end hook
# Updates agent status, writes session learnings summary, prompts wiki lint.

DB=".dev-forge/dev-forge.db"

if [ ! -f "$DB" ]; then
  exit 0
fi

# Mark all agents as stopped
sqlite3 "$DB" "UPDATE agent_status SET status='stopped', last_active=datetime('now')" 2>/dev/null

# Count untagged learnings from this session
SESSION_ID=$(date +%Y%m%d)
count=$(sqlite3 "$DB" "SELECT COUNT(*) FROM learnings WHERE session_id='$SESSION_ID'" 2>/dev/null || echo 0)

if [ "${count:-0}" -gt 0 ]; then
  echo "📚 dev-forge: ${count} learning(s) recorded this session. Run /dev-forge:learn review to organize."
fi

# Check wiki for issues
WIKI_DIR=".dev-forge/wiki"
if [ -d "$WIKI_DIR" ] && [ -n "$(ls -A "$WIKI_DIR" 2>/dev/null)" ]; then
  orphaned=$(find "$WIKI_DIR" -name "*.md" -size 0 2>/dev/null | wc -l | tr -d ' ')
  if [ "${orphaned:-0}" -gt 0 ]; then
    echo "⚠️  dev-forge wiki: ${orphaned} empty file(s) detected. Run /dev-forge:wiki lint to clean up."
  fi
fi
