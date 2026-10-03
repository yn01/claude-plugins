# Roadmap — not implemented yet

Candidate features, kept here so they are not lost. Nothing below is promised or scheduled.

**Adding an item:** give it a heading, 1–3 lines on *what* and *why*, and where obvious the seam in the code it would plug into. Move it to the README changelog when it ships.

## Commands

### Manual `/jev-dispatch:route`
Judge a prompt on demand and print the tier, action and reason, without waiting for the hook.
Seam: `decide()` in `lib/dispatch.mjs` takes no stdin and writes no journal, so a command can call it directly.

### `mode`, `status`, `doctor`
Show or write the mode and its source layer; print the action distribution, latency and token spend from the journal; send one real request and report the result. Same shape as the equivalent jev-gate commands.
Seam: `loadConfig()` already returns `sources`, the list of files that contributed.

## Execution

### External executors
Run a tier outside Claude Code: `claude -p --model`, Gemini CLI, Codex CLI. The `gemini` and `codex` tiers already exist in `config.json`, disabled.
Seam: `tiers.<name>.executor` (`"external"` is ignored by `candidateTiers()` in `lib/policy.mjs` today) and a runner next to `lib/advice.mjs`.

## Measurement

### Outcome recording and calibration report
Record how a routed task ended (completed, retried, escalated) and report whether Jev's tier beat the length heuristic.
Seam: `baselineTier` is already journaled on every row for this comparison.

### Stall and loop detection
A `PostToolUse` hook that notices an agent going in circles and recommends escalating to a stronger tier.
Seam: reuse `policy` tier ranks to pick the next step up.

## Policy

### Capability pre-filter
Drop tiers that cannot take the input before choosing one, for example when the prompt carries an image and a tier has no vision.
Seam: `candidateTiers()` in `lib/policy.mjs`, with a capability field on each tier.

### Allow and exclude lists, and a tier cap for prompt hints
Controls over which tiers may be used: only these tiers, never these tiers, nothing above this one. Subagent routing already has `spawn.maxTier`; this would extend a cap and the lists to the prompt hook.
Seam: `candidateTiers()` and a final clamp in `policy.decide()`.

### Per-project thresholds from labels
Choose `difficultyTiers` per project from about 100 labelled decisions, using a lower confidence bound rather than the point estimate.
Seam: the journal plus a labelling step; `policy.difficultyTiers` is already per-project configurable.

## Judge

### Transcript excerpt in the state
Give Jev a short excerpt of the recent conversation so `context_dependent` and difficulty are judged with more than the prompt.
Seam: `stateOf()` in `lib/contracts/route.mjs`; this would be a new contract version (`route@2`), not an edit of `route@1`.

### Judge backend swap
Run the same questions on another backend: OpenAI Decisions API, Clef, pydecide.
Seam: `ask()` in `lib/judge.mjs`; `decide()` already takes `ask` as a parameter.

## Implemented

Kept here so the history of what was once a candidate is not lost.

- **Choosing a subagent's model at launch** (v0.2.0) — a `PreToolUse` hook on the Agent tool, `spawn@1`, `decideSpawn()`; `spawn.respectExplicit` and `spawn.maxTier` cover the explicit-model and tier-cap questions for spawns.
