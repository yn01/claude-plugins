---
description: Create a new gate definition file with completion criteria for a task
allowed-tools: Read, Write, Bash, Glob
argument-hint: "\"<task title>\""
---
# /dev-gate:define

Create a new gate definition file in `.dev-gate/active/` for the given task.

**Usage:** `/dev-gate:define "<task title>"`

Example: `/dev-gate:define "Implement JWT Authentication"`

## Steps

### 1. Validate arguments

If `<task title>` is not provided, print usage and stop:

```
Usage: /dev-gate:define "<task title>"

Example:
  /dev-gate:define "Implement JWT Authentication"
```

### 2. Ensure .dev-gate directories exist

```bash
mkdir -p .dev-gate/active .dev-gate/archive
```

If `.dev-gate/index.md` does not exist yet, create it with the following content:

```markdown
# dev-gate Index

## Open

## Passed

## Failed
```

### 3. Generate the Gate ID

Generate a Gate ID in the format `GATE-YYYYMMDD-HHMMSS` using the current date and time:

```bash
GATE_ID="GATE-$(date +%Y%m%d-%H%M%S)"
```

### 4. Generate the filename

Convert `<task title>` to a kebab-case filename:
- Lowercase all characters
- Replace spaces and special characters with hyphens
- Remove leading/trailing hyphens
- Prefix with the Gate ID

Example: `GATE-20260529-143022-implement-jwt-authentication.md`

The file path is `.dev-gate/active/<filename>`.

If the target file already exists, print an error and stop — do not overwrite.

### 5. Copy the template

Locate the template from the plugin directory:

```bash
PLUGIN_DIR="$(claude plugin path dev-gate)"
```

Copy `$PLUGIN_DIR/templates/gate.md` to the target path.

Replace the following placeholders in the copied file:
- `[Task Title]` → the provided task title
- `GATE-YYYYMMDD-HHMMSS` → the generated Gate ID

### 6. Update index.md

Append an entry under the `## Open` section in `.dev-gate/index.md`:

```markdown
- [<task title>](<relative-path>) — <GATE-ID> — <YYYY-MM-DD>
```

The relative path is relative to `.dev-gate/`, e.g. `active/GATE-20260529-143022-implement-jwt-authentication.md`.

### 7. Print confirmation

```
Created: .dev-gate/active/<filename>
Gate ID: <GATE-ID>
Updated: .dev-gate/index.md

Open the file and fill in the completion criteria.
Each criterion must include a verification command (bash block).
Run /dev-gate:verify <gate-id> when ready to check.
```
