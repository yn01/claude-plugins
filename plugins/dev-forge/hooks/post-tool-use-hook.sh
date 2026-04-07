#!/usr/bin/env bash
# dev-forge post-tool-use hook
# Detects iteration completion signals and prompts for learnings recording.

DB=".dev-forge/dev-forge.db"
TOOL_OUTPUT="${CLAUDE_TOOL_OUTPUT:-}"

if [ -z "$TOOL_OUTPUT" ] || [ ! -f "$DB" ]; then
  exit 0
fi

COMPLETION_PATTERNS="EVALUATION PASS|contract completed|iteration complete|all criteria met|PASS:"

if echo "$TOOL_OUTPUT" | grep -iE "$COMPLETION_PATTERNS" > /dev/null 2>&1; then
  ITERATION=$(sqlite3 "$DB" "SELECT COALESCE(MAX(iteration), 0) + 1 FROM learnings" 2>/dev/null || echo 1)
  echo "💡 dev-forge: Iteration ${ITERATION} appears complete."
  echo "   Consider recording learnings: /dev-forge:learn record --iteration ${ITERATION}"
fi
