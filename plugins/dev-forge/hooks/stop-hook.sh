#!/usr/bin/env bash
# dev-forge stop-hook
# Warns if there are active contracts when exiting without /dev-forge:stop.

DB=".dev-forge/dev-forge.db"

if [ ! -f "$DB" ] || [ -n "$EXIT_SIGNAL" ]; then
  exit 0
fi

active=$(sqlite3 "$DB" "SELECT COUNT(*) FROM contracts WHERE status='active'" 2>/dev/null || echo 0)

if [ "${active:-0}" -gt 0 ]; then
  echo "⚠️  dev-forge: ${active} active contract(s) in progress."
  echo "   Run /dev-forge:stop to gracefully shut down, or set EXIT_SIGNAL=true to force exit."
fi
