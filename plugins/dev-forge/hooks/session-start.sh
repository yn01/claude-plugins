#!/usr/bin/env bash
# dev-forge session-start hook
# Counts unread messages in the SQLite database and notifies the user.

DB=".dev-forge/dev-forge.db"

if [ ! -f "$DB" ]; then
  exit 0
fi

count=$(sqlite3 "$DB" "SELECT COUNT(*) FROM messages WHERE status='unread'" 2>/dev/null || echo 0)

if [ "${count:-0}" -gt 0 ]; then
  echo "📬 dev-forge: You have ${count} unread message(s). Run /dev-forge:status to review."
fi
