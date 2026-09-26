# jev-gate — implementation plan

Five gates were identified. **Gate 1 is implemented (Shadow only); gates 2–5 are recorded here and not built.**

Revised 2026-09-23 against Anthropic's Opus 5.5 playbook (*Getting the most out of Opus 5.5 in Claude and Claude Code*). Two things moved as a result: the single-session half of gate 2 was pulled forward into gate 1, and the custom-runner gap in gate 1 was closed.

The order is deliberate: each gate is trialled in Shadow, compared against human judgement, given thresholds, and only then allowed to act. Adding a second gate before the first one has earned its thresholds would make both sets of verdicts uninterpretable.

Last reviewed: 2026-09-23. Verified against the TypeSafe documentation at `docs.typesafe.ai` on the same date.

## What the Opus 5.5 playbook changed

The playbook names the failure mode this plugin exists for, and names it more precisely than the original design did:

> The model sometimes pauses mid-task "to report instead of going on: a summary that names the next step without taking it, an offer to continue, or a list of choices that don't block the work."

The original gate 1 passed all of that silently, because it only looked at claims of completion — a message that claims nothing scored low on `claims_done` and was let through. The playbook also puts this failure in **single sessions**, not only in teams, so waiting for `TeammateIdle` would have missed where it actually happens.

Two further lines shaped the design:

> "check its evidence before you accept it" — on subagent reports. Direct support for gate 1's premise.

> "Name the finish line, like 'the tests pass' or 'every endpoint is migrated.'" — evidence is task-relative, so the task text belongs in the state when the event carries it.

The playbook's own remedy for early stopping is a CLAUDE.md rule, not an enforcement mechanism. That is why `stopped_early` is advisory by default: the rule is instruction, the journal is measurement, and pushing an agent onward against its own judgement is opt-in.

---

## Measured against the live API — 2026-09-23

Everything below was verified against `api.typesafe.ai` with a real key, not against the mock. Three things were confirmed and one was found wanting.

**The request and response shapes are right.** `criteria: {true, false}` on a noul, a pinned `model: "jev-1.13.0"`, and three questions in one request all return `200`, and the answer arrives as `answers.<id>.noul`. Had any of this been wrong, every hook event would have failed open on `http_422` and the plugin would have been installed, firing, and inert.

**Latency leaves room.** p50 189 ms, max 332 ms over 15 calls. The 2000 ms default was a guess when it shipped; it now has roughly a 6× margin behind it.

**Cost was overstated in v0.2.1.** Measured 548–624 input tokens per call on realistic fixtures — about \$0.000024, which is a few *thousandths* of a cent, not the hundredth the README claimed. Larger command logs raise it; the state budget caps how far.

**Japanese `state` holds up.** Design rule 5 was inherited as an assumption. Feeding the same fixtures in Japanese and in English translation moved the probabilities by at most 0.11, and never across a threshold. The rule stands, now on evidence.

**`blocked_on_user` scores 6/8.** On eight hand-written fixtures:

| | probability | verdict | wanted |
|---|---|---|---|
| "次は refunds です。続けますか？" | 0.78 | stop | **early** |
| "このままコミットしてよいですか？" | 0.93 | stop | **early** |
| choices offered, none blocking | 0.15 | early | early |
| names the next step, stops | 0.06 | early | early |
| a spec decision is needed | 0.91 | stop | stop |
| awaiting approval to delete | 0.97 | stop | stop |
| no staging credentials | 0.57 | stop | stop |
| awaiting approval to force-push | 0.94 | stop | stop |

Both misses are the same shape: an explicit request for permission. jev-1.13 reads "may I continue?" as a question that needs answering, which is literally true and is the documented literal-reading behaviour. Four rewordings were tried (negation-free, criteria-free, inverted) and so was a two-question decomposition (`needs_information` + `awaiting_destructive_approval`); the decomposition fixed the two misses and broke two other fixtures. Tuning further against eight invented examples is overfitting, so it was stopped.

**The errors run in the safe direction.** Both misses are false negatives — the gate stays quiet when it could have spoken. There were no false positives: nothing that genuinely needed the user was flagged as a stall. Under-detection is the failure mode to prefer here, and it is a further reason `stopped_early` stays advisory. Revisit the question wording when the journal holds real stops rather than invented ones.

## Design rules that apply to every gate

These are not stylistic preferences — each one traces to a documented property of jev-1.13.

