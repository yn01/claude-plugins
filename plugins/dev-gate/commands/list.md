---
description: List gate definitions filtered by status
allowed-tools: Read, Bash, Glob
argument-hint: "[status]"
---
# /dev-gate:list

List gate definitions in the current project.

**Usage:** `/dev-gate:list [status]`

- `status` (optional): `open`, `passed`, `failed`, or `all`. Defaults to `open`.

## Steps

### 1. Check that .dev-gate exists

If `.dev-gate/` does not exist, print:

```
No dev-gate knowledge base found in this project.
Run /dev-gate:define "<task title>" to create your first gate.
```

Then stop.

### 2. Collect gate files

Based on `status`:

| status | directories to scan |
|--------|---------------------|
| `open` | `.dev-gate/active/` (files with `Status: open`) |
| `passed` | `.dev-gate/archive/` (files with `Status: passed`) |
| `failed` | `.dev-gate/active/` (files with `Status: failed`) |
| `all` | both `.dev-gate/active/` and `.dev-gate/archive/` |

For each `.md` file found, extract:
- **Gate ID**: from the `## Gate ID` section
- **Title**: from the first `# Heading` line
- **Status**: from the `## Status` section
- **Criterion count**: number of `### Criterion` headings
- **Last verified**: modification date of the file (`date -r <file> +%Y-%m-%d`)

### 3. Display results

Print a formatted table grouped by status:

```
Open (1)
──────────────────────────────────────────────────────────────
  GATE-20260529-143022  Implement JWT Authentication   3 criteria  2026-05-29

Passed (1)
──────────────────────────────────────────────────────────────
  GATE-20260528-091500  Add User Registration API      2 criteria  2026-05-28

Failed (0)
──────────────────────────────────────────────────────────────
  (none)

Total: 2 gate(s)
```

If no gates match the requested status, print:

```
No <status> gates found.
```
