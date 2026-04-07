---
description: Send a message to a specific dev-forge agent
allowed-tools: Bash
argument-hint: "<agent-name> <message>"
---
# dev-forge:send skill

## When to use this skill
Use this skill when:
- The user wants to communicate directly with a specific agent
- A message needs to be injected into an agent's queue from the human operator
- Directing an agent to start a specific task or provide a status update

## Steps
Refer to `commands/send.md`:
1. Validate the agent exists in `agent_status`
2. Insert message into `messages` table with `from_agent='user'`
3. Confirm with the message ID
