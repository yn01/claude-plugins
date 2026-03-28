# devteam

Multi-agent development team orchestration with file-based message queues.

A Claude Code plugin that assembles an AI-powered development team with multi-agent orchestration and file-based message queues.

## Why devteam?

- **Parallelize your development**: Multiple specialized agents work concurrently — implementers, reviewers, doc writers, and release managers all operate in parallel, reducing the bottleneck of a single-agent workflow.
- **Role-based specialization**: Each agent has a clearly defined responsibility. The Orchestrator decomposes tasks and delegates; implementers write code; reviewers check it. No one agent tries to do everything.
- **Scales with your project**: Customize the team structure, model selection, and agent hierarchy via a simple `devteam.yaml`. Add a security auditor, swap in Opus for critical roles, or restructure teams to match your workflow.
- **Persistent, inspectable communication**: Agent messages are plain Markdown files on disk — easy to read, debug, archive, and audit. No black-box message passing.
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
- Creates inbox directories for each agent
- Launches each agent as a tmux session

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
    directs: [implementer-a, implementer-c, reviewer-a]  # Add a member
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
│   └── plugin.json          # Plugin metadata
├── commands/
│   ├── start.md             # Team start command
│   ├── send.md              # Message send command
│   ├── status.md            # Status check command
│   └── stop.md              # Team stop command
├── agents/
│   ├── orchestrator.md      # Orchestrator agent definition
│   └── queue-monitor.md     # Queue Monitor agent definition
├── hooks/
│   └── hooks.json           # Unread notification hook on session start
├── templates/
│   └── devteam.yaml         # Default team configuration template
├── LICENSE                  # MIT License
└── README.md                # This file
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
│   ├── team-beta-lead/      # Team Beta Lead inbox
│   ├── implementer-b/       # Implementer B inbox
│   └── reviewer-b/          # Reviewer B inbox
└── archive/
    └── <timestamp>/         # Archived messages
```

### Message file naming convention

```
<ISO timestamp>_from-<sender>.md
```

Example: `2026-03-17T08-30-00_from-user.md`
