# devteam

Multi-agent development team orchestration with file-based message queues.

A Claude Code plugin that assembles an AI-powered development team with multi-agent orchestration and file-based message queues.

## Why devteam?

- **Parallelize your development**: Multiple specialized agents work concurrently — implementers, reviewers, evaluators, doc writers, and release managers all operate in parallel, reducing the bottleneck of a single-agent workflow.
- **Role-based specialization**: Each agent has a clearly defined responsibility. The Orchestrator decomposes tasks and delegates; Team Leads own sprint contracts; Implementers write code; Evaluators verify acceptance criteria. No one agent tries to do everything.
- **Sprint contracts eliminate ambiguity**: Before any work begins, the Orchestrator and Team Lead agree on concrete, measurable acceptance criteria. No more vague handoffs — the definition of done is written down before the first line of code.
- **Scales with your project**: Customize the team structure, model selection, and agent hierarchy via a simple `devteam.yaml`. Add a security auditor, swap in Opus for critical roles, or restructure teams to match your workflow.
- **Persistent, inspectable communication**: Agent messages and sprint contracts are plain Markdown files on disk — easy to read, debug, archive, and audit. No black-box message passing.
- **Works today, future-proof tomorrow**: Built on file-based queues because Claude Code currently has no native cross-session communication between agents. The message queue layer is intentionally decoupled from agent logic, so it can be swapped out cleanly if Claude Code adds native inter-session messaging in a future update.

## Installation

```
/plugin marketplace add yn01/devteam
```

After adding the marketplace, install the plugin:

```
/plugin install devteam
```

## Commands

### /devteam:start

Starts all agents in the development team.

```
/devteam:start
```

- Uses `devteam.yaml` from the project root if present, otherwise falls back to the default template
- Creates inbox directories for each agent and the `contracts/` directory
- Launches each agent as a tmux session with communication rules injected into system prompts

### /devteam:send

Sends a message to a specified agent.

```
/devteam:send <agent-name> <message>
```

Examples:
```
/devteam:send orchestrator Implement a new API feature
/devteam:send team-alpha-lead Prioritize the user authentication module
```

### /devteam:contract

Manages sprint contracts — pre-agreed definitions of done between the Orchestrator and a Team Lead.

```
/devteam:contract create <team-lead> "<task description>"
/devteam:contract list [active|completed|blocked]
/devteam:contract complete <contract-id> [notes]
/devteam:contract report
```

