# Model Escalation and Bug Council

## Model Escalation Ladder

When an implementer repeatedly fails to satisfy sprint contract criteria, the Team Lead tracks consecutive failures and reports to the Project Manager, who evaluates and forwards escalation recommendations to the Orchestrator:

| Consecutive Failures | Action |
|---|---|
| 0–1 | Standard retry with same model |
| 2 | Escalate implementer model to `sonnet` |
| 4 | Escalate implementer model to `opus` |
| 6 | Trigger Bug Council |

Configuration in `devforge.yaml`:

```yaml
model_escalation:
  enabled: true
  on_consecutive_failures:
    2: sonnet
    4: opus
  bug_council_trigger: 6
```

Escalation is stored in the `agent_status` table:
```bash
sqlite3 .dev-forge/dev-forge.db "UPDATE agent_status SET model='claude-opus-4-6' WHERE agent_name='implementer-alpha'"
```

Because `agent-loop.sh` reads the model from `agent_status` on every message, this change takes effect on the agent's next message — **no restart required**.

## Bug Council

The Bug Council is a 3-analyst multi-perspective diagnosis system activated when standard escalation is insufficient.

### Trigger Conditions

- `bug_council_trigger` consecutive failures threshold reached (default: 6)
- A bug tagged with `severity: critical` reported by the Team Lead

### Council Composition

| Analyst | Focus |
|---|---|
| root-cause-analyst | Traces failure chain from symptom to root cause |
| pattern-matcher | Searches `learnings` table for historical similar failures |
| adversarial-tester | Tests edge cases and boundary conditions (read-only) |

### Process

1. Orchestrator sends trigger message to `bug-council-orchestrator`
2. Bug Council Orchestrator messages all three analysts simultaneously
3. Each analyst investigates independently and reports findings via SQLite
4. Bug Council Orchestrator synthesizes the three reports into a unified diagnosis
5. Resolution plan is sent to the main Orchestrator
6. Findings are recorded in the `learnings` table

### Escalation to Human

If the Bug Council cannot produce a resolution plan, it escalates to the human with:
- Full failure timeline (from `messages` table)
- All attempted approaches (from `contracts` and `learnings` tables)
- Recommended intervention points

## Resetting Failure Count

After a successful implementation or after Bug Council resolution, the Team Lead should report success to the Project Manager, who in turn notifies the Orchestrator to reset the failure counter for the agent.

To reset an agent's model back to the active profile's default:
```
/dev-forge:model reset
```
