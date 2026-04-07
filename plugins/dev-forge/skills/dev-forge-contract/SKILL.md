---
description: Manage sprint contracts (create, list, complete, report)
allowed-tools: Read, Write, Bash, Glob, Grep
argument-hint: "<subcommand> [args]"
---
# dev-forge:contract skill

## When to use this skill
Use this skill when:
- A new task needs to be formally assigned to a team lead
- The user asks to "create a contract", "assign work to a team", or "set up a sprint"
- Checking the status of ongoing or completed contracts
- Generating a sprint report

## Subcommands
- `create <team-lead> "<task>"` — create a new contract with acceptance criteria
- `list [active|completed|blocked]` — list contracts with optional status filter
- `complete <contract-id> [notes]` — mark a contract as completed
- `report` — generate a sprint summary from completed contracts

Refer to `commands/contract.md` for full implementation.