See [Sprint Contracts](#sprint-contracts) below for the full workflow.

### /devteam:status

Displays the status of all agents and the state of their message queues.

```
/devteam:status
```

- Running state of each agent (tmux session)
- Unread message count
- Preview of the latest message (first 3 lines)

### /devteam:stop

Stops all agents and archives unprocessed messages.

```
/devteam:stop
```

- Terminates all tmux sessions
- Moves unprocessed messages to `.claude/messages/archive/<timestamp>/`

## Sprint Contracts

Sprint contracts are a harness engineering pattern in which the Orchestrator and a Team Lead pre-agree on concrete, measurable acceptance criteria before any implementation begins. This eliminates ambiguous handoffs and gives both sides a clear definition of done.

### How it works

```
1. Orchestrator receives a task from the user
2. Orchestrator creates a sprint contract with acceptance criteria
   /devteam:contract create team-alpha-lead "Implement /api/v1/users endpoint"
3. Team Lead receives the contract and takes ownership
4. Team Lead delegates implementation to Implementer (referencing the contract)
5. Team Lead assigns evaluation to Evaluator (referencing the contract)
6. Implementer builds to satisfy the acceptance criteria
7. Evaluator independently verifies each criterion — no self-evaluation
8. If all criteria pass: Team Lead completes the contract and reports to Orchestrator
   /devteam:contract complete CONTRACT-20260328-103045
9. If any criterion fails: Evaluator reports back, Team Lead sends Implementer for rework
```

### Contract file format

Contracts are stored as Markdown files at `.claude/messages/contracts/<contract-id>.md`:

```markdown
---
contract_id: CONTRACT-20260328-103045
task: Implement /api/v1/users endpoint
team_lead: team-alpha-lead
created_at: 2026-03-28T10-30-45
status: active
---

## Task

Implement /api/v1/users endpoint

## Acceptance Criteria

- [ ] GET /api/v1/users returns 200
- [ ] Test coverage is 85% or above
- [ ] Error handling is implemented
- [ ] API spec documentation exists

## Completion Notes

(filled in by Team Lead when completing)
```

### Reviewer vs. Evaluator

Both reviewer and evaluator operate within the team, but serve distinct roles:

| | Reviewer (Codex CLI) | Evaluator (Claude Sonnet) |
|---|---|---|
| **Focus** | Code quality ("how it is written") | Requirements ("what it satisfies") |
| **Method** | Static analysis, style, PR review | Verify each acceptance criterion with concrete checks |
| **Trigger** | Team Lead: "review the PR" | Team Lead: "evaluate CONTRACT-XXX" |

## Agent communication rules

To maintain a clear chain of command, message queue communication between agents is strictly defined. See `agents/communication-rules.md` for the full matrix.

### Summary

| Agent | Can contact | Cannot contact |
|-------|-------------|----------------|
| **Orchestrator** | Team Leads, doc-manager, release-manager, explorer | Implementers, reviewers, evaluators (team members) |
| **doc-manager / release-manager / explorer** | Orchestrator, Team Leads | All team members |
| **Team Lead** | Orchestrator, cross-team agents, own team members | The other team's members |
| **Team members** (implementer / reviewer / evaluator) | Own team Lead + teammates | Orchestrator, cross-team agents, other team |

### Principles

1. **Orchestrator never directs team members directly** — all instructions go through the Team Lead
2. **Cross-team agents communicate only with Orchestrator or Team Leads** — no direct contact with team members
3. **Team Leads are the coordination interface with the outside** — they bridge Orchestrator and their team
4. **Within a team, communication is free** — team members may contact each other without going through the Lead

## Team structure (default)

```
Orchestrator (Opus)
├── doc-manager (Sonnet)         — Documentation
├── release-manager (Sonnet)     — Releases & changelogs
├── explorer (Haiku)             — Codebase exploration
├── team-alpha-lead (Sonnet)     — Team Alpha coordinator, sprint contract owner
│   ├── implementer-a (Sonnet)   — Generator: implements features
│   ├── reviewer-a (Codex)       — Code quality review
│   └── evaluator-a (Sonnet)     — Evaluator: verifies acceptance criteria
└── team-beta-lead (Sonnet)      — Team Beta coordinator, sprint contract owner
    ├── implementer-b (Sonnet)   — Generator: implements features
    ├── reviewer-b (Codex)       — Code quality review
    └── evaluator-b (Sonnet)     — Evaluator: verifies acceptance criteria
```

## Customizing devteam.yaml

Create a `devteam.yaml` in your project root to customize the team structure.

### Adding agents

```yaml
agents:
  # In addition to existing agents...
  security-auditor:
    model: claude-sonnet-4-6
    type: general-purpose
    role: Security Auditor
```

### Changing models

```yaml
agents:
  implementer-a:
    model: claude-opus-4-6  # Upgrade to a more capable model
    type: general-purpose
    role: Implementer A
```

### Restructuring the team

```yaml
orchestrator:
  model: claude-opus-4-6
  role: Orchestrator
  directs: [doc-manager, team-alpha-lead]  # Fewer direct reports

agents:
  team-alpha-lead:
    model: claude-sonnet-4-6
    type: general-purpose
    role: Team Alpha Lead
    directs: [implementer-a, implementer-c, reviewer-a, evaluator-a]  # Add a member
```

### Available agent types

| type | Description | Launch method |
|------|-------------|---------------|
| `general-purpose` | General-purpose agent | `claude --model <model>` |
| `explore` | Codebase exploration specialist | `claude --model <model>` |
| `bash` | CLI tool (Codex, etc.) | `codex` |

## Why file-based message queues?

Claude Code currently provides no native communication channel between independent agent sessions (e.g., worktrees or separate tmux-launched `claude` processes). To enable agents to coordinate, devteam uses the filesystem as a message bus: each agent has an inbox directory, and messages are written as timestamped Markdown files.

This approach is intentionally decoupled from the agent logic itself. The message queue is a thin transport layer — agents only know to read from and write to a directory path. If Claude Code introduces native inter-session messaging in the future, the queue layer can be replaced without touching agent definitions or command logic.

## Directory structure

```
devteam/
├── .claude-plugin/
│   └── plugin.json                # Plugin metadata
├── commands/
│   ├── start.md                   # Team start command
│   ├── send.md                    # Message send command
│   ├── status.md                  # Status check command
│   ├── stop.md                    # Team stop command
│   └── contract.md                # Sprint contract management
├── agents/
│   ├── orchestrator.md            # Orchestrator agent definition
│   ├── evaluator.md               # Evaluator agent definition
│   ├── queue-monitor.md           # Queue Monitor agent definition
│   └── communication-rules.md    # Message queue communication rules
├── hooks/
│   └── hooks.json                 # Unread notification hook on session start
├── templates/
│   └── devteam.yaml               # Default team configuration template
├── LICENSE                        # MIT License
└── README.md                      # This file
```

### Message queue structure (generated at runtime)

```
.claude/messages/
├── inbox/
│   ├── orchestrator/        # Orchestrator inbox
│   ├── doc-manager/         # Doc Manager inbox
│   ├── release-manager/     # Release Manager inbox
│   ├── explorer/            # Explorer inbox
│   ├── team-alpha-lead/     # Team Alpha Lead inbox
│   ├── implementer-a/       # Implementer A inbox
│   ├── reviewer-a/          # Reviewer A inbox
│   ├── evaluator-a/         # Evaluator A inbox
│   ├── team-beta-lead/      # Team Beta Lead inbox
│   ├── implementer-b/       # Implementer B inbox
│   ├── reviewer-b/          # Reviewer B inbox
│   └── evaluator-b/         # Evaluator B inbox
├── contracts/               # Sprint contracts
│   ├── CONTRACT-<id>.md     # Active contract
│   └── completed/           # Completed contracts
│       └── CONTRACT-<id>.md
└── archive/
    └── <timestamp>/         # Archived messages
```

### Message file naming convention

```
<ISO timestamp>_from-<sender>.md
```

Example: `2026-03-17T08-30-00_from-user.md`

### Contract file naming convention

```
CONTRACT-<YYYYMMDD>-<HHMMSS>.md
```

Example: `CONTRACT-20260328-103045.md`

## Changelog

### v1.1.0 — 2026-03-28
- Add sprint contracts (`/devteam:contract create/list/complete/report`) — pre-agreed definitions of done between Orchestrator and Team Lead
- Add Evaluator agents (`evaluator-a`, `evaluator-b`) implementing the Generator/Evaluator pattern
- Add `agents/communication-rules.md` defining allowed/prohibited message paths for all agents
- Enforce chain of command: Orchestrator → Team Lead → team members only; no skip-level messages
- Update `devteam.yaml` with `sprint_contracts` config and evaluator agent entries

### v1.0.0 — 2026-03-17
- Initial release