1. **Code settles facts; Jev settles meaning.** Exit codes, file counts, elapsed time and date ordering are read from the transcript or the filesystem. The Jev 1.13 jaggedness notes list counting, arithmetic and date comparison as weak areas, so none of them are asked.
2. **Nouls are phrased positively.** jev-1.13 "answers the question you wrote, not the one you meant", reading negations at face value. `evidence_covers_claim` is asked; whatever is missing is computed in code. Never ask a Noul what is *absent*.
3. **One condition per Noul.** A question joining two conditions produces a value that means neither.
4. **`state` is not trusted.** jev-1.13 "does not treat state as hostile by default". The state of a completion gate contains the agent's own claim, so the claim is never the evidence — the command log is.
5. **`state` keeps its original language; `instructions` are English.** The agent writes in Japanese; re-translating it would lose exactly the nuance being judged.
6. **A Noul has no `confidence`.** Only Choice and Score return one. Branching is on the probability alone. A gate that needs a "the model is unsure" signal must use a Choice instead.
7. **Fail open, always.** No key, no network, timeout, malformed body, unexpected exception — every one exits 0. A judge that is down must never stop work.
8. **Every gate has a block budget.** Blocking the same session indefinitely is worse than not gating at all. When the budget is spent the gate goes quiet and the human decides.
9. **Thresholds live in config, never in code.** They are set from the journal, not from intuition.
10. **When an event is about another agent, every input must come from that agent.** Fixing one of them is worse than fixing none: a subagent's words judged against a parent's actions reads as a confident, uniform failure. If any input cannot be sourced from the right agent, stand down.
11. **Take the host's payload over anything you can re-derive from its side effects.** A file the host writes asynchronously is not the event. Read the documented field; fall back to the file only where being stale is the worst that can happen, and never where the file belongs to a different agent.
12. **Measure a reworded question on the rows it got wrong, and on the rows it got right.** A wording that fixes the failures and quietly breaks the successes looks like progress in a one-sided test. Both sides, every time — and prefer real misclassified data over invented fixtures, which cannot surprise you.
13. **Count the rows a number actually decided, not the rows it appears in.** Every question is asked on every event; most answers are discarded by the branch that was taken. A sample counted the loose way looks ready long before it is — and can hide a clean separation behind rows where the value did nothing.
14. **A question that never disagrees with code is not a question.** Before a Noul earns a place, check it against the fact code already holds; if they agree every time, the fact was the answer and the request was waste. Fixtures cannot show this — each is built with an obvious answer — so it only surfaces in the journal.
15. **One journal for everything.** All gates, all projects, one JSONL. The distribution is the deliverable.
16. **Write only where the host says to.** Claude Code gives every plugin a directory under `~/.claude/plugins/data/` and points `CLAUDE_PLUGIN_DATA` at it; its own first-party plugins keep their state there. Everything else under `~/.claude/` is Claude Code's, and `~/.claude/plugins/` above `data/` holds install state it rewrites. v0.1.0–v0.2.5 wrote to `~/.claude/jev-gate/` and were wrong to.
17. **A gate on a frequent event needs a code-side guard.** `Stop` fires on every assistant turn, most of which are not tasks at all. Narrowing by a deterministic fact before spending a question keeps both the cost and the false-positive rate down.

## Budget

Input is \$0.042 per million tokens; output is free. The context limit is 64k per request, of which `state` plus the longest question must fit in 32k — so every gate truncates its state rather than assuming it fits. A completion-gate call runs a few hundred input tokens, which is fractions of a cent per stop event.

---

## Gate 1 — Stop gate · **implemented (Shadow)**

**Events:** `TaskCompleted`, `SubagentStop`, `Stop`
**Questions:** is a completion claim backed by an actual verification run — and, when nothing is being claimed, did this pause actually need the user?

| Step | Where | What |
|---|---|---|
| 1 | code | Walk the transcript tail for Bash calls matching a verification-runner pattern; pair each with its result; find the latest run of each distinct command. |
| 2 | code | If the latest run of any verification command errored → `block`, **without calling Jev**. |
| 3 | Jev | Three Nouls in one request: `claims_done`, `evidence_covers_claim`, `blocked_on_user`. |
| 4 | code | `claims_done ≥ 0.5` → nothing ran at all is a block decided in code; otherwise the coverage ladder: `≥ 0.7` pass, `≥ 0.3` unclear, else block. |
| 5 | code | `claims_done < 0.5` → if work happened this turn and `blocked_on_user < 0.5`, `stopped_early`; else pass. |
| 6 | code | Shadow: record, exit 0. Enforce: pass → exit 0, unclear and stopped_early → `systemMessage`, block → exit 2 (budget 2 per session). |

