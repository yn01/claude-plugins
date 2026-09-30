# jev-gate — labelling verdicts (specification, not built)

**Status:** proposed in v0.9.0. Nothing here is implemented. It exists so that the step between Shadow and Enforce — *compare against human judgement, then set a threshold* — has a defined shape before anyone starts labelling by hand in a spreadsheet.

Why it is needed: the threshold recipe in [`implementation-plan.md`](implementation-plan.md#the-threshold-recipe-8) sets a threshold from a **lower confidence bound over about 100 local labels, per branch and per project**. `/jev-gate:status` can count rows per branch; it cannot tell a right verdict from a wrong one. Labels are that missing input.

---

## 1. What is labelled

One label refers to **one journal row that carries a verdict decided by Jev** (`decidedBy: "jev"`). Rows decided by code (`recorded_failure`, `subagent_*`), fail-open rows and `skip` rows have no probability behind them and cannot inform a threshold, so they are not offered for labelling. (Skip rows may be audited separately — see *open questions*.)

A verdict mixes two things: a probability Jev returned, and facts code held. Only the first is tunable. So a label records both:

| field | meaning | used for |
|---|---|---|
| `questionTruth` | Is the **deciding question** true of this message? `true` / `false` / `null` (cannot tell) | threshold setting — compared with the deciding probability |
| `verdict` | Was the verdict right? `correct` / `incorrect` / `unsure` | error rate per branch, spot-check |
| `expected` | When `incorrect`: the verdict the labeller would have given (`pass`, `block`, `unverified`, `stopped_early`, `unclear`) | seeing *which way* a branch errs |

`questionTruth` is the one the recipe needs. A `claims_verified` row is labelled on whether the message **asserts a check passed**, not on whether the block was fair; a `blocked_on_user` row on whether the stop **needed the user**. A verdict can be wrong while the question was answered correctly — `completion@2`'s doc-manager rows were exactly that: `claims_done` read the message correctly and the routing was wrong. Separating the two keeps a routing fault from being "fixed" by moving a threshold.

What `questionTruth` means per branch (`deciding`):

| `deciding` | reasons it covers | `questionTruth` answers |
|---|---|---|
| `claims_verified` | `claimed_check_never_ran` | Does the message state that a test, build, lint or type-check ran and passed? |
| `claims_done` | `claimed_done_nothing_ran`, `claim_backed_by_edits`, `claim_backed_by_a_run` | Does the message announce a finished action? |
| `blocked_on_user` | `waiting_on_someone`, `paused_to_report` | Does the stop need a decision or information only the user can give? |
| `null` | `no_claim_no_work` | not labelled — no answer decided it |

A `low_confidence:*` row (`unclear`) is labelled like the branch its reason names. Those rows matter: they are the evidence for or against `minConfidence`.

## 2. Storage

**A separate file, never the journal.** The journal is append-only and written by hooks running concurrently; rewriting it to add a field would race with them and break rule 17's "one journal" guarantee. Labels live beside it:

```
<plugin data dir>/labels.jsonl      e.g. ~/.claude/plugins/data/jev-gate-<marketplace>/labels.jsonl
```

Append-only as well. Relabelling appends a new line; **the last line for a row id wins**. Nothing is ever edited in place, so a mistaken label is corrected, not lost.

One line:

```json
{
  "ts": "2026-10-02T09:14:03.120Z",
  "row": "r_4f0c9a1e2b7d4e55",
  "contract": "completion@3",
  "deciding": "claims_done",
  "reason": "claim_backed_by_edits",
  "p": 0.97,
  "questionTruth": true,
  "verdict": "correct",
  "expected": null,
  "by": "human"
}
```

`contract`, `deciding`, `reason` and `p` are copied from the row at labelling time. They are redundant on purpose: stats can check them against the journal and refuse a label whose row no longer matches (a hash collision, a hand-edited journal), and a label file can be read on its own.

### Row identity

Journal rows carry no id today. Two parts:

- **From the release that builds this:** `record()` adds `id: "r_" + 16 hex chars` from `crypto.randomBytes`, generated at write time. Random rather than derived, so two events in the same millisecond never share one.
- **Rows written before that:** identified as `"h_" + sha256(the exact journal line)` truncated to 16 hex. The journal is append-only, so the line never changes and the hash is stable. A row that is later rewritten (by hand) loses its labels, which is the correct outcome.

`ts` + `session` was considered and rejected: `Stop` and `SubagentStop` can fire within the same millisecond in one session.

## 3. How labels are given — `/jev-gate:label`

A command plus a script (`scripts/label.mjs`), in the shape of `/jev-gate:status`:

```
/jev-gate:label                       next 10 unlabelled rows under the current contract
/jev-gate:label claims_verified 20    only that branch
/jev-gate:label --project             only rows whose cwd is this project
/jev-gate:label --relabel r_4f0c…     show one row again
```

For each row the command shows the verdict, reason, deciding question, its probability and confidence, the facts (`commandCount`, `editCount`, `workThisTurn`), and **the message itself, read from the transcript at that moment** — then asks the two questions (`questionTruth`, then `verdict`, then `expected` if incorrect) with `AskUserQuestion`, and appends one line.

**Where the message comes from.** The journal deliberately does not store it (see *privacy*), so the command re-reads it. That needs the row to say where to look, so this release would also record, per row:

- `transcriptPath` — the path the facts were read from (the subagent's own file on `SubagentStop`). A path, not content.
- `msgHash` — `sha256(final_message)` truncated to 16 hex, as sent to Jev.

The labeller hashes the message it finds and shows it only if the hash matches. A transcript that has been cleaned up, or a message that no longer matches, makes the row **unlabellable**: it is skipped and never guessed at. The label is not given on a message the judge did not see.

**Which rows are offered.** Not simply the newest: a branch's error rate estimated from whatever happened to be recent is biased toward whatever the user was doing that week. The default is a **uniform random sample of unlabelled rows per branch**, seeded and printed so a session can be resumed. Rows near the threshold are over-represented only in an explicit `--near` mode, and labels given that way are marked `"sample": "near"` and kept out of the error-rate estimate (they are still valid for threshold search, which conditions on `p`).

## 4. What stats does with them

`/jev-gate:status` gains a labels section, **per contract, per branch**, never pooled across either (rule 11):

```
--- labels (completion@3) ---
  branch            labelled   question wrong   verdict wrong   error rate (95% CI)
  claims_verified      12           1                1           8%  (1–35%)
  claims_done          41           2                5          12%  (5–26%)
  blocked_on_user      23           4                4          17%  (7–37%)
  unlabellable: 3 (transcript gone or message changed)
```

Error rate is `verdict: incorrect / (correct + incorrect)`; `unsure` is counted but excluded. The interval is Wilson, which behaves at small n and at rates near zero where the normal approximation does not.

### Recommending a threshold (the §8 recipe)

Run only for a branch with **≥ 100 labels whose `questionTruth` is not null**, under the current contract. Below that, stats prints the count and says nothing else — a threshold from 30 labels is the risk the recipe exists to avoid.

1. Take the branch's labelled rows: pairs `(p, questionTruth)`.
2. For each candidate `t` in 0.05 … 0.95 by 0.05, classify `p ≥ t` as yes and compute accuracy against `questionTruth`, with its **Wilson lower bound at 95%**.
3. Recommend the `t` with the **highest lower bound**, not the highest accuracy. Ties go to the `t` nearest the current setting, so a threshold is not moved for no gain.
4. Do the same for `minConfidence`: for each candidate `c`, the accuracy of rows with confidence `≥ c`, its lower bound, and how many rows it would turn into `unclear`. Report the trade-off; do not pick one automatically.
5. **Per project first.** If one `cwd` alone has ≥ 100 labels in the branch, recommend for it and say it belongs in that project's `.jev-gate/config.json`. Otherwise recommend a global value and say that it is pooled. The paper's result is that a per-workload threshold cuts the risk of losing two points from ~5% to under 1%.
6. **Recommend, never apply.** As with `/jev-gate:status` today, writing a threshold is the user's call.

A threshold belongs to one question wording and one output type (§7.3). Changing either starts a new contract, and its labels start from zero — `@2` labels are shown under `@2`, never carried forward.

## 5. Privacy

- **The label file holds no transcript content.** No message text, no command output, no file names from the session. It holds ids, the copied numeric fields, and the labeller's answers.
- **There is no free-text field.** A `note` was considered and left out: it is exactly where someone pastes the sentence they are labelling. If one is added later, the command must say so at the prompt.
- **Messages are displayed, not copied.** `/jev-gate:label` reads the transcript into the terminal for the moment of labelling and writes nothing of it anywhere.
- **The journal gains a path and a hash, not text.** `transcriptPath` reveals a directory layout (it contains the project path, as `cwd` already does); `msgHash` is a one-way digest of text already on the same disk.
- **Labels stay in the plugin data directory.** Not in the project, not committed. They describe the user's own sessions. The `.gitignore` guidance in the README extends to `labels.jsonl` for anyone who points the journal into a repo.

## 6. Open questions

- **Label unit.** Is one `questionTruth` per row enough, or should the non-deciding questions be labelled too? Labelling all three would fill the rarely-deciding branches (`claims_verified` has decided 1 row so far) from rows where they were asked but did not decide — but rule 15 warns that such rows flatter the sample. Current proposal: deciding question only; revisit if a branch cannot reach 100 in reasonable time.
- **Replaying old rows under a new contract.** `decide()` is pure, so an `@2` row plus its probabilities could be replayed as `@3` — except `@2` rows carry no `editCount`, which `@3` routes on. Replay is possible only for rows whose missing facts cannot change the route. Worth building only if a contract change strands a large labelled set.
- **Auditing skips.** `excludeAgentTypes` removes rows before they are judged, so a wrongly excluded role would never be seen. Should `/jev-gate:label --skips` show a sample of skipped events and ask "should this have been judged"? Useful, but it labels a config choice, not a probability, and belongs in its own file if built.
- **More than one labeller.** `by` is `"human"` today. If teammates label the same journal, agreement between them is the ceiling on any threshold's accuracy and should be reported; that needs an identity in `by`, which touches privacy.
- **`unsure` rate as a signal.** A branch where the labeller is often unsure is a branch whose question is ambiguous to a human too. Whether to surface that as a warning, and at what rate, is undecided.
- **Confidence level.** 95% is the default in the recipe's spirit; the paper does not fix one. Whether to expose it as a setting is open.
- **Transcript retention.** Labelling depends on transcripts still being on disk. If Claude Code prunes them on a schedule, labelling has to keep up or rows become unlabellable; how long they last has not been measured.
