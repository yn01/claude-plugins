---
description: Manage dev-forge teams dynamically (add, remove, list)
allowed-tools: Read, Write, Bash
argument-hint: "<subcommand> [args]"
---
# dev-forge:team skill

## When to use this skill
Use this skill when:
- The user wants to add a new development team to the project
- A team needs to be removed after its work is complete
- Reviewing the current team structure

## Subcommands
- `add <name>` — add a new team with default members
- `remove <name>` — remove a team (checks for active contracts first)
- `list` — display all teams with live status

Refer to `commands/team.md` for full implementation.
