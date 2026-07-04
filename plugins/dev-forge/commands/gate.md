---
description: Define machine-verifiable completion criteria and run pass/fail verification
allowed-tools: Read, Write, Bash, Glob
argument-hint: "<subcommand> [args]"
---
# /dev-forge:gate

Define completion criteria for tasks and verify them mechanically. Every criterion must include an executable verification command — this structurally eliminates ambiguous "done" definitions.

**Subcommands:**
- `/dev-forge:gate define "<task title>"` — create a new gate definition file
- `/dev-forge:gate verify [gate-id]` — run verification commands and record results
- `/dev-forge:gate list [status]` — list gates by status
- `/dev-forge:gate template [keyword]` — search archived gates for reuse

---

## /dev-forge:gate define

**Usage:** `/dev-forge:gate define "<task title>"`

Example: `/dev-forge:gate define "Implement JWT Authentication"`

### Steps

#### 1. Validate arguments

If `<task title>` is not provided, print usage and stop:

```
Usage: /dev-forge:gate define "<task title>"

Example:
  /dev-forge:gate define "Implement JWT Authentication"
```

#### 2. Ensure .dev-forge/gate directories exist

```bash
mkdir -p .dev-forge/gate/active .dev-forge/gate/archive
```

If `.dev-forge/gate/index.md` does not exist yet, create it with:

```markdown
# Gate Index

## Open

## Passed

## Failed
```

#### 3. Generate the Gate ID

```bash
GATE_ID="GATE-$(date +%Y%m%d-%H%M%S)"
```

#### 4. Generate the filename

Convert `<task title>` to a kebab-case filename, prefixed with the Gate ID:

Example: `GATE-20260529-143022-implement-jwt-authentication.md`

The file path is `.dev-forge/gate/active/<filename>`.

If the target file already exists, print an error and stop — do not overwrite.

#### 5. Copy the template

Locate the plugin directory:

```bash
PLUGIN_DIR="$(claude plugin path dev-forge)"
```

Copy `$PLUGIN_DIR/templates/gate/gate.md` to the target path. Replace:
- `[Task Title]` → the provided task title
- `GATE-YYYYMMDD-HHMMSS` → the generated Gate ID

#### 6. Update gate index.md

Append an entry under `## Open` in `.dev-forge/gate/index.md`:

```markdown
- [<task title>](<relative-path>) — <GATE-ID> — <YYYY-MM-DD>
```

The relative path is relative to `.dev-forge/gate/`, e.g. `active/GATE-20260529-143022-implement-jwt-authentication.md`.

#### 7. Print confirmation

```
Created: .dev-forge/gate/active/<filename>
Gate ID: <GATE-ID>
Updated: .dev-forge/gate/index.md

Open the file and fill in the completion criteria.
Each criterion must include a verification command (bash block).
Run /dev-forge:gate verify <gate-id> when ready to check.
```

---

## /dev-forge:gate verify

**Usage:**
- `/dev-forge:gate verify <gate-id>` — verify a specific gate
- `/dev-forge:gate verify` — verify all gates in `.dev-forge/gate/active/`

Example: `/dev-forge:gate verify GATE-20260529-143022`

### Steps

#### 1. Check that .dev-forge/gate exists

If `.dev-forge/gate/` does not exist, print:

```
No gate knowledge base found in this project.
Run /dev-forge:gate define "<task title>" to create your first gate.
```

Then stop.

#### 2. Resolve target gate file(s)

If `<gate-id>` is provided:
- Search `.dev-forge/gate/active/` for a file whose name contains `<gate-id>`
- If not found, print an error and stop:
  ```
  Gate not found: <gate-id>
  Run /dev-forge:gate list to see available gates.
  ```

If `<gate-id>` is omitted:
- Collect all `.md` files in `.dev-forge/gate/active/`
- If none exist, print:
  ```
  No active gates found. Run /dev-forge:gate define to create one.
  ```
  Then stop.

#### 3. For each target gate file, run verification

Read the gate file and parse all criteria. For each criterion:

1. Extract the bash code block that follows the criterion heading
2. Run the command with a timeout of 60 seconds
3. Capture exit code and stdout/stderr output

