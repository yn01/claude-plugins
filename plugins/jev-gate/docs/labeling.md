# jev-gate — labelling verdicts

**Status: specification only. Nothing here is built.**

The threshold recipe in [`implementation-plan.md`](implementation-plan.md) sets a threshold from a **lower confidence bound over about 100 local labels, per branch and per project**. `/jev-gate:status` can count rows per branch but cannot tell a right verdict from a wrong one. Labels are that missing input, and without them Shadow cannot become Enforce. This document fixes their shape before anyone starts labelling by hand.

The split between *question truth* and *verdict correctness* below, and the row-identity scheme, were first proposed in the closed PR #16. They are adopted here because the data since has shown why they are needed.

---

## 1. What a label records

A verdict mixes two things: a probability Jev returned, and facts code held. Only the first can be tuned with a threshold. A label therefore records both, separately:

| field | values | answers | feeds |
|---|---|---|---|
| `questionTruth` | `true` / `false` / `null` | Is the **deciding question** true of this message? | threshold setting |
| `verdict` | `correct` / `incorrect` / `unsure` | Was the verdict right? | error rate per branch |
| `expected` | a verdict name, or `null` | When `incorrect`, what it should have been | which way a branch errs |

**Why both are needed — the case that proved it.** Under `completion@2`, five `jev-gate-dev`, reviewer and release-manager subagents were blocked for claiming a check that never ran. Each one *had* run a check — `node --test`, `npm run format:check`, `gh pr checks` — that the gate did not recognise. For every one of them `claims_verified` read the message correctly: `questionTruth: true`. The verdict was still wrong: `verdict: incorrect`, `expected: pass`. The fault was in how facts were collected, not in the model or its threshold. A single right/wrong label would have pushed the `claims_verified` threshold up to "fix" a problem the threshold had nothing to do with.

What `questionTruth` asks, per deciding branch:

| `deciding` | `questionTruth` answers |
|---|---|
| `claims_verified` | Does the message state that a test, build, lint or type-check ran and passed? |
| `claims_done` | Does the message announce a finished action? |
| `blocked_on_user` | Does the stop need a decision or information only the user can give? |
| `null` | not labelled — no answer decided the row |

A `low_confidence:*` row (`unclear`) is labelled like the branch its reason names. Those rows are the evidence for or against `minConfidence`.

**Labels transfer across contracts when the question did not change.** `completion@3` changed which commands count as verification; it did not change any question. A `questionTruth` label given to an `@2` row is therefore valid evidence for the same question under `@3`. A `verdict` label is not — the routing differs. Stats must honour that distinction.

Only rows with `decidedBy: "jev"` are offered. Code-decided rows, fail-open rows and `skip` rows have no probability behind them.

## 2. Storage

**A separate file, never the journal.** The journal is append-only and written by hooks running concurrently; rewriting it to add a field would race them. Labels live beside it:

```
<plugin data dir>/labels.jsonl
```

Also append-only. Relabelling appends a new line and **the last line for a row id wins**, so a mistaken label is corrected rather than lost.

```json
{
  "ts": "2026-10-02T09:14:03.120Z",
  "row": "h_4f0c9a1e2b7d4e55",
  "contract": "completion@2",
  "deciding": "claims_verified",
  "reason": "claimed_check_never_ran",
  "p": 0.96,
  "questionTruth": true,
  "verdict": "incorrect",
  "expected": "pass",
  "note": "ran node --test; not in the verification list under @2"
}
```

`contract`, `deciding`, `reason` and `p` are copied from the row at labelling time. That is deliberate redundancy: stats can check them against the journal and discard a label whose row no longer matches, and the label file can be read on its own.

### Row identity

Journal rows carry no id today. Rows are identified as `"h_"` + the first 16 hex characters of `sha256(the exact journal line)`. The journal is append-only, so a line never changes and its hash is stable; a row later rewritten by hand loses its labels, which is the right outcome.

`ts` + `session` was considered and rejected: `Stop` and `SubagentStop` fire within the same millisecond in one session, and the journal already holds such pairs.

