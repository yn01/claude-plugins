---
name: communication-rules
description: Defines allowed and prohibited message queue communication paths between all devteam agents
---

# DevTeam Communication Rules

This document defines the message queue communication rules for all agents. Every agent must read and follow these rules. Sending a message to a prohibited destination is a violation of the chain of command.

## Guiding Principles

1. **Orchestrator never directs team members directly** — all instructions go through the Team Lead
2. **Cross-team agents (doc-manager, release-manager, explorer) communicate only with Orchestrator or Team Leads** — no direct contact with team members
3. **Team Leads are the coordination interface with the outside** — they may contact Orchestrator and cross-team agents
4. **Within a team, communication is free** — implementer / reviewer / evaluator may contact each other without going through the Team Lead

## Communication Matrix

### Orchestrator

| Direction | Allowed | Prohibited |
|-----------|---------|------------|
| **Can send to** | team-alpha-lead, team-beta-lead, doc-manager, release-manager, explorer | implementer-a, implementer-b, reviewer-a, reviewer-b, evaluator-a, evaluator-b |
| **Can receive from** | team-alpha-lead, team-beta-lead, doc-manager, release-manager, explorer | (same as above) |

### Cross-team Agents (doc-manager / release-manager / explorer)

| Direction | Allowed | Prohibited |
|-----------|---------|------------|
| **Can send to** | orchestrator, team-alpha-lead, team-beta-lead | implementer-a, implementer-b, reviewer-a, reviewer-b, evaluator-a, evaluator-b |
| **Can receive from** | orchestrator, team-alpha-lead, team-beta-lead | (same as above) |

### Team Alpha Lead

| Direction | Allowed | Prohibited |
|-----------|---------|------------|
| **Can send to** | orchestrator, doc-manager, release-manager, explorer, implementer-a, reviewer-a, evaluator-a | team-beta-lead, implementer-b, reviewer-b, evaluator-b |
| **Can receive from** | orchestrator, doc-manager, release-manager, explorer, implementer-a, reviewer-a, evaluator-a | (same as above) |

### Team Alpha Members (implementer-a / reviewer-a / evaluator-a)

| Direction | Allowed | Prohibited |
|-----------|---------|------------|
| **Can send to** | team-alpha-lead, implementer-a, reviewer-a, evaluator-a (within team freely) | orchestrator, doc-manager, release-manager, explorer, team-beta-lead, implementer-b, reviewer-b, evaluator-b |
| **Can receive from** | team-alpha-lead, implementer-a, reviewer-a, evaluator-a | (same as above) |

### Team Beta Lead and Members

Same rules as Team Alpha, scoped to the Beta team (team-beta-lead, implementer-b, reviewer-b, evaluator-b).

## Quick Reference

```
Orchestrator
  ├── doc-manager          ↔ Orchestrator, Team Leads only
  ├── release-manager      ↔ Orchestrator, Team Leads only
  ├── explorer             ↔ Orchestrator, Team Leads only
  ├── team-alpha-lead      ↔ Orchestrator, cross-team agents, own team
  │   ├── implementer-a    ↔ team-alpha-lead + within team freely
  │   ├── reviewer-a       ↔ team-alpha-lead + within team freely
  │   └── evaluator-a      ↔ team-alpha-lead + within team freely
  └── team-beta-lead       ↔ Orchestrator, cross-team agents, own team
      ├── implementer-b    ↔ team-beta-lead + within team freely
      ├── reviewer-b       ↔ team-beta-lead + within team freely
      └── evaluator-b      ↔ team-beta-lead + within team freely
```

## How to Send a Message

Write a file to the target agent's inbox:

```bash
TIMESTAMP=$(date -u +"%Y-%m-%dT%H-%M-%S")
TARGET_AGENT="<target-agent-name>"
cat > ".claude/messages/inbox/${TARGET_AGENT}/${TIMESTAMP}_from-<your-agent-name>.md" << 'EOF'
<message content>
EOF
```

**Before sending, always verify:**
- Is `<target-agent-name>` in your allowed list above?
- If not, escalate to your Team Lead or Orchestrator instead.
