---
description: Add or remove specialist agents from a team
allowed-tools: Read, Write, Bash
argument-hint: "<subcommand> <team> <template|agent-id>"
---
# dev-forge:agent skill

## When to use this skill
Use this skill when:
- A team needs a specialist (security, performance, devops, doc-writer) for a specific task
- Removing a specialist agent after their work is complete
- Auditing the agents assigned to each team

## Available templates
`security-auditor`, `performance-analyst`, `devops-engineer`, `doc-writer`

## Subcommands
- `add <team> <template>` — add a specialist agent to a team
- `remove <team> <agent-id>` — remove an agent from a team
- `list [<team>]` — list agents, optionally filtered by team

Refer to `commands/agent.md` for full implementation.