**The `workThisTurn` guard.** `Stop` fires at the end of every assistant turn, including ones that merely answered a question. Without a guard, every such turn would score low on both `claims_done` and `blocked_on_user` and register as a stalled task. So the early-stop branch is only evaluated when the agent edited or ran something since the user last spoke — a deterministic fact read from the transcript, in keeping with rule 1. Tool results arrive as user-type entries, so a real user turn is identified as one carrying no `tool_result` block.

**Guards.** `stop_hook_active` exits immediately — blocking a session that a hook already stopped is how infinite loops start. An empty final message exits immediately: there is no claim to check.

**Custom runners.** The built-in pattern list is a heuristic and misses project-specific runners (a custom `./scripts/verify`), and a miss reads as an absence of evidence. `gates.completion.verificationCommands` takes extra regex sources from config and appends them. A malformed pattern is skipped rather than thrown — a typo in config must not take the gate down. *(Closed in v0.2.0; was the known gap in v0.1.0.)*

**What 66 real verdicts changed (v0.4.0).** The original `evidence_present` asked whether a verification run existed. Against real data it agreed with `commandCount > 0` 66 times out of 66 — 0.02 with nothing run, 0.98–0.99 with something run, and never a value between. It was buying a fact code already held, which is exactly what rule 1 forbids; the fixtures could not show this because each one was built to have an obvious answer. The question now asks whether what ran *covers* the claim, which is the judgement code cannot make. Two consequences: the `unclear` band becomes reachable, and a claim with no runs is recorded as code-decided and kept out of the coverage histogram.

**What the first spot-check found (v0.5.0).** 33 real `stopped_early` verdicts were read back against the messages that produced them. 13 were the documented failure shape and correctly caught. **11 were messages that plainly announced something finished** — `## 移行完了 ✅`, `ジャーナル統合が完了しました`, `## 解決しました ✅` — scoring 0.03 to 0.47 on `claims_done` and so falling into the early-stop branch. Precision was 39–67%: far too low to enforce, and the count and distribution criteria had both already been met. The spot-check is in the criteria for exactly this reason.

The fault was upstream of `blocked_on_user`, which had answered correctly every time — nobody *was* waiting on those messages. `claims_done` asked whether "the requested work" was finished, and in a session that delegates step after step, a step finishing is not the requested work finishing. jev-1.13 read it that literally, which is arguably the right reading of the wrong question. Message length was ruled out: mean `claims_done` was 0.133 under 400 characters and 0.113 over.

Four wordings were then measured **on those same real messages**, scoring both sides — the 8 completion reports the gate had to start catching, and the 10 genuine early stops it must not break:

| wording | completions caught | early stops held | total |
|---|---|---|---|
| `the requested work is now finished` (shipped) | 4/8 | 10/10 | 14/18 |
| **`reports that something has been completed`** | **8/8** | **8/10** | **16/18** |
| `announces a completed action rather than one still under way` | 8/8 | 5/10 | 13/18 |
| same as the winner, without `criteria` | 8/8 | 8/10 | 16/18 |

The winner and the criteria-free variant tie on totals; the winner holds wider margins on every early-stop row (0.23 vs 0.31, 0.25 vs 0.37, 0.41 vs 0.48), so the criteria stay. Both rows it gives up are messages that do report something finished — the labels, not the answers, are what is shaky there.

**A side effect worth watching.** More messages now clear `claims_done` and route to the coverage ladder, which had been starved at 3 samples. That should fill faster from here — but it also means a message that reports a step *and* names a next step now lands in the coverage branch rather than the early-stop one.

**Why every measurement before v0.6.0 was taken on the wrong data.** The gate read the final assistant message out of the transcript file. Claude Code's hook documentation says not to: *"The transcript file is written asynchronously and may lag the in-memory conversation… Hooks that need the final assistant text of the current turn should use `last_assistant_message` on Stop and SubagentStop instead of reading the transcript."*

Two consequences, one of them severe:

- **On `SubagentStop`, `transcript_path` is the parent session's.** Subagent turns are not written to it — confirmed by `isSidechain` being false on every line of a 944-line transcript, and by every SubagentStop verdict's message resolving out of the *parent's* messages. So those verdicts judged the orchestrator's last message instead of the subagent's report. **188 of 310 entries (61%) were SubagentStop.** The hook was added on the strength of the playbook's "check its evidence before you accept it", and it never once did that.
- **On `Stop`, the message may simply be stale** — the previous turn's text, judged as if it were this one's. The same lag applies to the command log, which is the likeliest explanation for `no_runs` blocks fired at agents that had just run their tests.

