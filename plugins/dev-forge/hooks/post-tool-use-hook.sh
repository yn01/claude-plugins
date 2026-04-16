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
  NEXT=$(sqlite3 "$DB" "SELECT COALESCE(MAX(iteration), 0) + 1 FROM learnings" 2>/dev/null || echo 1)
  echo "💡 dev-forge: Iteration complete. Consider recording learnings (next number: #${NEXT})."
  echo "   Auto-assign: /dev-forge:learn record --mistake \"...\" --pattern \"...\" --recommendation \"...\" --impact <level>"
  echo "   Manual:      /dev-forge:learn record --iteration ${NEXT} --mistake \"...\" ..."
  echo "   Check state: /dev-forge:learn status"
fi
