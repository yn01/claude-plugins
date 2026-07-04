#!/usr/bin/env bash
# dev-forge session-start hook
# If .dev-forge/guide/index.md exists, injects its contents and instructs the
# agent to use /dev-forge:guide query or inject for deeper context.

INDEX=".dev-forge/guide/index.md"

if [ ! -f "$INDEX" ]; then
  exit 0
fi

echo "=== dev-forge: Guide Knowledge Base Available ==="
echo ""
cat "$INDEX"
echo ""
echo "Use /dev-forge:guide query <question> to retrieve relevant pages."
echo "Use /dev-forge:guide inject <topic>   to load a specific topic into context."
