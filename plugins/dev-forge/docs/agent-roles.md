# Agent Roles Reference

Agent models are determined by the active profile in `devforge.yaml`. The defaults shown below are for the `balanced` profile. Use `/dev-forge:model profile <name>` to switch profiles.

## Core Agents

| Agent ID | Default Model (balanced) | Role | Can Contact |
|---|---|---|---|
| orchestrator | opus | Project Sponsor and user-facing front — delegates to Project Manager, relays clarifications, decides escalation, gives final approval | Project Manager, cross-team agents |
| project-manager | sonnet | Requirement analysis, sprint contract creation, progress tracking, quality/risk/cost management, Team Lead coordination | Orchestrator, team leads, cross-team agents |
| doc-manager | sonnet | Documentation coordination, wiki management | Orchestrator, Project Manager, team leads |
| release-manager | sonnet | Versioning, changelogs, release coordination | Orchestrator, Project Manager, team leads |
| explorer | haiku | Codebase exploration, symbol lookup (read-only) | Orchestrator, Project Manager, team leads |

## Team Agents (per team)

| Role | Default Model (balanced) | Responsibilities | Can Contact |
|---|---|---|---|
| team-*-lead | sonnet | Contract ownership, delegation, escalation | Project Manager, cross-team agents, own team |
| implementer-* | sonnet | Feature implementation (Generator role) | Own lead, evaluator, reviewer |
| evaluator-* | sonnet | Independent criteria verification (Evaluator role) | Own lead, implementer |
| reviewer-* | sonnet | Code quality review (style, security surface) | Own lead, implementer |

## Bug Council Agents

| Agent ID | Default Model (balanced) | Role |
|---|---|---|
| bug-council-orchestrator | opus | Coordinates 3-analyst diagnosis, synthesizes findings |
| root-cause-analyst | sonnet | Traces failure chain from symptom to origin |
| pattern-matcher | sonnet | Matches current failure to historical patterns in learnings |
| adversarial-tester | sonnet | Edge case stress-testing, reproduction (read-only) |

## Specialist Templates

| Template | Default Model (balanced) | Focus | Added via |
|---|---|---|---|
| security-auditor | sonnet | OWASP, injection, auth/authz | `/dev-forge:agent add <team> security-auditor` |
| performance-analyst | sonnet | Algorithmic complexity, DB queries | `/dev-forge:agent add <team> performance-analyst` |
| devops-engineer | sonnet | CI/CD, Docker, Kubernetes, IaC | `/dev-forge:agent add <team> devops-engineer` |
| doc-writer | sonnet | Technical writing, API docs | `/dev-forge:agent add <team> doc-writer` |

## Model Aliases

| Alias | Full Model ID |
|---|---|
| `opus` | claude-opus-4-6 |
| `sonnet` | claude-sonnet-4-6 |
| `haiku` | claude-haiku-4-5-20251001 |

## Responsibility Matrix

| Responsibility | Orchestrator | Project Manager | Team Lead |
|---|---|---|---|
| User-facing communication (front) | ✅ | | |
| Relay clarification questions to user | ✅ (user side) | ✅ (analysis side) | |
| Requirement analysis and planning | | ✅ | |
| Sprint Contract creation | | ✅ | |
| Sprint Contract issuance to Team Lead | | ✅ | |
| Task breakdown within team | | | ✅ |
| Progress tracking and quality management | | ✅ | |
| Risk management and Learnings lookup | | ✅ | |
| Cost tracking (model usage) | | ✅ | |
| Escalation recommendation | | ✅ (recommends) | |
| Escalation and Bug Council decision | ✅ | | |
| Final approval of deliverables | ✅ | | |
| Reporting results to user | ✅ | | |

## Generator/Evaluator Pattern

The Implementer and Evaluator are always separate agents. This eliminates confirmation bias:
- **Implementer** (Generator): writes the code
- **Evaluator**: independently verifies against sprint contract criteria
- **Reviewer**: separate quality check (style, maintainability, security) — complementary to evaluation

The Reviewer and Evaluator serve different purposes and can run in parallel.
