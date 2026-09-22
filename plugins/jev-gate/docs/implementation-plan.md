# jev-gate — implementation plan

Five gates were identified. **Gate 1 is implemented (Shadow only); gates 2–5 are recorded here and not built.**

The order is deliberate: each gate is trialled in Shadow, compared against human judgement, given thresholds, and only then allowed to act. Adding a second gate before the first one has earned its thresholds would make both sets of verdicts uninterpretable.

Last reviewed: 2026-09-23. Verified against the TypeSafe documentation at `docs.typesafe.ai` on the same date.

---

## Design rules that apply to every gate

These are not stylistic preferences — each one traces to a documented property of jev-1.13.

1. **Code settles facts; Jev settles meaning.** Exit codes, file counts, elapsed time and date ordering are read from the transcript or the filesystem. The Jev 1.13 jaggedness notes list counting, arithmetic and date comparison as weak areas, so none of them are asked.
2. **Nouls are phrased positively.** jev-1.13 "answers the question you wrote, not the one you meant", reading negations at face value. `evidence_present` is asked; `evidence_missing` is computed in code. Never ask a Noul what is *absent*.
3. **One condition per Noul.** A question joining two conditions produces a value that means neither.
4. **`state` is not trusted.** jev-1.13 "does not treat state as hostile by default". The state of a completion gate contains the agent's own claim, so the claim is never the evidence — the command log is.
5. **`state` keeps its original language; `instructions` are English.** The agent writes in Japanese; re-translating it would lose exactly the nuance being judged.
6. **A Noul has no `confidence`.** Only Choice and Score return one. Branching is on the probability alone. A gate that needs a "the model is unsure" signal must use a Choice instead.
7. **Fail open, always.** No key, no network, timeout, malformed body, unexpected exception — every one exits 0. A judge that is down must never stop work.
8. **Every gate has a block budget.** Blocking the same session indefinitely is worse than not gating at all. When the budget is spent the gate goes quiet and the human decides.
9. **Thresholds live in config, never in code.** They are set from the journal, not from intuition.
10. **One journal for everything.** All gates, all projects, one JSONL. The distribution is the deliverable.

## Budget

Input is \$0.042 per million tokens; output is free. The context limit is 64k per request, of which `state` plus the longest question must fit in 32k — so every gate truncates its state rather than assuming it fits. A completion-gate call runs a few hundred input tokens, which is fractions of a cent per stop event.

---

## Gate 1 — Completion gate · **implemented (Shadow)**

**Events:** `TaskCompleted`, `SubagentStop`, `Stop`
**Question:** is a completion claim backed by an actual verification run?

| Step | Where | What |
|---|---|---|
| 1 | code | Walk the transcript tail for Bash calls matching a verification-runner pattern; pair each with its result; find the latest run of each distinct command. |
| 2 | code | If the latest run of any verification command errored → `block`, **without calling Jev**. |
| 3 | Jev | Two Nouls in one request: `claims_done`, `evidence_present`. |
| 4 | code | `claims_done < 0.5` or `evidence_present ≥ 0.7` → pass; `≥ 0.3` → unclear; else block. |
| 5 | code | Shadow: record, exit 0. Enforce: pass → exit 0, unclear → `systemMessage`, block → exit 2 (budget 2 per session). |

**Guards.** `stop_hook_active` exits immediately — blocking a session that a hook already stopped is how infinite loops start. An empty final message exits immediately: there is no claim to check.

**Known gap.** The verification-command pattern list is a heuristic and will miss project-specific runners (a custom `./scripts/verify`). A miss produces a false "no evidence", which in Shadow is harmless and in Enforce is a wrong block. Before Enforce, the pattern list should be extendable from `.jev-gate/config.json`. **Not yet implemented.**

**Exit criteria for Enforce:** ≥ 30 Jev-decided entries in the journal, a readable `evidence_present` distribution, and a spot-check of disagreements against human judgement.

---

## Gate 2 — Early-stop detection · not built

**Event:** `TeammateIdle`
**Question:** did a teammate go idle with work still outstanding?

Facts from code: the shared task list (`~/.claude/` JSON files), which tasks are assigned to this teammate, and their states. Jev is asked only the part code cannot settle — whether the teammate's last message describes finished work or an unstated blocker.

```
handed_off:  The last message states that the work was handed to someone else or is blocked on another party.
work_stated: The last message describes a concrete result that was produced.
```

Code holds the count of open tasks. Jev is never asked "how many tasks are left" — counting is a documented weakness.

**Prerequisite:** agent teams, and `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`. Until teams are in regular use there is no data to trial against, which is why this is second rather than first.

**Risk:** an idle teammate is often idle *correctly*. The false-positive cost here is higher than in gate 1, so a longer Shadow period is warranted.

---

## Gate 3 — Task quality · not built

**Event:** `TaskCreated`
**Question:** is this task well-formed enough to be worth starting?

A Choice rather than a Noul, because this gate wants the `confidence` value that a Choice carries — "the model cannot tell what this task is" is itself the signal.

```
choice: well_formed | too_broad | no_completion_criteria | ambiguous_target
```

Code checks the mechanical properties first: does the task text exist, is it above a trivial length, does it name a file or a component.

**Risk of over-reach.** This gate rewrites how the user writes tasks, which is intrusive in a way gates 1 and 2 are not. It should probably ship as advisory (`systemMessage`) permanently and never gain an Enforce path.

---

## Gate 4 — Failure classification · not built

**Event:** `PostToolUseFailure`
**Question:** what kind of failure is this?

This gate never blocks. It returns `additionalContext` so the agent retries appropriately instead of thrashing.

```
choice: transient | missing_dependency | wrong_invocation | genuine_defect | permission
```

Code supplies the exit code, the command, and the stderr tail. The classification drives the advice injected: `transient` → retry once; `missing_dependency` → install before retrying; `wrong_invocation` → re-read the tool's usage rather than varying flags at random.

**Frequency warning.** Tool failures are common, so this gate fires far more often than the others. Cost is still negligible, but the latency budget must be tight (1s) and the fail-open path matters more here than anywhere else.

---

## Gate 5 — Approach advice · not built, and possibly not here

**Event:** `UserPromptSubmit`
**Question:** which execution vessel suits this request — single session, subagent, team, or workflow?

This is not a gate. It injects advice and never stops anything, so it does not belong under the name `jev-gate`. If it is built, it should be a separate plugin (`jev-advisor`), sharing `lib/` by copy.

**Deferred until** gates 1–4 have produced enough journal data to say whether Jev's judgement is worth surfacing to the user unprompted at every single prompt.

---

## Deliberately out of scope

| Concern | Handled by |
|---|---|
| Judging whether an operation is dangerous | Claude Code's auto-mode classifier — server side, no charge, and it already reviews inter-agent messages |
| Inter-agent messaging, shared task lists, dependency release | The official agent-teams features |
| Pruning unused skills | `/skill-doctor` |
| Branching inside a dynamic workflow | `agent()` with a `schema` — workflow scripts must stay deterministic, so an external API call does not belong inside one |
| Teaching an agent how to write Jev code | The official TypeSafe agent skill (`npx skills add typesafe-ai/skills --skill typesafe-ai`) — a different job from this plugin, and not to be duplicated |
