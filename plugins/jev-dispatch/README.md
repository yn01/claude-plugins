# jev-dispatch

A model router for Claude Code. On every prompt, [Jev](https://docs.typesafe.ai/introduction) (TypeSafe's System One model) reads the *properties of the task* — what kind of work it is, how hard, how much a stronger model would help, whether it only makes sense with the earlier conversation — and code turns those properties into a recommendation: hand this to a lighter subagent, or consult a stronger one while you keep working. It can also choose the model of each subagent the main agent launches, rewriting the call's `model` to match how hard the brief is.

It runs entirely inside Claude Code: the "models" are subagents (`haiku`, `sonnet`, `opus`) and the hint is injected into the main agent's context.

```
/plugin install jev-dispatch
```

## Shadow mode by default

**After install, nothing visible happens. That is intended.**

jev-dispatch ships in `shadow` mode: it judges every non-skipped prompt and writes one row to a journal, but it injects **nothing** into the conversation. The router's thresholds are meant to be tuned from a record of what it *would* have recommended, not guessed up front.

Inspect what it decided:

```bash
# the path is <plugin data dir>/journal.jsonl; usually:
J=$(ls -d ~/.claude/plugins/data/jev-dispatch-*/ | head -1)journal.jsonl

# last 10 decisions: when, what the session ran on, tier, action, why, and the prompt
tail -n 10 "$J" | jq -c '{ts, sessionModel, tier, baselineTier, action, reason, promptHead}'

# how often each action and reason occurs
jq -r '[.action, .reason] | @tsv' "$J" | sort | uniq -c | sort -rn
```

To make it act, switch to `advise`:

```bash
# per project
mkdir -p .jev-dispatch && echo '{"mode":"advise"}' > .jev-dispatch/config.json

# or per shell / per session
export JEV_DISPATCH_MODE=advise
```

| Mode | Judges and journals | Injects a hint |
|---|---|---|
| `shadow` (default) | yes | never |
| `advise` | yes | when the action is `delegate` or `consult` |
| `off` | no — exits immediately | never |

Any other value (a typo, say) is not rejected: it behaves like `shadow`.

## Subagent routing

The prompt hook can only *hint*. The place where a model is actually chosen is the moment the main agent launches a subagent, so a second hook, on the `Agent` tool (`PreToolUse`), judges the brief the main agent wrote and picks the model the subagent runs on.

```
Agent tool call {description, prompt, subagent_type, model?, ...}
  ├─ spawn.mode off?                                    ──▶ exit
  ├─ subagent_type (default general-purpose) not in
  │  spawn.subagentTypes                                ──▶ journal "not_targeted", exit
  ├─ spawn.respectExplicit and a model was given        ──▶ journal "explicit_respected", exit
  ▼
  Jev: spawn@1 — task_kind, difficulty, stronger_gain  (about the brief)
  ▼
  code: spawn.difficultyTiers (and spawn.gainBump, off by default), with the
        prompt hook's per-kind floor ─▶ tier ─▶ capped at spawn.maxTier ─▶ that tier's model
        compared by rank with the model the call asked for
        (or, if it named none, the session's model: "inherit")
  ▼
  same rank ─▶ keep    different ─▶ route up | down    difficulty unreadable ─▶ unclear (untouched)
  ▼
  journal row (hook "spawn") ─▶ apply mode only: updatedInput with `model` replaced
```

Start in `shadow`, the default: every launch is judged and journaled with the model it *would* have been routed to, and nothing is changed. Read the rows, then switch on `apply`:

```bash
# per project (a separate switch from the prompt hook's mode)
mkdir -p .jev-dispatch && echo '{"spawn":{"mode":"apply"}}' > .jev-dispatch/config.json

# or per shell / per session
export JEV_DISPATCH_SPAWN_MODE=apply

# what would have been rewritten
jq -c 'select(.hook=="spawn" and .action=="route") | {requestedModel, routedModel, direction, reason, descriptionHead}' "$J"
```

| `spawn.mode` | Judges and journals | Rewrites `model` |
|---|---|---|
| `shadow` (default) | yes | never |
| `apply` | yes | when the action is `route` |
| `off` | no | never |

Any other value behaves like `shadow`.

What is rewritten, exactly:

- **Only `model`.** The hook returns the full original tool input with that one field replaced (the output replaces the input, so nothing else may be dropped), plus a one-line notice for the main agent such as `[jev-dispatch] routed this subagent to haiku (docs, difficulty 0.4).` It never returns a permission decision; approvals work as they always did.
- **Up and down.** A brief harder than the requested model gets a stronger one; an easier brief gets a lighter one. `opus` and `fable` share a rank, so nothing is rewritten between them.
- **Effort is not touched.** The Agent call has no per-call effort; it comes from the agent's definition.
- **Briefs are self-contained**, so `context_dependent` is not asked, and a brief that is a question is routed on difficulty like any other.
- **Nothing is rewritten when a model cannot be ranked:** the requested model, or the inherited session model, matches nothing in `sessionModelRank` (`unknown_model`). Inside a subagent, an omitted `model` inherits the *subagent's* model, which is not known to the hook, so only an explicit `model` is compared there.

| Key | Default | Meaning |
|---|---|---|
| `spawn.mode` | `"shadow"` | `shadow`, `apply` or `off`. Overridden by `JEV_DISPATCH_SPAWN_MODE`. Independent of `mode`. |
| `spawn.subagentTypes` | `["general-purpose"]` | `subagent_type` values that are routed. A missing `subagent_type` counts as `general-purpose`. Others are journaled as `not_targeted`, with their name. |
| `spawn.difficultyTiers` | `<1.2` light, `<3.3` standard, else deep | Threshold table for spawns only. If the key is absent, `policy.difficultyTiers` is used. |
| `spawn.gainBump` | `null` | `stronger_gain` at or above this lifts a spawn's tier one step; `null` means no bump for spawns. If the key is absent, `policy.gainBump` is used. `policy.minConfidence` and `policy.minTierByKind` stay shared. |
| `spawn.respectExplicit` | `false` | When `true`, a call that names a `model` is left as asked. By default Jev's judgement overrides an explicit model. |
| `spawn.maxTier` | `"deep"` | The highest tier a spawn may be routed to. A capped decision carries `:capped` on its `reason`. |
| `spawn._knownSubagentTypes` | a list of names | **Reference only; the code never reads it.** JSON has no comments, so this is where example names live. Real names are in the journal: `jq -r 'select(.reason=="not_targeted") | .subagentType' "$J" | sort | uniq -c`. Copy the ones you want into `spawn.subagentTypes`. |

### Why spawn has its own thresholds

A brief written by the main agent is detailed, and Jev reads detail as difficulty: in real use briefs cluster around difficulty 3 and `stronger_gain` 1.5–1.9, almost regardless of the task. With the prompt table (deep from 2.6) and the gain bump, most spawns would be sent to the deep tier. So spawns use a higher table (deep from 3.3) and no gain bump, and reach the deep tier only when the judgement leans towards "very hard". `stronger_gain` is still recorded in `signals` and `answers`, so the choice can be revisited from the journal. Set `spawn.difficultyTiers` and `spawn.gainBump` to different values, or delete the keys to share the prompt thresholds.

## Features

- **Task-property judging** — one Jev request per prompt asks four questions: `task_kind`, `difficulty`, `stronger_gain`, `context_dependent`.
- **Code owns the decision** — thresholds, tiers, and what to do about the session's own model are config and pure functions, never the judge's to choose. Jev is never told a model name.
- **Delegate down, consult up** — a lighter tier takes self-contained work; a heavier tier is consulted as an advisor while the main agent keeps the task.
- **Shadow mode by default** — every decision is journaled with the raw probabilities and a length-heuristic baseline, so Jev can later be compared against the trivial rule.
- **Subagent routing** — a hook on the Agent tool judges each subagent's brief and, in apply mode, rewrites its `model` up or down, capped by `spawn.maxTier`.
- **Fail-open, without exception** — no API key, no network, a slow answer, bad JSON, a config typo, a thrown error: every one exits 0 and the prompt goes through untouched.
- **Layered configuration** — plugin default, per user, per project, environment.
- **Extensible tiers** — change a tier's model in config, point it at your own agent, or add a tier.

## Installation

```
/plugin marketplace add yn01/claude-plugins
/plugin install jev-dispatch
```

jev-dispatch needs an API key in the environment. It is read at hook time and never written to the journal.

```bash
export TYPESAFE_API_KEY=...    # in your shell profile, not in a config file
```

Without it the plugin installs and runs, but every judgement fails open and is journaled as `judge_unavailable` with `error: "no_api_key"`.

## How it works

```
UserPromptSubmit  {prompt, session_id, cwd, transcript_path, model?}
  │
  ├─ mode off?                                         ──▶ exit
  ├─ session model: payload `model` ▸ transcript ▸ SessionStart cache
  ├─ code: skip rules (empty, machine-generated message,
  │        "/command", too short, stock replies like
  │        "yes" / "ok" / "lgtm")                      ──▶ journal "skip:*", exit
  ▼
  Jev: route@1 — four questions, one request
       task_kind         implement | bugfix | refactor | investigate | design | docs | question
       difficulty        0–4  (trivial … very hard)
       stronger_gain     0–2  (none … large)
       context_dependent noul — needs the earlier conversation?
  ▼
  code (policy):
       task_kind read confidently as question      ──▶ none
       difficulty read below minConfidence         ──▶ none (unclear)
       (task_kind read below its threshold: treated as unknown — the
        question rule and the per-kind floor are skipped, routing goes on)
       difficulty ─▶ tier  (thresholds)
       stronger_gain ≥ gainBump  ─▶ one tier up
       per-kind floor (e.g. design ≥ standard)
       compare tier rank with the session model's rank
  ▼
  journal row  ──▶  advise mode only: additionalContext hint
```

| Judged tier vs. session model | Condition | Action | Reason |
|---|---|---|---|
| lighter | self-contained | **delegate** to the lighter subagent | `lighter` |
| lighter | depends on earlier conversation | none | `context_dependent` |
| heavier | — | **consult** the deep tier while the main agent keeps working | `heavier` |
| same | — | none | `same_tier` |
| — | `task_kind` is `question` | none | `question` |

A prompt that leans on earlier context is never delegated: a subagent sees only its brief, not the conversation, and would be handed a request it cannot read. A `context_dependent` answer that is missing entirely counts as dependent — the cautious side.

**Consult** is the advisor pattern. The main agent keeps the task and the editing; it asks a stronger, read-only model for its plan before starting and for a review before declaring completion. **Delegate** hands the whole task to a cheaper worker, and the hint reminds the main agent to verify what comes back.

Every other outcome is `none` with a reason recorded: `unclear` (the difficulty was read below `minConfidence.difficulty`; a low-confidence `task_kind` does not cause this, see `kindUsed`), `unknown_session_model` (no session model could be found, or it matches nothing in `sessionModelRank`; see [Session model](#session-model)), `no_tier` (no enabled subagent tier), `judge_unavailable` (the request failed), or `skip:empty` / `skip:system_message` / `skip:slash_command` / `skip:too_short` / `skip:pattern`.

### The hint

In `advise` mode, a `delegate` or `consult` action adds one short English paragraph to the prompt's context. It names the subagent *and* the model, because the model is a per-call `model` override on the Agent tool, while effort lives in the agent's own definition. It is context, not an order — the main agent may disagree.

## Tiers

| Tier | Agent | Model | Effort | Role |
|---|---|---|---|---|
| `light` | `jev-dispatch:light` | haiku | low | Worker for small, self-contained tasks |
| `standard` | `jev-dispatch:standard` | sonnet | medium | Worker for well-specified, moderate tasks |
| `deep` | `jev-dispatch:deep` | opus | high | **Consultant** for planning and review; has no Edit or Write tool, by design |

- **Change a tier's model** in config (`tiers.<name>.model`). The hint tells the main agent to pass it as the Agent tool's `model` override. An empty `model` omits the override.
- **Change effort** by editing the `effort:` line in `agents/<tier>.md`, or add a new tier pointing at a new agent file. Effort is a property of the agent definition, not of the call.
- **Use your own agent** by setting `tiers.<name>.agent` to any agent name, such as one from `~/.claude/agents/`.
- **Add a tier** by adding an entry with a unique `rank`, `executor: "subagent"`, and `agent`.
- `gemini` and `codex` entries are placeholders (`enabled: false`). `executor: "external"` is not implemented yet: policy ignores any tier that is disabled or not a subagent.

The session model's rank comes from `sessionModelRank` by case-insensitive substring match on the model name (`haiku`=1, `sonnet`=2, `opus`=3, `fable`=3).

## Configuration

Layers, later wins. Each is merged key by key; an unreadable or malformed file is skipped silently.

1. Plugin default — `config.json` in the plugin
2. Per user — `<data dir>/config.json`
3. Per project — `<project>/.jev-dispatch/config.json`
4. Environment — `JEV_DISPATCH_MODE`, `JEV_DISPATCH_SPAWN_MODE`

The data dir is `CLAUDE_PLUGIN_DATA` if set, else the first `~/.claude/plugins/data/jev-dispatch-*` directory, else `~/.claude/jev-dispatch/`.

A project config written to the wrong place is ignored silently; to confirm a setting took effect, check that your file exists at exactly `<project>/.jev-dispatch/config.json` (the project is the session's `cwd`).

| Key | Default | Meaning |
|---|---|---|
| `mode` | `"shadow"` | `shadow`, `advise` or `off`. |
| `model` | `"jev-1.13.0"` | Jev model sent to the endpoint. |
| `endpoint` | `https://api.typesafe.ai/v1/systemone` | Judge endpoint. |
| `timeoutMs` | `3000` | Abort the Jev request after this long; the prompt then passes untouched. |
| `maxPromptChars` | `4000` | Prompt characters sent to Jev. |
| `skip.minChars` | `6` | Prompts shorter than this are not judged. |
| `skip.systemPrefixes` | `<task-notification`, `<agent-message`, `<teammate-message`, `<system-reminder`, `<local-command-`, `<command-name` | A prompt that starts with any of these (after trimming; case-sensitive, start only) is machine-generated and is skipped as `skip:system_message`. An empty array disables the rule. |
| `skip.skipPatterns` | stock replies (yes, ok, thanks, lgtm, and Japanese equivalents) | Case-insensitive regexes; a match skips the prompt. Prompts starting with `/` are always skipped. |
| `journal.promptChars` | `200` | Prompt characters stored as `promptHead`. |
| `policy.difficultyTiers` | `<1.2` light, `<2.6` standard, else deep | Threshold table from the expected difficulty score to a tier. |
| `policy.gainBump` | `1.5` | `stronger_gain` at or above this lifts the tier one step. |
| `policy.minTierByKind` | `{"design": "standard"}` | Per-kind floor on the tier. |
| `policy.minConfidence` | `{taskKind: 0.6, difficulty: 0.5, strongerGain: 0.6}` | Minimum confidence per signal (a plain number applies to all three). A `difficulty` below its threshold makes the decision `unclear`. A `taskKind` below its threshold is treated as unknown: the `question` rule and `minTierByKind` are skipped and routing continues on difficulty. A `strongerGain` below its threshold is ignored, so it never bumps the tier. Five-level scores are read with lower confidence than choices, hence the lower default for difficulty. |
| `policy.contextDependent` | `0.5` | `context_dependent` at or above this blocks delegation. |
| `policy.baseline` | `lightBelowChars: 200`, `standardBelowChars: 800` | The length heuristic recorded as `baselineTier`. |
| `sessionModelRank` | haiku 1, sonnet 2, opus 3, fable 3 | Substring → rank, to compare with the judged tier. |
| `tiers.<name>` | see [Tiers](#tiers) | `rank`, `executor`, `agent`, `model`, `enabled`. |

Example project config that routes more aggressively to cheaper tiers:

```json
{
  "mode": "advise",
  "policy": { "difficultyTiers": [{ "below": 1.8, "tier": "light" }, { "below": 3.0, "tier": "standard" }, { "tier": "deep" }] }
}
```

### Session model

The policy compares the judged tier with the model the session is running on, so that model has to be found. `UserPromptSubmit` is not guaranteed to carry `model`, so jev-dispatch looks in three places, in order, and journals which one answered as `sessionModelSource`:

1. **`input`**: the `model` field of the prompt payload, when present.
2. **`transcript`**: the newest assistant message in the session transcript (only the last 256 KB is read). This ranks above the cache because a later `/model` switch shows up here after the first reply, while the cache still holds the starting model.
3. **`session_start`**: a small cache that the `SessionStart` hook writes to `<plugin data dir>/sessions/<session_id>.json`. It covers a session that has not replied yet.

If none of them answers, the decision is `none` with reason `unknown_session_model`: without a baseline there is nothing to compare against, so jev-dispatch stays quiet rather than guess. A model name that is found but matches no key of `sessionModelRank` gives the same reason; add a key for it. The `SessionStart` hook prints nothing and never fails.

## Journal

One JSONL file for every project — Shadow mode exists to accumulate decisions in one place so the distribution can be read back. It is written for every judged or skipped prompt unless `mode` is `off`, and for every Agent call unless `spawn.mode` is `off`. Rows from the prompt hook carry `hook: "prompt"`; rows written before v0.2.0 have no `hook` field, so count a row without one as a prompt row.

| Field | Meaning |
|---|---|
| `ts` | ISO timestamp. |
| `contract` | Contract version, `route@1`. Rows from different contracts should never be pooled. |
| `session_id`, `cwd` | Where the prompt came from. |
| `mode` | Mode in effect. |
| `sessionModel` | The session's model, as resolved (see [Session model](#session-model)). |
| `sessionModelSource` | Where it came from: `input`, `transcript`, `session_start`, or `null` when unknown. |
| `promptChars` | Length of the whole prompt. |
| `promptHead` | First `journal.promptChars` characters of the prompt. |
| `answers` | Jev's raw answers, with probabilities. |
| `signals` | The answers as read: kind, difficulty, gain, context dependence, each with its confidence. |
| `kindUsed` | Whether `task_kind` was read confidently enough to be used (`true`), or treated as unknown (`false`, which also covers skipped prompts and judge failures). |
| `tier` | Tier the policy chose, if it got that far. |
| `baselineTier` | What a prompt-length rule alone would have chosen, to measure whether Jev beats it. |
| `action` | `delegate`, `consult` or `none`. |
| `reason` | Why — see [How it works](#how-it-works). |
| `delivered` | Whether a hint was actually injected (`advise` mode, non-`none` action). |
| `latencyMs`, `usage` | Jev round-trip time and token usage. |
| `error` | Failure reason when the judge was unavailable (`no_api_key`, `timeout`, `network_error`, `bad_json`, `http_<status>`). |

Subagent rows (`hook: "spawn"`, `contract: "spawn@1"`) share `ts`, `session_id`, `cwd`, `mode` (the spawn mode), `sessionModel`, `sessionModelSource`, `answers`, `signals`, `kindUsed`, `tier`, `action`, `reason`, `delivered`, `latencyMs`, `usage` and `error` with the fields above, and add:

| Field | Meaning |
|---|---|
| `subagentType` | The `subagent_type` of the call (`general-purpose` when omitted). Use it to see which names are really in use. |
| `requestedModel` | The `model` the call asked for, or `null`. |
| `routedModel` | The model it was routed to; `null` unless the action is `route`. |
| `direction` | `up` or `down` for a route, else `null`. |
| `action` | `route`, `keep` or `none`. |
| `reason` | `heavier` / `lighter` (route), `same_model` (keep), or for `none`: `not_targeted`, `explicit_respected`, `no_brief`, `unclear`, `unknown_model`, `no_tier`, `judge_unavailable`. A `:capped` suffix means `spawn.maxTier` lowered the tier. |
| `agentId`, `agentType` | Set only when the call was made from inside a subagent. |
| `descriptionHead` | First `journal.promptChars` characters of the call's `description`. |
| `briefChars` | Length of the whole brief (the brief itself is not stored). |

## Privacy and cost

- **Your prompt leaves your machine.** Up to `maxPromptChars` characters of every non-skipped prompt are sent to TypeSafe (`api.typesafe.ai`). Skipped prompts (machine-generated messages, slash commands, short or stock replies) are not. If prompts may contain material that must not leave, set `mode` to `off` for that project or lower `maxPromptChars`.
- **Subagent briefs leave your machine too.** Up to `maxPromptChars` characters of the brief of each targeted Agent call are sent to TypeSafe. Only the call's `description` (up to `journal.promptChars` characters) is stored locally, not the brief. Set `spawn.mode` to `off` to stop this.
- **The journal stores part of your prompt** — the first `journal.promptChars` characters as `promptHead`, for every row including skipped ones. It stays local. Set `journal.promptChars` to `0` to store none.
- **Latency on every judged prompt.** One Jev round trip, typically a few hundred milliseconds, before the prompt reaches the model. The request is cut off at `timeoutMs` (3000) and the hook at 5 seconds; a slow or failed judgement costs that wait and then lets the prompt through.
- **Cost** is Jev tokens per prompt (recorded in `usage`), at a small fraction of a cent. Acting on advice changes your Claude usage: delegating to a lighter model costs less; consulting a deeper one costs more.
- **Fail-open** on every error path. The router being down never stops work.

## Limitations

- **A hook cannot change the main session's model.** For the main session jev-dispatch can only hand the agent a hint. What it can change is the model of a subagent at launch (see [Subagent routing](#subagent-routing)).
- **Only `model` is routed.** Effort cannot be set per Agent call, and `apply` can only rewrite a call the main agent actually makes.
- **Hints are advisory.** The main agent may ignore, or only partly follow, a hint.
- **Judged from the prompt text alone.** Jev does not see the transcript, so a prompt that is short but depends on a long conversation is only caught if it reads as context-dependent.
- **Not every `UserPromptSubmit` is something you typed.** Subagent hand-backs and background-task notifications also arrive as `UserPromptSubmit`. They are skipped by default via `skip.systemPrefixes`; a machine-generated message with a prefix not in that list would still be judged.
- **Subagents have no memory of the conversation.** That is why delegation requires a self-contained prompt.
## Tests

```
node --test plugins/jev-dispatch/test/*.test.mjs
```

Pass the glob, not the directory: handing `node --test` a directory fails on Node 25. No network and no key: the policy is a pure function tested branch by branch, and the harness is run end to end against a local stand-in for the API.

## Changelog

### v0.2.1 — 2026-10-05

Docs: the roadmap is removed from the repository (`docs/roadmap.md`). No behaviour change.

### v0.2.0 — 2026-10-04

Subagent routing. A `PreToolUse` hook on the Agent tool judges the brief of each launch (contract `spawn@1`) and, in `apply` mode, rewrites the call's `model` up or down; `shadow` (the default) only records. New config: `spawn.mode`, `spawn.subagentTypes`, `spawn.respectExplicit`, `spawn.maxTier`, and `JEV_DISPATCH_SPAWN_MODE`. The three questions shared with `route@1` moved to `lib/contracts/questions.mjs` (texts unchanged), and the signals-to-tier step became `judgeTier()` in the policy, used by both hooks. Journal rows now carry `hook` (`prompt` or `spawn`).

### v0.1.1 — 2026-10-04

Fix: machine-generated messages — subagent hand-backs, background-task notifications and similar — also arrive as `UserPromptSubmit` and were being sent to Jev as if they were requests (13 of 20 rows in one real install, 3 of them recommending `delegate`). They are now skipped as `skip:system_message`, configurable through `skip.systemPrefixes`.

### v0.1.0 — 2026-10-03

Initial release. `UserPromptSubmit` hook with the `route@1` contract (task kind, difficulty, stronger-model gain, context dependence), delegate / consult / none policy, `light` / `standard` / `deep` subagents, Shadow mode by default, layered config, and a JSONL decision journal with a length-heuristic baseline.
