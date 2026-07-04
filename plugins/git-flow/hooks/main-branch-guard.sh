#!/usr/bin/env bash
# git-flow main-branch guard hook
# Fires on PreToolUse (Bash). Reads the tool input from stdin to check whether
# the command being executed is a git commit, then warns if the current branch
# is main/master. Does not block the commit — advisory only.

input=$(cat 2>/dev/null)

command=$(echo "$input" | grep -o '"command":"[^"]*"' | head -1 | sed 's/"command":"//;s/"//')
if ! echo "$command" | grep -q "git commit"; then
  exit 0
fi

branch=$(git branch --show-current 2>/dev/null)
if [ -z "$branch" ]; then
  # not a git repo, or detached HEAD — stay silent
  exit 0
fi

case "$branch" in
  main|master)
    echo "⚠️  git-flow: you are committing directly on '$branch'. Consider branching first:"
    echo "    git switch -c <type>/<issue>-<slug>   (types: feat|fix|docs|chore|refactor)"
    ;;
esac

exit 0
