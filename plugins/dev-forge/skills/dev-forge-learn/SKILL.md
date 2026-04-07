---
description: Record and review dev-forge learnings from sprint iterations
allowed-tools: Bash, Read, Write
argument-hint: "<subcommand> [args]"
---
# dev-forge:learn skill

## When to use this skill
Use this skill when:
- A sprint iteration completes (especially after a PASS evaluation)
- An agent makes a significant mistake that should not be repeated
- Reviewing accumulated learnings before starting a new feature
- Exporting learnings for team knowledge sharing

## Subcommands
- `record` (or no subcommand) — record a new learning entry
- `review [--iteration <n>] [--impact <level>]` — browse learnings with filters
- `export` — write all learnings to `.dev-forge/learnings/all-learnings.md`

Refer to `commands/learn.md` for full implementation.
