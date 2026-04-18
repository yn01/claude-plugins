# dev-forge

A Claude Code plugin for SQLite-backed multi-agent development team orchestration with wiki knowledge management, learnings capture, and automatic bug council escalation.

## What is dev-forge?

dev-forge assembles an AI-powered development team where an Orchestrator delegates tasks to specialized agents — implementers, reviewers, evaluators, doc managers, and release managers — all coordinated via sprint contracts and a strict chain of command. Unlike its predecessor `devteam`, dev-forge uses **SQLite as the single message bus**, eliminating file-based message queues in favor of atomic, concurrent-safe database writes.

## Key Features

- **SQLite message bus**: All inter-agent communication goes through `.dev-forge/dev-forge.db`. No scattered inbox files.
- **Sprint Contracts**: Pre-agreed acceptance criteria before implementation begins. Eliminates ambiguous handoffs.
- **Generator/Evaluator pattern**: Implementer and Evaluator are always separate agents — no self-evaluation bias.
- **Model Profiles**: Switch all agents between `economy`, `balanced`, and `quality` profiles in one command. Override individual agents at runtime — no restart needed.
- **Model Escalation**: Automatically upgrades agent models on repeated failures (sonnet → opus → Bug Council).
- **Bug Council**: 3-analyst multi-perspective diagnosis triggered at 6 consecutive failures or critical bugs.
- **Knowledge Wiki**: Karpathy-style LLM wiki for project knowledge accumulation.
- **Learnings capture**: Mistakes and patterns recorded to SQLite, queryable by future agents.
- **Dynamic teams**: Add/remove teams and agents at runtime without full restart.
- **Cross-platform**: macOS, Linux, and Windows (PowerShell) support.

## Prerequisites