**Success conditions:**
- Exit code is 0, OR
- The criterion specifies `Expected: stdout contains "<string>"` and the output contains that string

**Failure conditions:**
- Exit code is non-zero AND no stdout match condition is satisfied

#### 4. Update the gate file

Fill in the `## Verification Results` table:

```markdown
| Criterion | Result | Output |
|---|---|---|
| 1 | PASS | (exit code 0) |
| 2 | FAIL | Coverage: 72% (required: 85%) |
| 3 | PASS | 200 |
```

Truncate output to 120 characters if too long.

#### 5. Determine overall result

**All pass:**
- Update `## Status` to `passed`
- Move the file from `.dev-forge/gate/active/` to `.dev-forge/gate/archive/`
- Update `index.md`: remove from `## Open`, add under `## Passed` with today's date

**Any fail:**
- Update `## Status` to `failed`
- Keep the file in `.dev-forge/gate/active/`
- Update `index.md`: remove from `## Open`, add under `## Failed`

#### 6. Print summary

**All pass:**
```
✓ GATE-20260529-143022: all 3 criteria passed
  Archived to .dev-forge/gate/archive/
```

**Any fail:**
```
✗ GATE-20260529-143022: 1 of 3 criteria failed

  Criterion 1: PASS
  Criterion 2: FAIL — Coverage: 72% (required: 85%)
  Criterion 3: PASS

  Fix the failing criterion and run /dev-forge:gate verify GATE-20260529-143022 again.
```

When verifying multiple gates:
```
✓ GATE-20260529-100000: all 2 criteria passed
✗ GATE-20260529-143022: 1 of 3 criteria failed

Results: 1 passed, 1 failed
```

---

## /dev-forge:gate list

**Usage:** `/dev-forge:gate list [status]`

- `status` (optional): `open`, `passed`, `failed`, or `all`. Defaults to `open`.

### Steps

#### 1. Check that .dev-forge/gate exists

If `.dev-forge/gate/` does not exist, print:

```
No gate knowledge base found in this project.
Run /dev-forge:gate define "<task title>" to create your first gate.
```

Then stop.

#### 2. Collect gate files

| status | directories to scan |
|--------|---------------------|
| `open` | `.dev-forge/gate/active/` (files with status `open`) |
| `passed` | `.dev-forge/gate/archive/` (files with status `passed`) |
| `failed` | `.dev-forge/gate/active/` (files with status `failed`) |
| `all` | both `active/` and `archive/` |

For each `.md` file, extract:
- **Gate ID**: from the `## Gate ID` section
- **Title**: from the first `# Heading` line
- **Status**: from the `## Status` section
- **Criterion count**: number of `### Criterion` headings
- **Last modified**: file modification date

#### 3. Display results

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

---

## /dev-forge:gate template

**Usage:**
- `/dev-forge:gate template <keyword>` — search archived gates by keyword
- `/dev-forge:gate template` — list all archived gates

Example: `/dev-forge:gate template "authentication"`

### Steps

#### 1. Check that .dev-forge/gate/archive exists

If `.dev-forge/gate/archive/` does not exist or is empty, print:

```
No archived gates found. Gates are archived after passing /dev-forge:gate verify.
```

Then stop.

#### 2. Collect matching archived gates

If `<keyword>` is provided, check each `.md` file in `.dev-forge/gate/archive/` for keyword matches in the title or criterion descriptions (case-insensitive).

If `<keyword>` is omitted, include all archived gates.

#### 3. Display results

```
────────────────────────────────────────────────────────────────
GATE-20260528-091500: Add User Registration API
Archived: 2026-05-28
────────────────────────────────────────────────────────────────

Criteria:
  1. All unit tests pass
     $ npm test -- --grep "user registration"
  2. API returns 201 on valid input
     $ curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3000/api/users

To reuse these criteria, run:
  /dev-forge:gate define "<your new task title>"
Then copy the criterion blocks from the archived file above.
```

If no matching gates are found:

```
No archived gates found matching: "<keyword>"

Run /dev-forge:gate template to list all archived gates.
```
