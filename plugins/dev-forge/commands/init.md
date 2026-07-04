---
description: Initialize the dev-forge development setup for the current project
allowed-tools: Read, Write, Bash, Glob
argument-hint: ""
---
# /dev-forge:init

Set up the Human As The Architect development workflow in the current project. This command:

1. Creates `.dev-forge/guide/` and `.dev-forge/gate/` directory structures
2. Walks you through selecting an agent team preset and places the agent definitions in `.claude/agents/`
3. Prints a completion summary with next steps

## Steps

### 1. Create .dev-forge directory structure

```bash
mkdir -p .dev-forge/guide/guidelines .dev-forge/guide/decisions .dev-forge/guide/concepts
mkdir -p .dev-forge/gate/active .dev-forge/gate/archive
```

If `.dev-forge/guide/index.md` does not exist, create it:

```markdown
# Guide Index

## Guidelines

## Decisions

## Concepts
```

If `.dev-forge/gate/index.md` does not exist, create it:

```markdown
# Gate Index

## Open

## Passed

## Failed
```

Print:
```
Created .dev-forge/guide/  — add your first guideline with /dev-forge:guide add guideline "<title>"
Created .dev-forge/gate/   — define your first gate with /dev-forge:gate define "<task title>"
```

(Skip the print line for any directory that already existed.)

### 2. Select a team preset

Present the following menu to the user:

```
Select a team preset to place agent definitions in .claude/agents/:

  1. fullstack     — 7 agents (researcher, story-writer, spec-writer, backend-builder,
                     frontend-builder, test-verifier, validator)
  2. backend-only  — 5 agents (researcher, story-writer, spec-writer, backend-builder,
                     validator)
  3. minimal       — 3 agents (researcher, builder, validator)
  4. skip          — I'll set up agents manually

Enter 1–4:
```

Wait for the user to choose. If the user chooses 4 (skip), jump to step 4.

### 3. Place agent definitions

Locate the plugin directory:

```bash
PLUGIN_DIR="$(claude plugin path dev-forge)"
```

Ensure `.claude/agents/` exists:

```bash
mkdir -p .claude/agents
```

Copy the agent definition files for the selected preset from `$PLUGIN_DIR/templates/teams/agents/` to `.claude/agents/`. For each file:

- If the file already exists in `.claude/agents/`, skip it and note: `Skipped (already exists): .claude/agents/<name>.md`
- If it does not exist, copy it and note: `Created: .claude/agents/<name>.md`

Agent files per preset:

| Preset | Agent files |
|--------|-------------|
| `fullstack` | researcher.md, story-writer.md, spec-writer.md, backend-builder.md, frontend-builder.md, test-verifier.md, validator.md |
| `backend-only` | researcher.md, story-writer.md, spec-writer.md, backend-builder.md, validator.md |
| `minimal` | researcher.md, builder.md, validator.md |

### 4. Print completion summary

```
─────────────────────────────────────────────
dev-forge init complete
─────────────────────────────────────────────

Directories:
  ✓ .dev-forge/guide/   (guidelines, decisions, concepts)
  ✓ .dev-forge/gate/    (active, archive)

Agent team: <preset name, or "skipped">
  <list of Created/Skipped agent files>

Next steps:
  • Add your first guideline:   /dev-forge:guide add guideline "<title>"
  • Define your first gate:     /dev-forge:gate define "<task title>"
  • Review agent definitions:   open .claude/agents/<agent>.md
─────────────────────────────────────────────
```
