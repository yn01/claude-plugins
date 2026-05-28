---
description: Search archived gates by keyword and display them as reusable templates
allowed-tools: Read, Bash, Glob
argument-hint: "[keyword]"
---
# /dev-gate:template

Search archived (passed) gates for criteria that can be reused in a new gate definition.

**Usage:**
- `/dev-gate:template <keyword>` — search for archived gates related to a keyword
- `/dev-gate:template` — list all archived gates

Example: `/dev-gate:template "authentication"`

## Steps

### 1. Check that .dev-gate/archive exists

If `.dev-gate/archive/` does not exist or is empty, print:

```
No archived gates found. Gates are archived after passing /dev-gate:verify.
```

Then stop.

### 2. Collect matching archived gates

If `<keyword>` is provided, read each `.md` file in `.dev-gate/archive/` and check whether the title or criterion descriptions contain the keyword (case-insensitive).

If `<keyword>` is omitted, include all archived gates.

### 3. Display results

For each matching archived gate, display:

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
  /dev-gate:define "<your new task title>"
Then copy the criterion blocks from the archived file above.
```

If no matching gates are found, print:

```
No archived gates found matching: "<keyword>"

Run /dev-gate:template to list all archived gates.
```
