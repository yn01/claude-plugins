# Backend-Only Preset

5-agent team for tasks that have no frontend component — APIs, services, data pipelines, CLIs.

## Agents

| Agent | Role | Tools | Model |
|-------|------|-------|-------|
| researcher | Investigates codebase before work begins | Read, Grep, Glob | haiku |
| story-writer | Writes user stories and acceptance criteria | Read | sonnet |
| spec-writer | Converts stories to technical specification | Read, Grep, Glob | sonnet |
| backend-builder | Implements backend: APIs, data models, logic | Read, Write, Edit, Bash, Grep, Glob | sonnet |
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
backend-builder  → implementation
  ↓
validator        → gap report
  ↓
Human Architect  → review & ship decision
```

## When to use

Use this preset when:
- The task is backend-only: REST API, GraphQL, background job, CLI, data migration
- There is no frontend UI to build
- You want explicit planning stages before implementation
