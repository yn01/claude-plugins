#!/usr/bin/env bash
# dev-forge scope-check hook (PreToolUse on Write/Edit/MultiEdit)
# Blocks direct modification of the SQLite DB and out-of-project-root file edits.

TARGET_FILE="${CLAUDE_TOOL_INPUT_PATH:-}"

if [ -z "$TARGET_FILE" ]; then
  exit 0
fi

# Block direct modification of the database file
if echo "$TARGET_FILE" | grep -q "\.dev-forge/dev-forge\.db"; then
  echo "BLOCKED: Direct modification of .dev-forge/dev-forge.db is not allowed."
  echo "         Use sqlite3 commands instead: sqlite3 .dev-forge/dev-forge.db \"...\""
  exit 1
fi

# Block modifications outside project root
PROJECT_ROOT=$(pwd)
# Resolve path without requiring the file to exist:
# If absolute path, use as-is. If relative, prepend PROJECT_ROOT.
if echo "$TARGET_FILE" | grep -q "^/"; then
  REAL_TARGET="$TARGET_FILE"
else
  REAL_TARGET="${PROJECT_ROOT}/${TARGET_FILE}"
fi

if ! echo "$REAL_TARGET" | grep -q "^${PROJECT_ROOT}"; then
  echo "BLOCKED: $TARGET_FILE is outside the project root ($PROJECT_ROOT)."
  exit 1
fi
