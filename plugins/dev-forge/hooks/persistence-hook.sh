#!/usr/bin/env bash
# dev-forge persistence hook (PostToolUse)
# Detects abandonment language in tool output and prompts re-engagement.

OUTPUT="${CLAUDE_TOOL_OUTPUT:-}"

ABANDON_PATTERNS="cannot continue|I'll stop|unable to proceed|I give up|too complex to|I am unable|I cannot complete"

if echo "$OUTPUT" | grep -iE "$ABANDON_PATTERNS" > /dev/null 2>&1; then
  echo "🔄 dev-forge persistence: Task abandonment language detected."
  echo "   Please break the task into smaller steps and continue with the next step."
  echo "   If genuinely blocked, route to your Team Lead or Orchestrator via SQLite messages."
fi
