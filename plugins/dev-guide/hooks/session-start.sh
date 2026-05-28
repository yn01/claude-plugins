#!/usr/bin/env bash
# dev-guide session-start hook
# If .dev-guide/index.md exists, prints its contents and instructs the agent
# to use /dev-guide:query or /dev-guide:inject for deeper context.

INDEX=".dev-guide/index.md"

if [ ! -f "$INDEX" ]; then
  exit 0
fi

echo "=== dev-guide: Knowledge Base Available ==="
echo ""
cat "$INDEX"
echo ""
echo "Use /dev-guide:query <question> to retrieve relevant pages."
echo "Use /dev-guide:inject <topic>   to load a specific topic into context."
