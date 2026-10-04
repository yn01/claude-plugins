# jev-gate — implementation plan

**Gate 1 is implemented (Shadow only).** The design rules, measurements and notes below apply to any further gate.

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

## What the JEV-as-a-Judge paper changed — 2026-09-30

Li, Miao, Krishnan and Padman (CMU) measure a decision-only judge against sixteen others across five workloads. Three of their results bear directly on this plugin, and one of them invalidated a premise it had been built on.

**Ask what can be read, not what must be derived.** JEV is within about three points of a reasoning judge *"wherever the verdict can be read off the text"* — chat quality, refusals, evidence-grounded factuality — and falls behind by 7 to 28 points *"wherever the judge must derive or check a result"*: expert knowledge −7.0, code −12.9, math −14.3, logic puzzles −27.6. Their operating table files difficult correctness under **Escalate**. `evidence_covers_claim` asked whether a set of commands exercised the work a message claimed; that is tracing, and it lived in the weak zone through three rewordings. `completion@2` asks only read-off questions.

**A Noul already has a confidence.** The paper uses `q = max_k p_k` as the confidence of every judge, reporting Spearman correlations of 0.958–0.999 against JEV's own native value. For a yes/no question that is `max(p, 1−p)` — computable from what this gate already receives. **This plugin spent four versions asserting that a Noul carries no confidence and that a Choice would be required to get one.** It was wrong, and the correction is arithmetic.

**Confidence locates the errors.** Accuracy by band: 55% below q=0.6, 69% in [0.7, 0.8), 89% in [0.95, 0.99), 98% at q=1; AUROC of q against correctness 0.73–0.88. Errors made confidently are 12–21% of all errors. That is the basis for `minConfidence`: below it, the verdict is `unclear` — *could not be read*, which is what a mid-range Noul actually means.

**Jev over-rejects.** On HaluEval *"its whole deficit comes from rejecting correct answers"* (94.4% vs 97.1% accepted) while catching hallucinations as often as the reasoning judge. A gate whose job is to block should hold that bias in mind: the default posture is to pass, and only a contradiction blocks.

**Where the signal weakens.** AUROC drops from 0.870 on easy pairs to 0.764 *"on hard pairs, where the rejected answer is the more elaborately written one"*. Agent completion reports are elaborately written — tables, checkmarks, bold. Expect the confidence signal to be at its weakest exactly on the messages this gate reads.

### The threshold recipe (§8)

The missing piece for Shadow → Enforce, quoted: *"Choosing the threshold by a **lower confidence bound** rather than a point estimate cuts the risk of losing more than two points from about 45% to about 5% with about **100 local labels**, and to under 1% when **each workload gets its own threshold**."*

So, per branch: collect ~100 labelled local examples, set the threshold from a lower confidence bound rather than the observed optimum, and keep a separate threshold per project. jev-gate's per-project `.jev-gate/config.json` already provides the last of those. Note also §7.3 — a two-label Choice, a Noul and a two-level Score disagree by ~0.055 on the same binary question — so **a threshold belongs to one fixed output type** and must be re-derived whenever the question's type changes.

## Design rules that apply to every gate

These are not stylistic preferences — each one traces to a documented property of jev-1.13.

