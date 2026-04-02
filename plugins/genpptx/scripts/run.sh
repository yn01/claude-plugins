#!/bin/bash
# Internal helper: run a bundled genpptx script with dependencies auto-installed.
# Usage: bash run.sh <script-name.mjs> [args...]
# This script is called by genpptx commands. Do not run directly.

SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Install dependencies on first use (or after plugin update)
if [ ! -d "$SCRIPTS_DIR/node_modules" ]; then
  echo "genpptx: installing dependencies (first run)..." >&2
  (cd "$SCRIPTS_DIR" && npm install --silent) || {
    echo "genpptx: npm install failed" >&2
    exit 1
  }
fi

# Run from the user's working directory so relative paths in arguments work correctly
exec node "$SCRIPTS_DIR/src/$1" "${@:2}"