| Requirement | macOS/Linux | Windows |
|---|---|---|
| `sqlite3` CLI | `brew install sqlite3` | `winget install SQLite.SQLite` |
| `tmux` | `brew install tmux` | Use Windows Terminal (`wt`) |
| `claude` CLI | [Claude Code](https://claude.ai/code) | Same |

## Installation

```bash
/plugin marketplace add yn01/claude-plugins
/plugin install dev-forge
```

## Quick Start

1. Copy the configuration template to your project root:
   ```bash
   cp $(claude plugin path dev-forge)/templates/devforge.yaml ./devforge.yaml
   ```
   > **If the path is unclear, specify it directly.** Example on macOS:
   > ```bash
   > cp /Users/your-username/.claude/plugins/dev-forge/templates/devforge.yaml ./devforge.yaml
   > ```
   > Replace `your-username` with your actual username.

2. (Optional) Edit `devforge.yaml` to customize team names and model profiles.

3. Start the dev-forge team:
   ```
   /dev-forge:start
   ```

4. Create your first sprint contract:
   ```
   /dev-forge:contract create orchestrator "Implement user authentication with JWT"
   ```

5. Monitor progress:
   ```
   /dev-forge:status
   ```

6. When done, stop all agents:
   ```
   /dev-forge:stop
   ```

## Command Reference

| Command | Description |
|---|---|
| `/dev-forge:start` | Initialize SQLite DB and launch all agent sessions |
| `/dev-forge:stop` | Stop all agents, archive unread messages |
| `/dev-forge:status` | Dashboard: agent status, message queue, contracts |
| `/dev-forge:send <agent> <msg>` | Send a message to a specific agent |
| `/dev-forge:export [--section <s>]` | Export DB contents to Markdown files |
| `/dev-forge:contract create <lead> "<task>"` | Create a sprint contract |
| `/dev-forge:contract list [filter]` | List contracts with optional status filter |
| `/dev-forge:contract complete <id>` | Mark a contract as completed |
| `/dev-forge:contract report` | Sprint summary report |
| `/dev-forge:team add <name>` | Add a new team |
| `/dev-forge:team remove <name>` | Remove a team |
| `/dev-forge:team list` | List all teams |
| `/dev-forge:agent add <team> <template>` | Add a specialist agent to a team |
| `/dev-forge:agent remove <team> <id>` | Remove an agent from a team |
| `/dev-forge:route add <from> <to>` | Add a communication route |
| `/dev-forge:route remove <from> <to>` | Remove a communication route |
| `/dev-forge:route list` | List all communication routes |
| `/dev-forge:route save` | Sync routes back to `devforge.yaml` |
| `/dev-forge:wiki ingest <file-or-url>` | Add a source to the wiki |
| `/dev-forge:wiki query <terms>` | Search the wiki |
| `/dev-forge:wiki lint` | Check wiki for issues |
| `/dev-forge:guideline add "<title>" "<content>"` | Add a coding guideline |
| `/dev-forge:guideline list` | List all guidelines |
| `/dev-forge:model profile <name>` | Switch all agents to a named model profile |
| `/dev-forge:model set <agent> <model>` | Override a specific agent's model (accepts alias or full ID) |
| `/dev-forge:model reset` | Re-apply active profile, clearing individual overrides |
| `/dev-forge:learn` | Record a learning (learning number auto-assigned) |
| `/dev-forge:learn status` | Show next learning number and recent entries |
| `/dev-forge:learn review` | Browse accumulated learnings |
| `/dev-forge:learn export` | Export all learnings to Markdown |

## Customizing devforge.yaml

### Model profiles

`devforge.yaml` ships with three built-in profiles. Switch at runtime — no restart needed:

```
/dev-forge:model profile economy    # cost-optimized
/dev-forge:model profile balanced   # default
/dev-forge:model profile quality    # maximum capability
```

To override a single agent:
```
/dev-forge:model set implementer-alpha opus
```

To restore all agents to the active profile's defaults:
```
/dev-forge:model reset
```

Profiles are defined in `devforge.yaml`. Model aliases (`opus`, `sonnet`, `haiku`) and full model IDs are both accepted.

### Adding a team

```yaml
teams:
  - name: gamma           # Add this block
    lead:
      can_contact: [orchestrator, doc-manager, implementer-gamma, evaluator-gamma, reviewer-gamma]
    members:
      - id: implementer-gamma
        role: implementer
        can_contact: [team-gamma-lead, evaluator-gamma, reviewer-gamma]
```

Or dynamically:
```
/dev-forge:team add gamma
```

### Adding a specialist agent

```
/dev-forge:agent add alpha security-auditor
```

Available templates: `security-auditor`, `performance-analyst`, `devops-engineer`, `doc-writer`

### Changing communication routes

```
/dev-forge:route add doc-manager team-gamma-lead
/dev-forge:route save
```

## Architecture

![dev-forge architecture](docs/dev-forge-architecture.svg)

```
User
 │
 └── Orchestrator             (opus  — balanced profile default)
     ├── doc-manager          (sonnet)
     ├── release-manager      (sonnet)
     ├── explorer             (haiku)
     ├── team-alpha-lead      (sonnet)
     │   ├── implementer-alpha (sonnet)   <- Generator
     │   ├── evaluator-alpha   (sonnet)   <- Evaluator
     │   └── reviewer-alpha    (sonnet)   <- Quality
     └── team-beta-lead       (sonnet)
         ├── implementer-beta  (sonnet)
         ├── evaluator-beta    (sonnet)
         └── reviewer-beta     (sonnet)

All communication -> .dev-forge/dev-forge.db (SQLite)

Bug Council (triggered at 6+ failures):
  bug-council-orchestrator (opus  — balanced profile default)
  ├── root-cause-analyst   (sonnet)
  ├── pattern-matcher      (sonnet)
  └── adversarial-tester   (sonnet)
```

## Why SQLite Instead of File-Based Queues?

The predecessor `devteam` plugin uses Markdown files in inbox directories. dev-forge replaces this with SQLite for several reasons:

1. **Atomic writes**: SQLite's WAL mode prevents race conditions when multiple agents write simultaneously.
2. **Queryability**: `SELECT`, `WHERE`, `GROUP BY` — no need to parse filenames or scan directories.
3. **Audit trail**: `violation_log`, `learnings`, and `agent_status` tables give a full audit trail in one place.
4. **Human-readable export**: `/dev-forge:export` converts the DB to Markdown when human review is needed.
5. **Single file**: One `.dev-forge/dev-forge.db` file to back up, restore, or share.

## Key Concepts

Understanding these terms will help you use dev-forge effectively.

**Contract**
A unit of work assigned from the Orchestrator to a team lead. Contracts include a task description and acceptance criteria that must be met before the work is considered done. Create one with `/dev-forge:contract create`.

**Generator/Evaluator pattern**
The implementer (Generator) produces code; the evaluator (Evaluator) judges it against the contract criteria. These are always separate agents to prevent self-evaluation bias. A failed evaluation triggers a retry; repeated failures escalate the model or invoke the Bug Council.

**Bug Council**
A panel of three specialist agents (root-cause analyst, pattern-matcher, adversarial tester) convened automatically when an agent fails six or more times consecutively, or when a critical bug is detected. The Bug Council diagnoses the root cause and recommends a fix.

**Learning number**
A sequential integer assigned to each learning record in the `learnings` table. It is simply a unique identifier — it does not represent a sprint cycle or any particular unit of time. When you run `/dev-forge:learn record`, the number is auto-assigned as `MAX + 1`. Use `/dev-forge:learn status` to see the next available number and recent entries.

**Model escalation**
When an agent fails repeatedly, dev-forge automatically upgrades its model: haiku → sonnet at 2 failures, sonnet → opus at 4, opus → Bug Council at 6. Because the model is read from the database on every message, escalation takes effect immediately without restarting the agent.

**Wiki**
A collection of Markdown files in `.dev-forge/wiki/` that agents consult before starting tasks. Humans add content via `/dev-forge:wiki ingest`; the `doc-manager` agent maintains it during a session.

## Wiki and Learnings

### Wiki

The wiki stores project knowledge as Markdown files in `.dev-forge/wiki/`. Agents can reference it before starting tasks. Humans manage it via `/dev-forge:wiki ingest`.

For Obsidian users, set `wiki.storage: obsidian` and `wiki.obsidian_vault: /path/to/vault` in `devforge.yaml`.

### Learnings

After each completed evaluation (PASS event), the `post-tool-use` hook suggests recording a learning. The learning number is auto-assigned — you do not need to track it manually. Use `/dev-forge:learn status` to see the current state. Learnings are stored in SQLite and mirrored to `.dev-forge/learnings/LEARNINGS.md`. The `pattern-matcher` Bug Council agent queries learnings when diagnosing failures.

## Directory Structure

```
.dev-forge/                    <- Created in your project root by /dev-forge:start
├── dev-forge.db               <- SQLite database (messages, contracts, agents, rules, learnings)
├── wiki/                      <- Knowledge wiki (Markdown files)
├── learnings/                 <- Iteration learnings (Markdown + mirrored from SQLite)
├── guidelines/                <- Coding guidelines (human-managed zone)
├── archive/                   <- Archived messages from /dev-forge:stop
└── export/                    <- Exports from /dev-forge:export
```

## Windows Support

dev-forge supports Windows via PowerShell equivalents for all shell hooks. When running on Windows:

- Use `sqlite3.exe` (install via `winget install SQLite.SQLite`)
- Agent sessions use Windows Terminal (`wt`) instead of tmux
- All hook scripts have `.ps1` counterparts in `hooks/`
- Path separators use `\` in PowerShell commands

## Changelog

### v1.2.0 — 2026-04-19
- **Model profiles**: Replace per-agent `model:` fields with `model_profiles` in `devforge.yaml` (economy / balanced / quality)
- **Runtime model changes**: `agent-loop.sh` now reads the model from the database on every message — no agent restart needed
- **`/dev-forge:model` command**: `profile`, `set`, and `reset` subcommands for model management
- **Model aliases**: `opus`, `sonnet`, `haiku` accepted everywhere instead of full model IDs
- **`/dev-forge:status`** now shows active profile name, short model aliases, and `*` marker for overridden agents
- **`configテーブル`**: New `config` table in SQLite stores active profile name

### v1.1.0 — 2026-04-17
- Auto-assign learning numbers
- Add `learn status` subcommand
- Add Key Concepts glossary to README

### v1.0.0 — 2026-04-07
- Initial release
- SQLite-backed message bus replacing file-based queues
- Multi-team orchestration with dynamic team/agent management
- Sprint Contracts with acceptance criteria
- Generator/Evaluator pattern
- Model escalation (2 → 4 → 6 failure thresholds)
- Bug Council with 3-analyst diagnosis
- Knowledge Wiki with local and Obsidian storage backends
- Agent Learnings with SQLite storage and Markdown export
- Lifecycle hooks (SessionStart, Stop, PreToolUse, PostToolUse, PreCompact) with macOS/Linux and Windows support
- Communication rules enforcement with violation logging