## 3. Privacy

**The label file never holds message text.** No `final_message`, no command output, no file path beyond what the journal row already carries. The optional `note` is the labeller's own words.

Labelling does require *reading* the message, which the journal does not store — it is fetched from the session transcript at labelling time and shown, never written. A row whose transcript has been cleaned up (Claude Code's `cleanupPeriodDays`) cannot be labelled and is skipped.

## 4. How labels are given

A `/jev-gate:label` command backed by `scripts/label.mjs`, in the shape of `/jev-gate:status`:

```
/jev-gate:label                        next 10 unlabelled rows under the current contract
/jev-gate:label claims_verified 20     one branch only
/jev-gate:label --project              rows from this project only
/jev-gate:label --row h_4f0c…          one row again
```

For each row it shows the verdict, the deciding question, its probability and confidence, the recorded facts (`commandCount`, `workThisTurn`, `factsSource`), and the message fetched from the transcript. It asks the three fields in order, `questionTruth` first, and appends one line.

**Blocks first.** Rows are offered in the order *block → unclear → stopped_early → unverified → pass*. A block is the only verdict Enforce acts on; its error rate matters most and should be known first.

## 5. What stats reports

Per contract, and per deciding branch:

```
claims_verified   labelled 23 / 100    questionTruth agrees with p≥0.5: 21/22   verdict errors: 5 of 23
```

- **Label count** against the ~100 the recipe needs.
- **Question accuracy** — how often the probability agrees with `questionTruth`. This is what a threshold can change.
- **Verdict error rate** — how often the verdict was wrong for any reason. When this is high while question accuracy is also high, the fault is in the facts or the routing, not the threshold. That was the whole of the @2 block problem.

At **100 labels on a branch**, stats recommends a threshold chosen by the **lower confidence bound** of question accuracy, not the point estimate — the paper reports this cuts the risk of losing more than two points from about 45% to about 5%. It recommends; it never writes config.

## 6. First candidates

Fifteen `completion@2` rows were read back against their transcripts during the @3 investigation. They are candidates, **not** labels — and not all of them are errors:

| rows | verdict | finding |
|---|---|---|
| 5 | block | **Errors.** Checks were run (`node --test` ×3, `npm run format:check`, `gh pr checks`) and not recognised. Fixed in @3. |
| 1 | block | **Probably correct.** A `general-purpose` agent claimed a formatting check passed after only `grep`ing config files. |
| 1 | block | **Unresolved.** `reviewer-3`: the handoff says it ran `node --test`; its own transcript shows no verification command. Needs a human look. |
| 5 | unverified | Advisory. `Plan`, `general-purpose` ×2, `doc-manager` ×2 — none used an Edit or Write tool; the doc-managers edited through `sed -i` and Python heredocs in Bash. |
| 3 | stopped_early | Advisory. Main-session reports while background subagents ran. |

The first two rows of that table are the reason this document separates `questionTruth` from `verdict`: all seven blocks had `claims_verified` read correctly, yet five verdicts were wrong and at least one was right.

## 7. Open questions

- **Who labels.** Only the user, or may a stronger model propose labels for the user to confirm? The paper's escalation pattern suggests the latter, but a model-proposed label is not independent evidence and would have to be marked as such.
- **Per-project thresholds.** The recipe says one threshold per workload. `simple-diary` is orchestration-heavy; `bakumatsu-fantasy` was not. Are 100 labels needed per project, or can projects share until they visibly diverge?
- **Skipped rows.** `excludeAgentTypes` rows are never judged, so an exclusion that is wrong is invisible. Should a sample of skips be offered for audit?
- **Stale transcripts.** Rows whose transcript has been cleaned up cannot be labelled. Is that acceptable, or should labelling happen within a window?
- **Bash-edits.** Should "the agent changed files" be a recorded fact, given that in this environment agents edit mostly through Bash rather than Edit/Write tools? It would bear on `unverified`, which is advisory only.
