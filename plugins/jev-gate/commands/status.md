---
description: Read the jev-gate verdict journal — verdict distribution, probability histograms, latency and cost — and propose thresholds
allowed-tools: Bash, Read
argument-hint: "[gate-name]"
---
# /jev-gate:status

Read back what Shadow Mode has recorded. This is the command that turns a pile of JSONL into a threshold decision.

**Usage:**
- `/jev-gate:status` — all gates
- `/jev-gate:status completion` — one gate only

---

## Steps

### 1. Print the summary

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/stats.mjs" $ARGUMENTS
```

If it reports no journal, say so plainly and stop — there is nothing to tune yet.

### 2. Read the histograms, not the verdicts

The verdict counts reflect the *current* thresholds, so they cannot justify those thresholds. The histograms can.

`blocked_on_user` is shown over work turns only — turns where the agent edited or ran something since the user last spoke. Conversational turns are excluded because they would swamp the distribution without saying anything about stalled tasks.

Look for:

- **A clear gap.** If the values cluster near 0.0 and near 1.0 with little in between, the model is confident and the thresholds can sit close together.
- **A crowded middle.** If a large share lands in 0.3–0.7, the question is not discriminating. Prefer widening the unclear band over tightening the block threshold.
- **Fail-open rate.** A high `timeout` count means `timeoutMs` is too tight for the network in question. A high `no_api_key` count means the gate has never actually run.
- **`stopped_early` frequency.** A steady trickle is the signal this gate exists for. A flood usually means the CLAUDE.md stop rule is missing from the project rather than that the threshold is wrong — check for the rule before touching `blockedOnUser`.

### 3. Spot-check the disagreements

Pick two or three entries whose verdict you would have decided differently and read them:

```bash
grep '"verdict":"block"' "$(node -e 'import("'"${CLAUDE_PLUGIN_ROOT}"'/lib/config.mjs").then(m=>console.log(m.loadConfig().journalPath))')" | tail -5
```

The point of Shadow Mode is this comparison. Thresholds chosen without it are guesses.

### 4. Recommend, do not apply

State a recommended `thresholds` block and explain which part of the histogram it comes from. Ask before writing it to `.jev-gate/config.json` — switching a gate's behaviour is the user's call.