1. **Code settles facts; Jev settles meaning.** Exit codes, file counts, elapsed time and date ordering are read from the transcript or the filesystem. The Jev 1.13 jaggedness notes list counting, arithmetic and date comparison as weak areas, so none of them are asked.
2. **Nouls are phrased positively.** jev-1.13 "answers the question you wrote, not the one you meant", reading negations at face value. `evidence_covers_claim` is asked; whatever is missing is computed in code. Never ask a Noul what is *absent*.
3. **One condition per Noul.** A question joining two conditions produces a value that means neither.
4. **`state` is not trusted.** jev-1.13 "does not treat state as hostile by default". The state of a completion gate contains the agent's own claim, so the claim is never the evidence — the command log is.
5. **`state` keeps its original language; `instructions` are English.** The agent writes in Japanese; re-translating it would lose exactly the nuance being judged.
6. **A Noul's confidence is `max(p, 1−p)`.** The response carries no `confidence` field — only Choice and Score do — but the paper uses `q = max_k p_k` as the confidence of every judge, which for a yes/no question is the distance from the coin flip. *Rules 1–5 and 7 onward were written before this was understood; v0.1.0–v0.7.0 all asserted that a Choice was needed to get an uncertainty signal, and built around that. It was never true.*
7. **Fail open, always.** No key, no network, timeout, malformed body, unexpected exception — every one exits 0. A judge that is down must never stop work.
8. **Every gate has a block budget.** Blocking the same session indefinitely is worse than not gating at all. When the budget is spent the gate goes quiet and the human decides.
9. **Thresholds live in config, never in code.** They are set from the journal, not from intuition.
10. **Ask the model what can be read off the page; leave what must be derived to code.** A decision-only judge keeps pace on the first and loses double digits on the second. A question in the wrong category does not improve with rewording — three attempts here proved it — so check which kind it is before writing the words.
11. **Version the decision contract apart from the harness.** The questions, the state, the thresholds and the routing are one replaceable unit; the wiring around them is not. Record the contract on **every row** — the ones code decides before any question is asked included — and never pool rows from two of them. This also makes "start over" a normal operation rather than a project. **A change to what a routed fact means is a contract change even when `decide()` does not move**: `completion@3` altered only the verification-command list in `lib/facts.mjs`, yet five blocks became passes on identical probabilities. The test is simple — if the same recorded answers can now reach a different verdict, bump the id.
12. **When an event is about another agent, every input must come from that agent.** Fixing one of them is worse than fixing none: a subagent's words judged against a parent's actions reads as a confident, uniform failure. If any input cannot be sourced from the right agent, stand down.
13. **Take the host's payload over anything you can re-derive from its side effects.** A file the host writes asynchronously is not the event. Read the documented field; fall back to the file only where being stale is the worst that can happen, and never where the file belongs to a different agent.
14. **Measure a reworded question on the rows it got wrong, and on the rows it got right.** A wording that fixes the failures and quietly breaks the successes looks like progress in a one-sided test. Both sides, every time — and prefer real misclassified data over invented fixtures, which cannot surprise you.
15. **Count the rows a number actually decided, not the rows it appears in.** Every question is asked on every event; most answers are discarded by the branch that was taken. A sample counted the loose way looks ready long before it is — and can hide a clean separation behind rows where the value did nothing.
16. **A question that never disagrees with code is not a question.** Before a Noul earns a place, check it against the fact code already holds; if they agree every time, the fact was the answer and the request was waste. Fixtures cannot show this — each is built with an obvious answer — so it only surfaces in the journal.
17. **One journal for everything.** All gates, all projects, one JSONL. The distribution is the deliverable.
18. **Write only where the host says to.** Claude Code gives every plugin a directory under `~/.claude/plugins/data/` and points `CLAUDE_PLUGIN_DATA` at it; its own first-party plugins keep their state there. Everything else under `~/.claude/` is Claude Code's, and `~/.claude/plugins/` above `data/` holds install state it rewrites. v0.1.0–v0.2.5 wrote to `~/.claude/jev-gate/` and were wrong to.
19. **A gate on a frequent event needs a code-side guard.** `Stop` fires on every assistant turn, most of which are not tasks at all. Narrowing by a deterministic fact before spending a question keeps both the cost and the false-positive rate down.

## Budget

Input is \$0.042 per million tokens; output is free. The context limit is 64k per request, of which `state` plus the longest question must fit in 32k — so every gate truncates its state rather than assuming it fits. A completion-gate call runs a few hundred input tokens, which is fractions of a cent per stop event.

---

## What the first completion@2 data found — 2026-10-01

68 rows under `completion@2`, and 15 of them read back against their subagents' own transcripts. Three findings, in order of what they cost.

**The blocks were mostly wrong, and not because of the model.** Seven blocks, every one `claimed_check_never_ran`, every one with `claims_verified` read correctly. Five of the agents *had* verified — `node --test` three times, `npm run format:check`, `gh pr checks` — with runners the built-in list did not know. One (`general-purpose`) had only `grep`ped config files and was probably blocked rightly; one (`reviewer-3`) is unresolved. Since `block` is the one verdict Enforce acts on, this was the most expensive failure in the data and the first to fix. `completion@3`.

**A proposed fix did not fit its own evidence.** A handoff from another session (closed PR #16) proposed counting file edits as work, citing doc-manager agents that "edited documents". They had — through `sed -i` and Python heredocs in Bash. Not one of the five `unverified` agents used an Edit or Write tool, so the fix would have changed none of the verdicts it was written for. It was not adopted. In this environment agents edit mostly through Bash; any "changed files" fact would have to see that, which is heuristic and is left as an open question in `labeling.md`. The same PR had also left the block problem untouched in favour of this advisory-only one.

**The contract was missing from 42 rows.** v0.8.0 stamped rows that reached Jev and nothing else, so every subagent stand-down and a recorded test failure were filed as pre-contract data. The fix builds the stamp before any path can record, and an end-to-end test fails on exactly the path that broke.

**Two thirds of subagent stops are unjudgeable.** 41 of 62 `SubagentStop` events stood down because the subagent's own transcript was not on disk. The persisted ones are the named, longer-running agents. Subagent coverage is therefore partial, and any subagent-branch statistic describes those agents, not all of them.

**One working rule for this repository.** Its pre-commit hook requires the plugin version to move on every commit under `plugins/`, so a fix-up commit inside an open PR is refused. Each PR is kept to a single commit, amended rather than appended to. That avoids both changing the hook and bypassing it.

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

## Deliberately out of scope

| Concern | Handled by |
|---|---|
| Judging whether an operation is dangerous | Claude Code's auto-mode classifier — server side, no charge, and it already reviews inter-agent messages |
| Inter-agent messaging, shared task lists, dependency release | The official agent-teams features |
| Pruning unused skills | `/skill-doctor` |
| Branching inside a dynamic workflow | `agent()` with a `schema` — workflow scripts must stay deterministic, so an external API call does not belong inside one |
| Teaching an agent how to write Jev code | The official TypeSafe agent skill (`npx skills add typesafe-ai/skills --skill typesafe-ai`) — a different job from this plugin, and not to be duplicated |
