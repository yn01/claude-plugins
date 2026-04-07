---
description: Manage communication routing rules in the dev-forge database
allowed-tools: Bash
argument-hint: "<subcommand> [args]"
---
# dev-forge:route skill

## When to use this skill
Use this skill when:
- Debugging communication violations or blocked messages
- Customizing communication topology beyond the default hierarchy
- Adding temporary cross-team communication routes for a specific sprint
- Persisting runtime route changes back to `devforge.yaml`

## Subcommands
- `list` — show all routes and their allowed/blocked status
- `show <agent>` — show all incoming and outgoing routes for an agent
- `add <from> <to>` — enable a communication route
- `remove <from> <to>` — disable a communication route
- `save` — write current routes back to `devforge.yaml`

Refer to `commands/route.md` for full implementation.
