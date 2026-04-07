---
description: Show agent status, message queue counts, and active contracts
allowed-tools: Bash
---
# dev-forge:status skill

## When to use this skill
Use this skill when:
- The user asks "what's the status?", "how are the agents doing?", or "show me the queue"
- An agent needs to check system state without explicit human `/dev-forge:status` invocation
- Monitoring agent health during a long sprint
- Debugging communication or queue issues

## Steps
Refer to `commands/status.md` for the full implementation:
1. Query `agent_status` and cross-reference with live tmux sessions
2. Display unread message counts per agent
3. Show all active contracts with team lead and task
