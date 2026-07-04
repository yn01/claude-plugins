# Team Presets

## fullstack — 7 agents

Full development pipeline for projects with distinct frontend and backend layers.

| Agent | Role | Tools | Model |
|-------|------|-------|-------|
| researcher | Codebase investigation: maps relevant files, identifies patterns and risks | Read, Grep, Glob | claude-haiku-4-5-20251001 |
| story-writer | Translates task briefs into user stories with acceptance criteria | Read | claude-sonnet-4-6 |
| spec-writer | Converts stories into technical specifications | Read, Grep, Glob | claude-sonnet-4-6 |
| backend-builder | Implements API endpoints and business logic; backend folders only | Read, Write, Edit, Bash, Grep, Glob | claude-sonnet-4-6 |
| frontend-builder | Implements UI; consumes backend APIs as-is, does not invent endpoints | Read, Write, Edit, Bash, Grep, Glob | claude-sonnet-4-6 |
| test-verifier | Writes and runs acceptance tests; does not modify production code | Read, Write, Edit, Bash | claude-sonnet-4-6 |
| validator | Audits implementation against stories and spec; reports gaps by severity | Read, Grep, Glob | claude-sonnet-4-6 |

## backend-only — 5 agents

For projects with no frontend layer or where frontend is handled separately.

researcher, story-writer, spec-writer, backend-builder, validator

## minimal — 3 agents

Lightweight setup for small projects or solo development.

researcher, builder (backend + frontend combined), validator
