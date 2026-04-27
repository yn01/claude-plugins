# Sprint Workflow

This document describes the full sprint lifecycle in dev-forge.

## Overview

A sprint begins when the user issues a request to the Orchestrator. The Orchestrator delegates all planning and execution to the Project Manager, which creates Sprint Contracts and assigns them to Team Leads.
The Team Lead owns the contract, delegates to team members, and reports completion back to the Project Manager.

## Sequence

```
User
 │
 ├─ /dev-forge:contract create team-alpha-lead "Implement user authentication"
 │
Orchestrator
 ├─ Receives user request
 ├─ Delegates to project-manager: "Plan and execute: <task>"
 │
project-manager
 ├─ Performs requirement analysis
 ├─ Creates CONTRACT-YYYYMMDD-HHMMSS in contracts table
 ├─ Sends message to team-alpha-lead: "New contract assigned"
 │
team-alpha-lead
 ├─ Reads contract (task + acceptance criteria)
 ├─ Decomposes into subtasks
 ├─ Messages implementer-alpha: "Implement subtask X"
 │
implementer-alpha
 ├─ Reads sprint contract criteria
 ├─ Implements the feature
 ├─ Messages team-alpha-lead: "Implementation complete"
 │
team-alpha-lead
 ├─ Messages evaluator-alpha: "Please evaluate contract CONTRACT-ID"
 │
evaluator-alpha
 ├─ Reads contract criteria (JSON array)
 ├─ Verifies each criterion independently (dynamic verification)
 ├─ Messages team-alpha-lead: "EVALUATION PASS / FAIL"
 │
team-alpha-lead (on PASS)
 ├─ Updates contract status to 'completed' in SQLite
 ├─ Messages project-manager: "Contract CONTRACT-ID completed"
 │
project-manager
 ├─ Tracks completion, updates progress
 ├─ Reports to orchestrator: "Task complete"
 │
Orchestrator
 └─ Notes completion, relays result to user
```

## Model Escalation During Sprint

If the evaluator reports FAIL:
1. Team Lead tracks consecutive failure count
2. At 2 failures: Team Lead reports to Project Manager, recommends model escalation
3. Project Manager forwards escalation recommendation to Orchestrator
4. At 4 failures: Orchestrator approves escalation to Opus model, notifies Project Manager
5. At 6 failures: Orchestrator triggers Bug Council

## Sprint Contract Format

Contracts are stored in the SQLite `contracts` table. The `criteria` field is a JSON array of strings, each representing one acceptance criterion.

Example:
```json
["Users can log in with email and password", "Failed login attempts are rate-limited to 5 per minute", "JWT tokens expire after 24 hours"]
```

See `docs/contract-format.md` for full schema documentation.
