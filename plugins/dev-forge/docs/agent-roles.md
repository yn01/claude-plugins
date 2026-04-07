# Agent Roles Reference

## Core Agents

| Agent ID | Model | Role | Can Contact |
|---|---|---|---|
| orchestrator | claude-opus-4-6 | Strategic task decomposition, sprint contract creation, escalation management | Team leads, cross-team agents |
| doc-manager | claude-sonnet-4-6 | Documentation coordination, wiki management | Orchestrator, team leads |
| release-manager | claude-sonnet-4-6 | Versioning, changelogs, release coordination | Orchestrator, team leads |
| explorer | claude-haiku-4-5-* | Codebase exploration, symbol lookup (read-only) | Orchestrator, team leads |

## Team Agents (per team)

| Role | Model | Responsibilities | Can Contact |
|---|---|---|---|
| team-*-lead | claude-sonnet-4-6 | Contract ownership, delegation, escalation | Orchestrator, cross-team agents, own team |
| implementer-* | claude-sonnet-4-6 | Feature implementation (Generator role) | Own lead, evaluator, reviewer |
| evaluator-* | claude-sonnet-4-6 | Independent criteria verification (Evaluator role) | Own lead, implementer |
| reviewer-* | claude-sonnet-4-6 | Code quality review (style, security surface) | Own lead, implementer |

## Bug Council Agents

| Agent ID | Model | Role |
|---|---|---|
| bug-council-orchestrator | claude-opus-4-6 | Coordinates 3-analyst diagnosis, synthesizes findings |
| root-cause-analyst | claude-sonnet-4-6 | Traces failure chain from symptom to origin |
| pattern-matcher | claude-sonnet-4-6 | Matches current failure to historical patterns in learnings |
| adversarial-tester | claude-sonnet-4-6 | Edge case stress-testing, reproduction (read-only) |

## Specialist Templates

| Template | Model | Focus | Added via |
|---|---|---|---|
| security-auditor | claude-sonnet-4-6 | OWASP, injection, auth/authz | `/dev-forge:agent add <team> security-auditor` |
| performance-analyst | claude-sonnet-4-6 | Algorithmic complexity, DB queries | `/dev-forge:agent add <team> performance-analyst` |
| devops-engineer | claude-sonnet-4-6 | CI/CD, Docker, Kubernetes, IaC | `/dev-forge:agent add <team> devops-engineer` |
| doc-writer | claude-sonnet-4-6 | Technical writing, API docs | `/dev-forge:agent add <team> doc-writer` |

## Generator/Evaluator Pattern

The Implementer and Evaluator are always separate agents. This eliminates confirmation bias:
- **Implementer** (Generator): writes the code
- **Evaluator**: independently verifies against sprint contract criteria
- **Reviewer**: separate quality check (style, maintainability, security) — complementary to evaluation

The Reviewer and Evaluator serve different purposes and can run in parallel.
