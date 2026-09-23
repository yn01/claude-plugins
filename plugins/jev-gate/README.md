# jev-gate

A stop-event gate for Claude Code. When an agent stops, jev-gate asks what kind of stop it is — *is this completion claim backed by an actual run?* and *did this pause really need you?* — and answers with [Jev](https://docs.typesafe.ai/introduction), TypeSafe's System One model, at roughly a hundredth of a cent per check.

```
/plugin install jev-gate
```

It ships in **Shadow Mode**: every verdict is recorded, nothing is ever blocked. Thresholds are meant to be chosen from that record, not guessed up front.

## The two stops worth catching

Anthropic's Opus 5.5 playbook names both failure modes, and they are not the same shape:

- **Completion without evidence.** The advice for subagent reports is "check its evidence before you accept it." An agent that says the tests pass without running them is the obvious case.
- **Pausing to report instead of going on.** The playbook describes it precisely: *"a summary that names the next step without taking it, an offer to continue, or a list of choices that don't block the work."* In long-running work this is the more common one — and a gate that only watches for false completion claims lets every bit of it through.

jev-gate checks for both on the same events, because both arrive as a stop.

## Why a separate judge

A generating model asked to grade its own output is doing two jobs with one set of weights. Jev does one job: it takes state and returns typed, calibrated probabilities — no prose, no tool calls, no way to return a value outside the schema. That makes it cheap enough to sit on every stop event, and narrow enough that the interesting logic stays in code where it can be read.

The division is strict:

- **Code decides facts.** Which commands ran, whether they exited non-zero, whether anything was edited or run since the user last spoke.
- **Jev decides meaning.** Whether a message claims completion; whether a log holds a real verification run; whether a pause is actually waiting on the user.
- **Code decides what happens.** Thresholds, block budgets, and the exit code are never the model's to choose.

## Features

- **Completion gate (hook)** — fires on `TaskCompleted`, `SubagentStop` and `Stop`. A verification run that failed and was never re-run is caught by code alone, without spending a request. Everything else goes to Jev as three independent yes/no questions in a single call.
- **Early-stop detection** — distinguishes a legitimate check-in from a task that stalled into a status report. Advisory by default; the playbook's own remedy for this is a CLAUDE.md rule, not a hard stop.
- **Shadow Mode by default** — every verdict exits 0 and lands in a JSONL journal alongside the probabilities that produced it.
- **Fail-open, without exception** — no API key, no network, a slow response, a malformed body, an unexpected exception: every one of those exits 0. A judge that is down never stops work.
- **Block budget** — a session can be sent back at most twice, then the gate stands down and the human decides.
- **One journal for every gate and every project** — because thresholds can only be set from a distribution, and a distribution split across projects is not one.

## Commands

| Command | Purpose |
|---|---|
| `/jev-gate:status [gate]` | Verdict distribution, probability histograms, latency percentiles and token spend — then a threshold recommendation drawn from the histogram, not from intuition. |
| `/jev-gate:mode [shadow\|enforce\|off]` | Show the resolved mode and its source layer, or write a new one to `.jev-gate/config.json`. Refuses to recommend Enforce on a thin journal. |
| `/jev-gate:doctor` | Print the resolved configuration and send one small real request. Reports latency, serving model and token usage. Never prints the key. |

## Setup

jev-gate needs an API key in the environment. It is read at hook time and never written to the journal or printed by any command.

```bash
export TYPESAFE_API_KEY=...    # in your shell profile, not in a config file
```

Without it the plugin installs and runs, but every event fails open — `/jev-gate:doctor` says so in as many words.

`TaskCompleted` additionally requires `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`. Without it that event never fires and only `SubagentStop` and `Stop` are live.

## How the gate decides

```
agent stops
  │
  ├─ code: walk the transcript for verification runs (test / build / lint / typecheck)
  │        latest run of any of them errored?  ──yes──▶  block         (no request sent)
  │        no final message at all?            ──yes──▶  pass
  ▼
  Jev: three nouls, one request
       claims_done      — the final message states the work is finished
       evidence_present — the command log holds output from a real run
       blocked_on_user  — the stop needs a decision only the user can give
  ▼
  code:  claims_done ≥ 0.5
           evidence_present ≥ 0.7  ──▶ pass
           evidence_present ≥ 0.3  ──▶ unclear
           otherwise               ──▶ block
         claims_done < 0.5
           work happened this turn, and blocked_on_user < 0.5
                                   ──▶ stopped_early
           otherwise               ──▶ pass
  ▼
  shadow  → record everything, exit 0
  enforce → pass: exit 0 · unclear: systemMessage · block: exit 2, budget 2
            stopped_early: systemMessage (exit 2 only if opted in)
```

`workThisTurn` — did the agent edit or run anything since the user last spoke — is what keeps an ordinary answered question out of the early-stop branch. A turn that changed nothing is a conversation, not a task that stalled. It is read from the transcript by code, never inferred.

All three questions are phrased **positively**. jev-1.13 reads negations at face value, so `evidence_present` is asked and the inversion is done in code — `evidence_missing` is exactly the shape to avoid. For the same reason the gate never asks whether the tests *passed*: counting and arithmetic are documented weaknesses, and the exit code is already sitting in the transcript.

When the hook event carries the task's own text, it goes into the state as `task`. The playbook's advice is to name the finish line per task — *"done means: every endpoint uses the new client, the old client is deleted, and the test suite passes"* — and evidence judged against that beats evidence judged against a generic notion of "some test ran".

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
      "thresholds": {
        "claimsDone": 0.5, "evidencePass": 0.7, "evidenceBlock": 0.3, "blockedOnUser": 0.5
      },
      "earlyStop": { "enabled": true, "action": "notify" },
      "verificationCommands": [],
      "maxBlocksPerSession": 2
    }
  }
}
```

`mode` is global; `gates.<name>.enabled` is per gate, so switching to Enforce never silently activates a gate that was never trialled.

**`verificationCommands`** takes regex sources matched against Bash commands, on top of the built-in list of common runners. A project with its own script needs this, or the gate reads a custom runner as an absence of evidence:

```json
{ "gates": { "completion": { "verificationCommands": ["\\./scripts/verify", "\\bbazel test\\b"] } } }
```

**`earlyStop.action`** is `"notify"` by default. Set it to `"block"` to have Enforce actually push the agent onward with exit 2 — worth doing only once the journal shows the detection is accurate on your work.

Environment overrides: `JEV_GATE_MODE`, `JEV_GATE_DISABLE=1` (everything off for one session), `JEV_GATE_JOURNAL`.

## What lands on disk, and what to commit

jev-gate writes outside your repository by default: the journal to `~/.claude/jev-gate/journal.jsonl` and a per-session block counter to `~/.claude/jev-gate/sessions/`. Nothing is created in a project unless you put it there.

The one thing you *do* create in a project is its config, and it is meant to be committed — thresholds, mode and `verificationCommands` are project policy, and a teammate who clones the repo should get the same gate you have:

```
.jev-gate/config.json     commit this
```

If you point `JEV_GATE_JOURNAL` at a path inside the repo, ignore it — a journal is a local record, not shared policy:

```gitignore
.jev-gate/*.jsonl
```

**What a journal entry contains.** Verdict, the probabilities and thresholds behind it, command count, latency, token usage, the session id and the `cwd`. Transcript text is *not* recorded — neither the agent's message nor command output. The single exception is the `recorded_failure` path, which stores the failing command verbatim so you can see what was being checked. If your verification commands carry secrets inline (`TOKEN=... npm test`), that string reaches the journal, so keep the journal out of the repo and out of anything you share.

## Getting to Enforce

1. **Shadow.** Install, set the key, work normally. Verdicts accumulate; nothing changes.
2. **Compare.** Run `/jev-gate:status`. Read the histograms and spot-check the entries whose verdict you would have decided differently. This step is the point of the whole design — thresholds chosen without it are guesses wearing a number.
3. **Enforce.** Set thresholds from the distribution, then `/jev-gate:mode enforce`.

## Relationship to the CLAUDE.md stop rule

The playbook's recommended rule is worth having regardless of this plugin:

> When a step doesn't need my input, keep going. Put status notes in the same message as your next action. Stop and ask only when you can't continue without me, or before anything destructive: deleting data, force-pushing, or changing anything outside this repository.

That rule is instruction; jev-gate is measurement. The rule tries to prevent the stop, the journal tells you how often it still happened. They are complements, and the gate never argues with the destructive-action half of the rule — it has no opinion on stops that are waiting for approval, which is exactly what `blocked_on_user` is there to recognise.

## What this plugin deliberately does not do

Danger classification belongs to Claude Code's auto-mode classifier; messaging and shared task lists to the official agent-teams features; skill pruning to `/skill-doctor`; workflow branching to `agent()` with a `schema`, since workflow scripts must stay deterministic and an external API call inside one would break re-runs.

Teaching an agent how to *write* Jev code is also a different job, already covered by the official TypeSafe agent skill (`npx skills add typesafe-ai/skills --skill typesafe-ai`). The two complement each other and are not meant to overlap.

## Roadmap

Further gates are specified in [`docs/implementation-plan.md`](docs/implementation-plan.md) and deliberately not built — each one waits for the gate before it to earn its thresholds:

- **Idle teammate** (`TeammateIdle`) — the team-shaped remainder of early-stop detection, now that the single-session case is handled here.
- **Task quality** (`TaskCreated`) — a task too broad or too vague to start.
- **Failure classification** (`PostToolUseFailure`) — transient vs. missing dependency vs. genuine defect, injected as context rather than as a block.
- **Approach advice** (`UserPromptSubmit`) — which execution vessel suits a request. Not a gate, and likely a separate plugin if it is built at all.

## Changelog

### v0.2.1

- Document what jev-gate writes to disk, which file belongs in version control (`.jev-gate/config.json`) and which does not, and exactly what a journal entry contains — including the one path that records a command verbatim.

### v0.2.0

- Add early-stop detection: a third noul (`blocked_on_user`) separates a legitimate check-in from a task that stalled into a status report. Advisory by default; `earlyStop.action: "block"` opts into exit 2.
- Add `verificationCommands` so a project's own runner is not mistaken for an absence of evidence — this was the known gap in v0.1.0.
- Include the task's own definition of done in the state when the hook event carries it.
- `/jev-gate:status` reports the `blocked_on_user` histogram over work turns only.

### v0.1.0

- Initial release. Completion gate on `TaskCompleted` / `SubagentStop` / `Stop`, Shadow Mode only. `/jev-gate:status`, `/jev-gate:mode`, `/jev-gate:doctor`. Implementation plan for gates 2–5.
