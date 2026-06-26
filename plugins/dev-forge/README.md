# dev-forge

A Claude Code plugin that serves as the entry point and starter kit for AI-assisted development. It sets up the Human As The Architect workflow: installs sister plugins, initializes their project directories, and places a ready-to-use agent team in `.claude/agents/`.

## The Problem

Starting an AI-assisted development workflow from scratch involves several decisions: which agents to use, how to split their responsibilities, what tools to allow, what constraints to enforce. Without structure, each project reinvents these answers — inconsistently.

dev-forge answers them with opinionated defaults. Run `/dev-forge:init`, pick a team preset, and you have a coherent multi-agent setup in under a minute.

## Human As The Architect

dev-forge is built on a single organizing principle: **the human is the Architect**.

The Architect's responsibilities:

| Responsibility | How |
|----------------|-----|
| **Direction** | Decide what to build and why. Provide the task brief. |
| **System design** | Define guidelines, conventions, and quality standards (with dev-guide) |
| **Quality criteria** | Define what "done" means for each task (with dev-gate) |
| **Direct intervention** | Step in when agents reach a decision that requires human judgment |
| **Feedback loop** | Reflect learnings back into guidelines and criteria after each cycle |

The AI's responsibilities:

- Execute the task as specified
- Read and apply the Architect's guidelines (from dev-guide)
- Verify output against the Architect's criteria (via dev-gate)
- Surface ambiguities rather than guessing

Agents in dev-forge are deliberately constrained — read-only agents cannot write code, builders are scoped to their layer, validators only report gaps. The human retains authority at every approval gate.

## Relationship to dev-guide and dev-gate

dev-forge is a sister plugin to [dev-guide](../dev-guide/) and [dev-gate](../dev-gate/). They share the same design philosophy but serve different roles:

| Plugin | Role |
|--------|------|
| **dev-forge** | Entry point — set up the workflow, place agent teams |
| **dev-guide** | Knowledge delivery — store guidelines and decisions; inject them at session start |
| **dev-gate** | Quality verification — define completion criteria; run verification commands |

All three are fully independent — no plugin depends on another. dev-forge recommends installing the others and can initialize their directories, but they work without dev-forge.

## What changed from v1

v1 of dev-forge was a heavy-weight plugin: tmux-managed agent sessions, SQLite message queues, a Project Manager agent, Communication Rules, Model Escalation, a Wiki, Agent Learnings, and a Bug Council. It did a lot.

v2 removes all of that.

- **Agent execution** is handled by Claude Code's native features: `claude agents`, forked subagents, `--bg`
- **Knowledge management** is handled by dev-guide
- **Quality verification** is handled by dev-gate
- **dev-forge** is now just the entry point and the agent team templates

The result is a plugin that does one thing well: get you started.

## Installation

```
/plugin marketplace add yn01/claude-plugins
/plugin install dev-forge
```

Recommended: also install the sister plugins.

```
/plugin install dev-guide
/plugin install dev-gate
```

## Quick Start

```bash
# 1. Run init in your project
/dev-forge:init

# 2. Follow the prompts:
#    - dev-guide and dev-gate status is shown
#    - Select a team preset (fullstack / backend-only / minimal / skip)
#    - Agent files are placed in .claude/agents/

# 3. Review and adjust the agent definitions
#    Open .claude/agents/*.md and tailor constraints to your project

# 4. Start a task
#    Invoke the researcher agent with your task brief
#    Follow the pipeline: research → stories → spec → build → test → validate
```

## Commands

### `/dev-forge:init`

One-time project setup:

1. Checks dev-guide and dev-gate installation status; prints install commands for any missing
2. Creates `.dev-guide/` and `.dev-gate/` directories if the plugins are installed
3. Presents the team preset menu and places selected agent definitions in `.claude/agents/`

### `/dev-forge:team <preset>`

Place (or replace) agent definition files for a preset. Use this when you want to change your team configuration after init, or when you want to add agent files to a project that already has some.

```bash
/dev-forge:team fullstack
/dev-forge:team backend-only
/dev-forge:team minimal
```

Existing agent files are skipped by default; you are asked to confirm before any overwrite.

## Team Presets

### fullstack — 7 agents

