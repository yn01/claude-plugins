# jev-gate

An evidence gate for Claude Code. When an agent reports a task as finished, jev-gate asks one narrow question — *is there an actual verification run behind that claim?* — and answers it with [Jev](https://docs.typesafe.ai/introduction), TypeSafe's System One model, at roughly a hundredth of a cent per check.

```
/plugin install jev-gate
```

It ships in **Shadow Mode**: every verdict is recorded, nothing is ever blocked. Thresholds are meant to be chosen from that record, not guessed up front.

## Why a separate judge

A generating model asked to grade its own output is doing two jobs with one set of weights. Jev does one job: it takes state and returns typed, calibrated probabilities — no prose, no tool calls, no way to return a value outside the schema. That makes it cheap enough to sit on every stop event, and narrow enough that the interesting logic stays in code where it can be read.

The division is strict:

- **Code decides facts.** Which commands ran, whether they exited non-zero, what changed on disk.
- **Jev decides meaning.** Whether a message claims completion; whether a log contains a real verification run.
- **Code decides what happens.** Thresholds, block budgets, and the exit code are never the model's to choose.

## Features

- **Completion gate (hook)** — fires on `TaskCompleted`, `SubagentStop` and `Stop`. A verification run that failed and was never re-run is caught by code alone, without spending a request. Everything else is put to Jev as two independent yes/no questions in a single call.
- **Shadow Mode by default** — all three verdicts exit 0 and land in a JSONL journal alongside the probabilities that produced them.
- **Fail-open, without exception** — no API key, no network, a slow response, a malformed body, an unexpected exception: every one of those exits 0. A judge that is down never stops work.
- **Block budget** — a session can be sent back at most twice, then the gate stands down and the human decides.
- **One journal for every gate and every project** — because thresholds can only be set from a distribution, and a distribution split across projects is not one.

## Commands

| Command | Purpose |
|---|---|
| `/jev-gate:status [gate]` | Verdict distribution, `evidence_present` and `claims_done` histograms, latency percentiles and token spend — then a threshold recommendation drawn from the histogram, not from intuition. |
| `/jev-gate:mode [shadow\|enforce\|off]` | Show the resolved mode and its source layer, or write a new one to `.jev-gate/config.json`. Refuses to recommend Enforce on a thin journal. |
| `/jev-gate:doctor` | Print the resolved configuration and send one small real request. Reports latency, serving model and token usage. Never prints the key. |

## Setup

jev-gate needs an API key in the environment. It is read at hook time and never written to the journal or printed by any command.

```bash
export TYPESAFE_API_KEY=...    # in your shell profile, not in a config file
```

Without it the plugin installs and runs, but every event fails open — `/jev-gate:doctor` says so in as many words.

`TaskCompleted` additionally requires `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`. Without it that event never fires and only `SubagentStop` and `Stop` are live.

## How the completion gate decides

```
agent tries to stop
  │
  ├─ code: walk the transcript for verification runs (test / build / lint / typecheck)
  │        latest run of any of them errored?  ──yes──▶  block         (no request sent)
  │        no final message at all?            ──yes──▶  pass
  ▼
  Jev: two nouls, one request
       claims_done      — the final message states the work is finished
       evidence_present — the command log contains output from a real run
  ▼
  code: claims_done < 0.5  or  evidence_present ≥ 0.7  ──▶  pass
        evidence_present ≥ 0.3                         ──▶  unclear
        otherwise                                      ──▶  block
  ▼
  shadow  → record all three, exit 0
  enforce → pass: exit 0 · unclear: systemMessage · block: exit 2, budget 2
```

Both questions are phrased **positively**. jev-1.13 reads negations at face value, so `evidence_present` is asked and the inversion is done in code — `evidence_missing` is exactly the shape to avoid. For the same reason the gate never asks whether the tests *passed*: counting and arithmetic are documented weaknesses, and the exit code is already sitting in the transcript.

## Configuration

Layers, later winning: the plugin default → `~/.claude/jev-gate/config.json` → `<project>/.jev-gate/config.json` → environment.

```json
{
  "mode": "shadow",
  "model": "jev-1.13.0",
  "timeoutMs": 2000,
  "journal": "~/.claude/jev-gate/journal.jsonl",
  "gates": {
    "completion": {
      "enabled": true,
      "thresholds": { "claimsDone": 0.5, "evidencePass": 0.7, "evidenceBlock": 0.3 },
      "maxBlocksPerSession": 2
    }
  }
}
```

`mode` is global; `gates.<name>.enabled` is per gate, so switching to Enforce never silently activates a gate that was never trialled.

Environment overrides: `JEV_GATE_MODE`, `JEV_GATE_DISABLE=1` (everything off for one session), `JEV_GATE_JOURNAL`.

## Getting to Enforce

1. **Shadow.** Install, set the key, work normally. Verdicts accumulate; nothing changes.
2. **Compare.** Run `/jev-gate:status`. Read the `evidence_present` histogram and spot-check the entries whose verdict you would have decided differently. This step is the point of the whole design — thresholds chosen without it are guesses wearing a number.
3. **Enforce.** Set thresholds from the distribution, then `/jev-gate:mode enforce`.

## What this plugin deliberately does not do

Danger classification belongs to Claude Code's auto-mode classifier; messaging and shared task lists to the official agent-teams features; skill pruning to `/skill-doctor`; workflow branching to `agent()` with a `schema`, since workflow scripts must stay deterministic and an external API call inside one would break re-runs.

Teaching an agent how to *write* Jev code is also a different job, already covered by the official TypeSafe agent skill (`npx skills add typesafe-ai/skills --skill typesafe-ai`). The two complement each other and are not meant to overlap.

## Roadmap

Four further gates are specified in [`docs/implementation-plan.md`](docs/implementation-plan.md) and deliberately not built — each one waits for the gate before it to earn its thresholds:

- **Early-stop detection** (`TeammateIdle`) — a teammate goes idle with work outstanding.
- **Task quality** (`TaskCreated`) — a task too broad or too vague to start.
- **Failure classification** (`PostToolUseFailure`) — transient vs. missing dependency vs. genuine defect, injected as context rather than as a block.
- **Approach advice** (`UserPromptSubmit`) — which execution vessel suits a request. Not a gate, and likely a separate plugin if it is built at all.

Also planned for the completion gate itself: a project-configurable list of verification commands, so a custom runner is not mistaken for an absence of evidence.

## Changelog

### v0.1.0

- Initial release. Completion gate on `TaskCompleted` / `SubagentStop` / `Stop`, Shadow Mode only. `/jev-gate:status`, `/jev-gate:mode`, `/jev-gate:doctor`. Implementation plan for gates 2–5.
