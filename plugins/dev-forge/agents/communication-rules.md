# Communication Rules

All dev-forge agents must follow these rules for inter-agent communication.
Messages are sent via SQLite INSERT into the `messages` table in `.dev-forge/dev-forge.db`.

## Four Guiding Principles

1. **Orchestrator never contacts team members directly.** The Orchestrator delegates only to Team Leads and cross-team agents.
2. **Cross-team agents (doc-manager, release-manager, explorer) contact only Orchestrator and Team Leads.** They must not message individual team members.
3. **Team Leads bridge the Orchestrator and their team.** They receive direction from above and delegate below.
4. **Within a team, communication is free.** Team Lead, Implementer, Evaluator, and Reviewer may contact each other freely within the same team.

## Communication Matrix

| Agent | Can Contact |
|---|---|
| orchestrator | team leads, cross-team agents |
| doc-manager | orchestrator, team leads |
| release-manager | orchestrator, team leads |
| explorer | orchestrator, team leads |
| team-*-lead | orchestrator, cross-team agents, own team members |
| implementer-* | own team lead, own evaluator, own reviewer |
| evaluator-* | own team lead, own implementer |
| reviewer-* | own team lead, own implementer |

## Hierarchy

```
orchestrator
├── doc-manager
├── release-manager
├── explorer
├── team-alpha-lead
│   ├── implementer-alpha
│   ├── evaluator-alpha
│   └── reviewer-alpha
└── team-beta-lead
    ├── implementer-beta
    ├── evaluator-beta
    └── reviewer-beta
```

## How to Send a Message

Use the SQLite CLI to insert messages atomically:

```bash
sqlite3 .dev-forge/dev-forge.db \
  "INSERT INTO messages (to_agent, from_agent, content, status, created_at)
   VALUES ('$TARGET_AGENT', '$MY_AGENT_ID', '$MESSAGE_CONTENT', 'unread', datetime('now'))"
```

On Windows (PowerShell):
```powershell
sqlite3.exe .dev-forge\dev-forge.db `
  "INSERT INTO messages (to_agent, from_agent, content, status, created_at) VALUES ('$targetAgent', '$myAgentId', '$messageContent', 'unread', datetime('now'))"
```

## How to Receive Messages

```bash
sqlite3 .dev-forge/dev-forge.db \
  "SELECT id, from_agent, content, created_at FROM messages
   WHERE to_agent='$MY_AGENT_ID' AND status='unread'
   ORDER BY created_at ASC"
```

Mark messages as read after processing:
```bash
sqlite3 .dev-forge/dev-forge.db \
  "UPDATE messages SET status='read', read_at=datetime('now') WHERE id=$MESSAGE_ID"
```

## Communication Violation

If you believe a message was sent to you from an unauthorized agent, do not reply.
The `pre-tool-use` hook will block unauthorized sends and log them to the `violation_log` table.
If you need to escalate an issue to an agent you cannot contact, route through your Team Lead or the Orchestrator.
