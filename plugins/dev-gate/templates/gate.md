# [Task Title]

## Gate ID

GATE-YYYYMMDD-HHMMSS

## Status

open

## Task Description

[What is being built? Describe the feature, fix, or change this gate is guarding.]

## Completion Criteria

Each criterion must have a verification command that returns exit code 0 on success.

### Criterion 1: [Description]

```bash
# Verification command
npm test -- --grep "auth"
```

Expected: exit code 0

### Criterion 2: [Description]

```bash
# Verification command
npx c8 report --check-coverage --lines 85
```

Expected: exit code 0

### Criterion 3: [Description]

```bash
# Verification command
curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/api/auth/login
```

Expected: stdout contains "200"

## Verification Results

(Auto-filled by /dev-gate:verify)

| Criterion | Result | Output |
|---|---|---|
| 1 | - | - |
| 2 | - | - |
| 3 | - | - |

## Notes

[Optional: any additional context, assumptions, or constraints for this gate]
