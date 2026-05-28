---
description: Run all verification commands in a gate and determine pass/fail
allowed-tools: Read, Write, Bash, Glob
argument-hint: "[gate-id]"
---
# /dev-gate:verify

Run the verification commands for one or all active gates and record the results.

**Usage:**
- `/dev-gate:verify <gate-id>` — verify a specific gate
- `/dev-gate:verify` — verify all gates in `.dev-gate/active/`

Example: `/dev-gate:verify GATE-20260529-143022`

## Steps

### 1. Check that .dev-gate exists

If `.dev-gate/` does not exist, print:

```
No dev-gate knowledge base found in this project.
Run /dev-gate:define "<task title>" to create your first gate.
```

Then stop.

### 2. Resolve target gate file(s)

If `<gate-id>` is provided:
- Search `.dev-gate/active/` for a file whose name contains `<gate-id>`
- If not found, print an error and stop:
  ```
  Gate not found: <gate-id>
  Run /dev-gate:list to see available gates.
  ```

If `<gate-id>` is omitted:
- Collect all `.md` files in `.dev-gate/active/`
- If none exist, print:
  ```
  No active gates found. Run /dev-gate:define to create one.
  ```
  Then stop.

### 3. For each target gate file, run verification

Read the gate file and parse all criteria. For each criterion:

1. Extract the bash code block that follows the criterion heading
2. Run the command using `bash -c "<command>"` with a timeout of 60 seconds
3. Capture exit code and stdout/stderr output

**Success conditions:**
- Exit code is 0, OR
- The criterion specifies `Expected: stdout contains "<string>"` and the output contains that string

**Failure conditions:**
- Exit code is non-zero AND no stdout match condition is satisfied

Track results as `PASS` or `FAIL` per criterion.

### 4. Update the gate file

Fill in the `## Verification Results` table in the gate file:

```markdown
| Criterion | Result | Output |
|---|---|---|
| 1 | PASS | (exit code 0) |
| 2 | FAIL | Coverage: 72% (required: 85%) |
| 3 | PASS | 200 |
```

Truncate output to 120 characters if it is too long.

### 5. Determine overall result

**All pass:**
- Update `## Status` to `passed`
- Move the file from `.dev-gate/active/` to `.dev-gate/archive/`
- Update `index.md`: remove entry from `## Open`, add under `## Passed` with today's date

**Any fail:**
- Update `## Status` to `failed`
- Keep the file in `.dev-gate/active/`
- Update `index.md`: remove entry from `## Open`, add under `## Failed`

### 6. Print summary

**All pass:**
```
✓ GATE-20260529-143022: all 3 criteria passed
  Archived to .dev-gate/archive/
```

**Any fail:**
```
✗ GATE-20260529-143022: 1 of 3 criteria failed

  Criterion 1: PASS
  Criterion 2: FAIL — Coverage: 72% (required: 85%)
  Criterion 3: PASS

  Fix the failing criterion and run /dev-gate:verify GATE-20260529-143022 again.
```

When verifying multiple gates, print one summary line per gate, then a totals line:

```
✓ GATE-20260529-100000: all 2 criteria passed
✗ GATE-20260529-143022: 1 of 3 criteria failed

Results: 1 passed, 1 failed
```
