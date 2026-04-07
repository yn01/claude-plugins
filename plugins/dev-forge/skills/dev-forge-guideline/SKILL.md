---
description: Add and list project guidelines for dev-forge agents
allowed-tools: Read, Write, Bash, Glob
argument-hint: "<subcommand> [args]"
---
# dev-forge:guideline skill

## When to use this skill
Use this skill when:
- A new project coding standard or team rule needs to be documented
- Reviewing what guidelines are currently active (referenced by Reviewer agent)
- Importing an existing style guide or ruleset into the guidelines zone

Note: Guidelines are a **human-managed zone**. LLM agents do not auto-update them.

## Subcommands
- `add "<title>" "<content>"` — add a new guideline
- `add --file <path>` — import a guideline from a file
- `list` — list all active guidelines

Refer to `commands/guideline.md` for full implementation.
