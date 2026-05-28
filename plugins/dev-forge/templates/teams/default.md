# dev-forge Agent Team Templates

This directory contains agent definition templates for the three team presets provided by dev-forge.

## Presets

| Preset | Agents | Description |
|--------|--------|-------------|
| `fullstack` | 7 | Full pipeline: researcher → story → spec → backend + frontend → test → validate |
| `backend-only` | 5 | Backend pipeline: researcher → story → spec → backend → validate |
| `minimal` | 3 | Fast track: researcher → builder → validate |

See `presets/` for detailed descriptions of each.

## Agent roles

| Agent | Preset(s) | Read-only? | Description |
|-------|-----------|-----------|-------------|
| researcher | all | yes | Investigates codebase; reports relevant files, patterns, risks |
| story-writer | fullstack, backend-only | yes | Writes user stories and acceptance criteria |
| spec-writer | fullstack, backend-only | yes | Converts stories to technical specification |
| backend-builder | fullstack, backend-only | no | Implements backend (APIs, data models, logic) |
| frontend-builder | fullstack | no | Implements frontend against backend API summary |
| test-verifier | fullstack | partial (test files only) | Writes and runs acceptance tests |
| builder | minimal | no | Implements full stack (backend + frontend combined) |
| validator | all | yes | Audits implementation against spec; reports gaps by severity |

## Placing agents in your project

Agent definitions are placed in `.claude/agents/` by `/dev-forge:init` or `/dev-forge:team`.

Each file is a standalone Claude Code agent definition — a Markdown file with a YAML frontmatter block specifying `name`, `description`, `tools`, and `model`. You can edit them after placement to adjust permissions or prompts for your project's specific needs.

## Customization

After placing agents, review each file in `.claude/agents/` and consider:

- **Tool permissions**: tighten `tools` lists to match your project's actual stack
- **Model**: swap to a more capable model for complex tasks, or a faster one for simpler roles
- **Constraints**: add project-specific constraints (e.g. "never modify files in `src/lib/`")
- **Output format**: adjust the report format to match your team's conventions
