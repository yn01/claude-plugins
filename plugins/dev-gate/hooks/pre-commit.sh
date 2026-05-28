#!/usr/bin/env bash
# dev-gate pre-commit hook
# Fires on PreToolUse (Bash). Reads the tool input from stdin to check whether
# the command being executed is a git commit, then warns if open gates exist.
# Does not block the commit — advisory only.

# Read stdin JSON (Claude Code passes tool input as JSON on stdin)
input=$(cat 2>/dev/null)

# Only act when the bash command looks like a git commit
command=$(echo "$input" | grep -o '"command":"[^"]*"' | head -1 | sed 's/"command":"//;s/"//')
if ! echo "$command" | grep -q "git commit"; then
  exit 0
fi

ACTIVE_DIR=".dev-gate/active"

if [ ! -d "$ACTIVE_DIR" ]; then
  exit 0
fi

open_count=0
for f in "$ACTIVE_DIR"/*.md; do
  [ -f "$f" ] || continue
  if grep -q "^open$" "$f" 2>/dev/null; then
    open_count=$((open_count + 1))
  fi
done

if [ "$open_count" -gt 0 ]; then
  echo "⚠️  dev-gate: ${open_count} open gate(s) found. Run /dev-gate:verify to check completion criteria."
fi

exit 0