| Agent | Read-only | Model | Responsibility |
|-------|-----------|-------|----------------|
| researcher | yes | haiku | Map relevant files, patterns, and risks before work begins |
| story-writer | yes | sonnet | Write user stories and acceptance criteria |
| spec-writer | yes | sonnet | Convert stories to technical specification |
| backend-builder | no | sonnet | Implement backend: APIs, data models, business logic |
| frontend-builder | no | sonnet | Implement frontend against backend API summary |
| test-verifier | test files only | sonnet | Write and run acceptance tests |
| validator | yes | sonnet | Audit implementation against spec; report gaps by severity |

Pipeline: `researcher → story-writer → spec-writer → backend-builder → frontend-builder → test-verifier → validator`

Approval gates (human reviews and approves before the next stage proceeds):
- After story-writer: approve user stories
- After spec-writer: approve technical specification
- After validator: review gap report and decide to ship

### backend-only — 5 agents

researcher, story-writer, spec-writer, backend-builder, validator.

Use when the task has no frontend component: REST API, background job, CLI, data migration.

Pipeline: `researcher → story-writer → spec-writer → backend-builder → validator`

### minimal — 3 agents

researcher, builder (full stack), validator.

Use for small, well-understood tasks where speed matters more than process rigor.

Pipeline: `researcher → builder → validator`

## Directory Structure

### Plugin directory

```
dev-forge/
├── .claude-plugin/
│   └── plugin.json
├── commands/
│   ├── init.md             # /dev-forge:init
│   └── team.md             # /dev-forge:team
├── templates/
│   └── teams/
│       ├── default.md      # Overview of all presets and agents
│       ├── agents/         # Agent definition files
│       │   ├── researcher.md
│       │   ├── story-writer.md
│       │   ├── spec-writer.md
│       │   ├── backend-builder.md
│       │   ├── frontend-builder.md
│       │   ├── test-verifier.md
│       │   ├── builder.md
│       │   └── validator.md
│       └── presets/        # Preset descriptions
│           ├── fullstack.md
│           ├── backend-only.md
│           └── minimal.md
├── LICENSE
└── README.md
```

### Project directories (created by `/dev-forge:init`)

```
.claude/
└── agents/         # Agent definitions active in this project

.dev-guide/         # Created if dev-guide is installed
├── guidelines/
├── decisions/
├── concepts/
└── index.md

.dev-gate/          # Created if dev-gate is installed
├── active/
├── archive/
└── index.md
```

## Customizing Agent Definitions

After `/dev-forge:init` or `/dev-forge:team`, the agent files in `.claude/agents/` are yours to edit. Consider:

- **Tool permissions** — tighten the `tools` list to match your stack
- **Model** — upgrade to `claude-opus-4-7` for complex reasoning agents, downgrade to `claude-haiku-4-5-20251001` for fast read-only ones
- **Scope constraints** — add specific folder restrictions (e.g. "only modify files in `src/api/`")
- **Output format** — adjust report templates to match your team's conventions

The templates are starting points, not requirements.

## Changelog

### v2.0.1 — 2026-06-27
- Add hooks.json with script paths pointing to plugin cache directory

### v2.0.0 — 2026-05-29
- Complete rewrite. All v1 infrastructure (tmux, SQLite, PM agent, Communication Rules, Model Escalation, Wiki, Learnings, Bug Council) removed
- New commands: `init`, `team`
- New agent templates: researcher, story-writer, spec-writer, backend-builder, frontend-builder, test-verifier, builder, validator
- Three team presets: fullstack, backend-only, minimal
- Integrates with sister plugins dev-guide and dev-gate

### v1.5.1 — 2026-04-27
- Fix project-manager missing from bulk agent operations; update sprint-workflow and escalation-rules docs

### v1.5.0 — 2026-04-26
- Cross-team agent re-routing to Project Manager, Orchestrator scope tightened, explorer re-classified as shared resource

### v1.4.0 — 2026-04-25
- Project Manager agent (PMBOK 8th edition), role redistribution between Orchestrator and PM, updated communication hierarchy

### v1.0.0 — 2026-04-07
- Initial release: SQLite-backed multi-agent development team with wiki, learnings, and bug council escalation
