# Minimal Preset

3-agent team for small tasks or when you want to move fast with light process.

## Agents

| Agent | Role | Tools | Model |
|-------|------|-------|-------|
| researcher | Investigates codebase before work begins | Read, Grep, Glob | haiku |
| builder | Implements backend and frontend | Read, Write, Edit, Bash, Grep, Glob | sonnet |
| validator | Audits implementation against spec; reports gaps | Read, Grep, Glob | sonnet |

## Pipeline

```
Human Architect
  ↓ task brief
researcher  → investigation report
  ↓
builder     → implementation (full stack)
  ↓
validator   → gap report
  ↓
Human Architect  → review & ship decision
```

## When to use

Use this preset when:
- The task is small and well-understood
- You want to move fast without planning stages
- A single builder handling both backend and frontend is sufficient
- You can define acceptance criteria informally

## Trade-offs

Skipping story-writer and spec-writer means less upfront clarity. Ambiguities surface during implementation rather than being caught in planning. Suitable for low-risk changes; upgrade to `fullstack` or `backend-only` for larger features.