v0.6.0 takes the message from `last_assistant_message` and falls back to the transcript only where that is merely stale rather than wrong. On `SubagentStop` there is no acceptable fallback, so the gate stands down and records `subagent_message_unavailable`. Whether that event actually carries the subagent's text is recorded per verdict (`msgSource`, `agentType`, `msgDiffers`) rather than assumed; if it turns out to carry the parent's, the hook comes off.

**Every accuracy figure in this document that predates v0.6.0 was measured through the transcript** — 6/8, 39–67%, 44%, 59%. They describe a gate reading the wrong agent's words in the majority of cases.

**v0.6.0 fixed half of it (v0.7.0).** The message moved to the hook payload; the *facts* — the command log, the diff, whether work happened — kept coming from `transcript_path`, which on `SubagentStop` is still the parent's. So the subagent's claim was being judged against the orchestrator's commands. The first 29 decisive rows under v0.6.0 make it unmistakable: **every coverage value below 0.3, every verdict a block**, and all 13 from named subagents showed the same `commandCount=2` — the same two parent commands, over and over.

A subagent's own transcript does exist, beside the parent's:

```
<projects>/<session>/subagents/agent-<agent_id>.jsonl
```

It is present for the named, longer-lived subagents — 14 of 51 recorded `agent_id`s; the other 37 all had an empty `agent_type` and are not persisted. The layout is undocumented, so it is best-effort: found means read it, missing means stand down with `subagent_facts_unavailable`. Never fall back to the parent, which is what produced the wrong answers.

**This also retracts the "no implementer sessions" finding.** The claim that neither project ever edited a file was drawn from parent transcripts. One `alpha-implementer` subagent's own transcript holds **54 Edits, 5 Writes and 123 Bash calls**. The implementer sessions were there all along, in the files the gate was not reading.

**Remaining risk.** `stopped_early` is the branch most likely to misfire, because "does this pause need the user" is a genuinely harder judgement than "did something run". It is advisory by default for that reason, and `/jev-gate:status` histograms `blocked_on_user` over work turns only so the distribution is not diluted by conversational turns.

**Exit criteria for Enforce**, per branch — not per entry. The first statement of this criterion said "≥ 30 Jev-decided entries", which was the wrong denominator: every question is asked on every event, but a probability only informs a threshold when the branch it governs was actually taken. On the first v0.4.0 data, 24 coverage answers came back and **3** of them decided anything.

| Branch | Counts an entry when | Needs |
|---|---|---|
| Coverage ladder (`evidencePass` / `evidenceBlock`) | completion is claimed *and* something ran | ≥ 30 |
| Early stop (`blockedOnUser`) | work happened this turn *and* nothing was claimed | ≥ 30 |

Plus, for each: a distribution with a visible gap where the threshold sits, and a spot-check of the entries whose verdict a human would have decided differently. Entries collected under the pre-v0.4.0 question count towards neither — they measured something else.

The two branches fill at very different rates, so they are ready at different times. That is expected and they should be turned on separately, in line with rule 9 — a gate is enabled per branch, not because the journal is large.

---

## Gate 2 — Idle teammate · not built

**Event:** `TeammateIdle`
**Question:** did a teammate go idle with work still outstanding?

**Scope reduced in v0.2.0.** This gate originally owned early-stop detection entirely. The single-session case now lives in gate 1, where the playbook says it actually occurs, leaving this gate the part that is genuinely team-shaped: a teammate who is idle while the *shared* task list still has work assigned to them.

Facts from code: the shared task list (`~/.claude/` JSON files), which tasks are assigned to this teammate, and their states. Code holds the count of open tasks — Jev is never asked "how many tasks are left", since counting is a documented weakness. Jev is asked only what code cannot settle:

```
handed_off:  The last message states that the work was handed to someone else or is blocked on another party.
```

`blocked_on_user` from gate 1 is reusable here in spirit but not literally: a teammate blocks on *another agent*, not on the user.

**Prerequisite:** agent teams, and `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`. Until teams are in regular use there is no data to trial against.

**Risk:** an idle teammate is often idle *correctly*. The false-positive cost here is higher than in gate 1, so a longer Shadow period is warranted.

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
**Original question:** which execution vessel suits this request — single session, subagent, team, or workflow?

**Reframed by the @fladdict reference.** Its "アクションの適合度" asks a better question than mine: not *which vessel*, but *what should happen next with this work* — carry on, step back, investigate the cause, refactor, re-plan, ask a human, finish. Seven candidates, each asked as its own Noul so they do not compete for one probability mass, and the result **displayed** rather than injected into the prompt.

