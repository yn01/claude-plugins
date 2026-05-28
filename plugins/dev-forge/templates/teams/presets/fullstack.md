# Fullstack Preset

7-agent team covering the full development pipeline from investigation to validation.

## Agents

| Agent | Role | Tools | Model |
|-------|------|-------|-------|
| researcher | Investigates codebase before work begins | Read, Grep, Glob | haiku |
| story-writer | Writes user stories and acceptance criteria | Read | sonnet |
| spec-writer | Converts stories to technical specification | Read, Grep, Glob | sonnet |
| backend-builder | Implements backend: APIs, data models, logic | Read, Write, Edit, Bash, Grep, Glob | sonnet |
| frontend-builder | Implements frontend against backend API summary | Read, Write, Edit, Bash, Grep, Glob | sonnet |
| test-verifier | Writes and runs acceptance tests | Read, Write, Edit (test files), Bash | sonnet |
| validator | Audits implementation against spec; reports gaps | Read, Grep, Glob | sonnet |

## Pipeline

```
Human Architect
  ↓ task brief
researcher       → investigation report
  ↓
story-writer     → user stories + acceptance criteria
  ↓ (Architect approves)
spec-writer      → technical specification
  ↓ (Architect approves)
backend-builder  → implementation + API summary
  ↓
frontend-builder → implementation
  ↓
test-verifier    → acceptance test results
  ↓
validator        → gap report
  ↓
Human Architect  → review & ship decision
```

## When to use

Use this preset when:
- The task has both a backend API layer and a frontend UI
- You want explicit separation of concerns between builder roles
- You want formal acceptance test verification before shipping
