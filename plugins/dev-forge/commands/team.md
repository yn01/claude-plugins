---
description: Place agent team definition files for a selected preset into .claude/agents/
allowed-tools: Read, Write, Bash, Glob
argument-hint: "<preset>"
---
# /dev-forge:team

Place agent definition files for a team preset into `.claude/agents/`.

**Usage:** `/dev-forge:team <preset>`

- `preset`: `fullstack`, `backend-only`, or `minimal`

Use this command to set up or switch your agent team configuration after the initial `/dev-forge:init`.

## Steps

### 1. Validate arguments

If `<preset>` is not provided or is not one of `fullstack`, `backend-only`, `minimal`, print usage and stop:

```
Usage: /dev-forge:team <preset>

Available presets:
  fullstack     — 7 agents: researcher, story-writer, spec-writer, backend-builder,
                  frontend-builder, test-verifier, validator
  backend-only  — 5 agents: researcher, story-writer, spec-writer, backend-builder,
                  validator
  minimal       — 3 agents: researcher, builder, validator

Example:
  /dev-forge:team fullstack
```

### 2. Check for existing agent files

Locate the plugin directory:

```bash
PLUGIN_DIR="$(claude plugin path dev-forge)"
```

Determine the agent files for the selected preset:

| Preset | Agent files |
|--------|-------------|
| `fullstack` | researcher.md, story-writer.md, spec-writer.md, backend-builder.md, frontend-builder.md, test-verifier.md, validator.md |
| `backend-only` | researcher.md, story-writer.md, spec-writer.md, backend-builder.md, validator.md |
| `minimal` | researcher.md, builder.md, validator.md |

Check which of these files already exist in `.claude/agents/`. If any exist, ask the user:

```
The following agent files already exist in .claude/agents/:
  researcher.md
  validator.md

Overwrite them? [y/N]:
```

If the user answers `n` or presses Enter (default No), skip those files and copy only the missing ones. If the user answers `y`, overwrite all.

### 3. Place agent files

Ensure `.claude/agents/` exists:

```bash
mkdir -p .claude/agents
```

Copy (or overwrite) the appropriate agent files from `$PLUGIN_DIR/templates/teams/agents/` to `.claude/agents/`.

### 4. Print confirmation

```
Team preset: fullstack

  Created:  .claude/agents/story-writer.md
  Created:  .claude/agents/spec-writer.md
  Created:  .claude/agents/frontend-builder.md
  Created:  .claude/agents/test-verifier.md
  Skipped:  .claude/agents/researcher.md  (already exists)
  Skipped:  .claude/agents/validator.md   (already exists)

Review the agent definitions in .claude/agents/ and adjust tool permissions
or model assignments as needed for your project.
```
