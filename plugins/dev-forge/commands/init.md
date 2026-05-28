---
description: Initialize the dev-forge development setup for the current project
allowed-tools: Read, Write, Bash, Glob
argument-hint: ""
---
# /dev-forge:init

Set up the Human As The Architect development workflow in the current project. This command:

1. Checks whether the sister plugins dev-guide and dev-gate are installed and guides you to install them if not
2. Creates their initial project directories if needed
3. Walks you through selecting an agent team preset and places the agent definitions in `.claude/agents/`

## Steps

### 1. Check for sister plugins

Check whether dev-guide is installed:

```bash
claude plugin list 2>/dev/null | grep -q "dev-guide"
```

Check whether dev-gate is installed:

```bash
claude plugin list 2>/dev/null | grep -q "dev-gate"
```

Print status for each plugin:

**If dev-guide is NOT installed:**
```
dev-guide is not installed. To manage project guidelines and decisions:
  /plugin install dev-guide
```

**If dev-guide IS installed:**
```
✓ dev-guide is installed
```

**If dev-gate is NOT installed:**
```
dev-gate is not installed. To define and verify completion criteria:
  /plugin install dev-gate
```

**If dev-gate IS installed:**
```
✓ dev-gate is installed
```

### 2. Create initial directories for installed sister plugins

If dev-guide is installed and `.dev-guide/` does not exist:

```bash
mkdir -p .dev-guide/guidelines .dev-guide/decisions .dev-guide/concepts
```

Create `.dev-guide/index.md` with the initial content:

```markdown
# dev-guide Index

## Guidelines

## Decisions

## Concepts
```

Print: `Created .dev-guide/ — add your first guideline with /dev-guide:add guideline "<title>"`

If dev-gate is installed and `.dev-gate/` does not exist:

```bash
mkdir -p .dev-gate/active .dev-gate/archive
```

Create `.dev-gate/index.md` with the initial content:

```markdown
# dev-gate Index

## Open

## Passed

## Failed
```

Print: `Created .dev-gate/ — define your first gate with /dev-gate:define "<task title>"`

### 3. Select a team preset

Present the following menu to the user:

```
Select a team preset to place agent definitions in .claude/agents/:

  1. fullstack     — 7 agents: researcher, story-writer, spec-writer, backend-builder,
                     frontend-builder, test-verifier, validator
  2. backend-only  — 5 agents: researcher, story-writer, spec-writer, backend-builder,
                     validator
  3. minimal       — 3 agents: researcher, builder, validator
  4. skip          — I'll set up agents manually

Enter 1–4:
```

Wait for the user to choose. If the user chooses 4 (skip), jump to step 5.

### 4. Place agent definitions

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

### 5. Print completion summary

```
─────────────────────────────────────────────
dev-forge init complete
─────────────────────────────────────────────

Sister plugins:
  ✓ dev-guide    (or: not installed — run /plugin install dev-guide)
  ✓ dev-gate     (or: not installed — run /plugin install dev-gate)

Agent team:
  <list of created/skipped agent files, or "skipped">

Next steps:
  • Add your first guideline:   /dev-guide:add guideline "<title>"
  • Define your first gate:     /dev-gate:define "<task title>"
  • Start a task with agents:   open .claude/agents/<agent>.md to review roles
─────────────────────────────────────────────
```