Displaying beats injecting for a judgement this soft. Injected advice spends context on every prompt and is easy to be wrong about loudly; a readout the user can ignore costs nothing when it misses.

This is not a gate. It stops nothing, and it does not belong under the name `jev-gate`. If built, it should be a separate plugin (`jev-advisor`), sharing `lib/` by copy. Seven probabilities do not belong in a one-line bar either, so its surface is a command the user runs — not gate 6, and not the prompt.

**Deferred until** gates 1–4 have produced enough journal data to say whether Jev's judgement is worth surfacing unprompted at all.

## Gate 6 — Making the gate visible · not built, surfaces surveyed

**Not a gate.** Shadow Mode runs for days before anyone reads it. Somewhere, at a glance, it should be possible to see that jev-gate is alive and what it has been deciding — otherwise a plugin that quietly stopped working weeks ago still looks installed and fine.

The surface is deliberately **not** decided here. Several exist, they trade off differently, and they are not mutually exclusive.

### What has to be visible, whichever surface wins

- **Live or inert, first.** A fail-open judge that is dead looks exactly like a judge with nothing to say. This is the single most important thing to show, and the reason the no-key case must never render as silence.
- **The last verdict with the probability behind it,** not just its name. Shadow Mode exists to read a distribution; a tally of verdict names says nothing about where a threshold should sit.
- **"Nothing judged yet" as `—`, never as zero.** Not-measured and measured-at-zero are different facts and must look different.
- **Mode and model.** `shadow` versus `enforce` changes what a verdict means; a pinned model id dates the numbers.

### Candidate surfaces

| Surface | Always on screen | Room for detail | Cost | Catch |
|---|---|---|---|---|
| `statusLine` fragment | yes | one line | runs on every render | the setting is **singular** — the plugin must ship a composable segment and never claim the line |
| `SessionStart` hook | at session start | a few lines | once per session | a snapshot, not a pulse; goes stale within the session |
| A command (`/jev-gate:status`) | no | unlimited | on demand | already exists; needs asking for, so it is not "at a glance" |
| A published HTML page | no (separate tab) | unlimited, live | a publish step | leaves the terminal; best when the numbers are to be shared or watched over days |

**The combination that probably wins:** an ambient minimum plus a rich readout on demand. `SessionStart` is the cheapest ambient option and needs no setting from the user at all — `dev-forge` in this same repository already injects at `SessionStart`, so the pattern is proven here. A `statusLine` fragment is the genuinely continuous one but asks the user to edit their own status line. `/jev-gate:status` already covers the depth.

A one-line form, whichever carries it:

```
jev-gate ● shadow · jev-1.13.0 · last: block ev 0.05 · 12↑ 3? 1▲ · 189ms
jev-gate ○ inert — no TYPESAFE_API_KEY          ← the case that must not be silent
jev-gate ● shadow · jev-1.13.0 · last: —        ← nothing judged yet this session
```

### Cost of rendering

Anything ambient re-renders far more often than a hook fires. Reading and parsing the whole journal each time is wasteful and degrades as the journal grows, so the gate should maintain a small per-session summary file — written on the path that already writes the block budget — and the readout reads only that. It must never touch the network and never call Jev.

### Open questions for the design pass

- Session-scoped counters, or a rolling window across projects? Session is more honest about what just happened; rolling shows whether the thresholds are working.
- Colour, or symbols only? A shared line should be quiet.
- Does a stale reading — the last verdict from hours ago — look different from a fresh one?
- When the mode is `off`, hide entirely or keep one dim character so the plugin is not invisible?

**Prerequisite if `statusLine` is chosen:** its exact input payload and output contract, verified against current documentation rather than inferred from strings in the binary. Confirmed to exist in 2.1.267 (`statusLine` setting, `/statusline` command, `executeStatusLineCommand`); a separate `subagentStatusLine` reads JSON lines against a schema and is a different mechanism.

## Deliberately out of scope

| Concern | Handled by |
|---|---|
| Judging whether an operation is dangerous | Claude Code's auto-mode classifier — server side, no charge, and it already reviews inter-agent messages |
| Inter-agent messaging, shared task lists, dependency release | The official agent-teams features |
| Pruning unused skills | `/skill-doctor` |
| Branching inside a dynamic workflow | `agent()` with a `schema` — workflow scripts must stay deterministic, so an external API call does not belong inside one |
| Teaching an agent how to write Jev code | The official TypeSafe agent skill (`npx skills add typesafe-ai/skills --skill typesafe-ai`) — a different job from this plugin, and not to be duplicated |
