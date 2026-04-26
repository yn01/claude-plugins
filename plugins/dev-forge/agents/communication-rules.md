---
name: communication-rules
description: Inter-agent communication rules and SQLite messaging patterns for dev-forge agents
---

# Communication Rules

All dev-forge agents must follow these rules for inter-agent communication.
Messages are sent via SQLite INSERT into the `messages` table in `.dev-forge/dev-forge.db`.

## Four Guiding Principles

1. **Orchestrator never contacts team members, doc-manager, or release-manager directly.** The Orchestrator delegates only to the Project Manager and explorer. All planning, documentation, and release coordination go through the Project Manager.
2. **Project Manager is the planning and execution hub.** The Project Manager receives delegated work from the Orchestrator, creates sprint contracts, directs Team Leads, and manages doc-manager and release-manager. The Project Manager does not contact the user directly.
3. **doc-manager and release-manager report to Project Manager.** They do not report to the Orchestrator. Exception: release-manager may contact Orchestrator directly to request Go/No-Go approval on a release.
4. **Team Leads bridge the Project Manager and their team.** They receive direction from the Project Manager and delegate below. They do not contact the Orchestrator directly.
5. **explorer is a shared resource.** Orchestrator, Project Manager, and Team Leads may all request exploration tasks from explorer. Explorer returns results to whoever made the request.
6. **Within a team, communication is free.** Team Lead, Implementer, Evaluator, and Reviewer may contact each other freely within the same team.

## Communication Matrix

| Agent | Can Contact |
|---|---|
| orchestrator | project-manager, explorer |
| project-manager | orchestrator, team leads, doc-manager, release-manager, explorer |
| doc-manager | project-manager, team leads |
| release-manager | project-manager, orchestrator (Go/No-Go approval only), team leads |
| explorer | orchestrator, project-manager, team leads |
| team-*-lead | project-manager, cross-team agents, own team members |
| implementer-* | own team lead, own evaluator, own reviewer |
| evaluator-* | own team lead, own implementer |
| reviewer-* | own team lead, own implementer |

## Hierarchy

```
orchestrator
└── project-manager
    ├── team-alpha-lead
    │   ├── implementer-alpha
    │   ├── evaluator-alpha
    │   └── reviewer-alpha
    ├── team-beta-lead
    │   ├── implementer-beta
    │   ├── evaluator-beta
    │   └── reviewer-beta
    ├── doc-manager
    └── release-manager

explorer — shared resource (accessible by orchestrator, project-manager, and team leads)
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
If you need to escalate an issue to an agent you cannot contact, route through your Team Lead or the Project Manager.
