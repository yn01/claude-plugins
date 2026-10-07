# jev-toolscope

A tool scoper for Claude Code. On every prompt, [Jev](https://docs.typesafe.ai/introduction) (TypeSafe's System One model) answers one yes/no question per MCP tool in your session — *does completing this request need this tool?* — all in a single request, and the answers become that prompt's **scope**. The agent can be pointed at the in-scope tools, and calls to the rest can be blocked.

jev-dispatch is Jev choosing the *model*; jev-toolscope is Jev choosing the *tools*.

```
/plugin install jev-toolscope
/jev-toolscope:scan
```

## Why, and what it does not do

The more MCP servers you connect, the more often the agent picks a wrong tool, or spends turns searching for the right one. Jev is built for exactly this shape of work — many independent yes/no judgements at once: in one measurement, 150 tool questions came back in about 250 ms.

What this plugin is **not** is a context-window saver. Claude Code's [tool search](https://code.claude.com/docs/en/mcp#scale-with-mcp-tool-search), on by default, already keeps MCP tool *definitions* out of context until they are loaded. And no hook can change the tool list the model sees: a hook can only add context to a prompt and allow or deny individual calls. Rewriting permission deny rules on every prompt would not help either — with tool search on it removes nothing from context, and with it off it invalidates the prompt cache every turn.

So jev-toolscope works with the two levers hooks do have:

- **Guide** (`UserPromptSubmit`): tell the agent which tools look relevant, with a ready-made `ToolSearch select:` query so it loads them directly instead of searching.
- **Guard** (`PreToolUse` on `mcp__.*`): in `enforce` mode, deny calls to MCP servers outside the scope.

The hint is per tool; the guard is per server by default. A server with any in-scope tool keeps all its tools callable, and only servers with none are blocked. Judged by name alone, a server's setup and helper tools look irrelevant — a browser server's "list the open tabs first" tool scored 0.32 against a screenshot request in one real run — and blocking them would stop exactly the work the scope allows. Set `guardLevel` to `"tool"` to block every tool that was not selected.

## Shadow mode by default

**After install, nothing visible happens. That is intended.**

In `shadow` mode every non-skipped prompt is judged and journaled, every MCP call is checked against the scope and journaled (`would_deny` when it falls outside), and nothing is injected or blocked. Read the record first:

```
/jev-toolscope:status
```

The number that matters is **recall**: of the MCP calls made under a scope, how many were inside it. When it is high, switch on:

```bash
# per project
mkdir -p .jev-toolscope && echo '{"mode":"advise"}' > .jev-toolscope/config.json

# or per shell / per session
export JEV_TOOLSCOPE_MODE=enforce
```

| Mode | Judges and journals | Hints the agent and shows the summary | Denies out-of-scope MCP calls |
|---|---|---|---|
| `shadow` (default) | yes | never | never |
| `advise` | yes | yes | never |
| `enforce` | yes | yes | yes |
| `off` | no — both hooks exit immediately | never | never |

Any other value (a typo, say) behaves like `shadow`.

In `advise` and `enforce` you see one line per prompt, for example:

```
🔭 jev-toolscope: 52 MCP tools → 2 in scope in 243 ms (claude-in-chrome/navigate, claude-in-chrome/computer)
```

## Installation

```
/plugin marketplace add yn01/claude-plugins
/plugin install jev-toolscope
```

jev-toolscope needs a TypeSafe API key. When you install or enable the plugin, Claude Code asks for it and stores it in your system keychain / credential store — never in a settings file. To set or change it later, run `/plugin`, open the **Installed** tab, select jev-toolscope, and choose **Configure options**. Then start a new session.

Without a key the plugin installs and runs, but every judgement fails open (`judge_unavailable`, `error: "no_api_key"`) and the guard allows every call.

Then build the catalog:

```
/jev-toolscope:scan
```

## How it works

```
UserPromptSubmit  {prompt, session_id, cwd, transcript_path}
  │
  ├─ mode off?                                              ──▶ exit
  ├─ code: skip rules (empty, machine-generated message,
  │        "/command", too short, "yes" / "ok" / "continue") ──▶ keep the previous scope, exit
  ├─ catalog: live MCP tool names from the transcript
  │           × names and descriptions from /jev-toolscope:scan
  ├─ no tools, or more than maxTools                        ──▶ open scope, exit
  ▼
  Jev: scope@1 — one noul per tool, one request
       "Completing the user_prompt needs the MCP tool "<server>/<tool>": <description>"
  ▼
  code: p ≥ minRelevance, plus alwaysAllow, plus any tool left unanswered ──▶ scope
  ▼
  session state + journal row ──▶ advise / enforce: hint + summary line

PreToolUse  mcp__.*   (no Jev call — a local file read)
  ├─ from a subagent, no scope, or an open scope            ──▶ allow
  ├─ in scope                                               ──▶ allow
  │    guardLevel "server" (default): any tool of a server with an in-scope tool
  │    guardLevel "tool": the selected tools only
  └─ out of scope                                           ──▶ enforce: deny   other modes: journal would_deny
```

"Allow" means the guard stays silent and the normal permission flow decides; it never grants a permission you have not given.

- **A skipped prompt keeps the scope.** "continue" is the same task; resetting would open every tool mid-task.
- **Subagents are not guarded.** The scope was judged from your prompt; a subagent's brief may legitimately need tools the prompt never mentioned.
- **A denied call is not retried.** The deny reason tells the agent to say which tool it needs and why, and the scope is judged again on your next prompt.

### The catalog

No hook is told the session's tool list, so jev-toolscope assembles it from two sources:

| Source | Gives | Limits |
|---|---|---|
| `/jev-toolscope:scan` → `<data dir>/catalog.json` | Names, descriptions and server instructions of the **stdio** servers in `~/.claude.json` and `<project>/.mcp.json` | Only as fresh as the last scan. HTTP / SSE servers, plugin-provided servers and claude.ai connectors are skipped. |
| The session transcript | The names of the MCP tools that are live in *this* session, including the ones the scan cannot reach | Names only. Read from Claude Code's internal transcript records (see below). |

When the transcript yields a live list, it decides which tools are judged; descriptions from the scan are attached where they exist, and tools the scan never saw are judged by name. When it yields nothing, every scanned tool that applies to the project is judged. The journal records which case applied as `catalogSource`: `scan+transcript`, `transcript-only`, `scan-only` or `none`.

**About the transcript records.** The hook input's `transcript_path` is documented; what is inside the file is not. When tool search defers MCP tools, Claude Code records the deferred tool names as `deferred_tools_delta` entries, and jev-toolscope reads those. A Claude Code update could rename or reshape them without notice. The reader is defensive — a format it does not recognise yields no live list, and the plugin falls back to `scan-only` rather than failing — and `/jev-toolscope:doctor` says so when it happens. With tool search off, the records do not exist and `scan-only` is the normal case.

The transcript is read incrementally: the byte offset reached is kept per session, so each prompt reads only what was appended since the last one.

Re-run `/jev-toolscope:scan` after adding, removing or upgrading an MCP server. The scan starts each stdio server with the command and env from its config, exactly as Claude Code does, asks it for `initialize` and `tools/list`, and stops it.

## Commands

| Command | What it does |
|---|---|
| `/jev-toolscope:scan [--server <name>]` | Build or refresh the catalog for this project. |
| `/jev-toolscope:status [--last N]` | Tools checked per prompt, latency p50 / p95, outcome and catalog-source counts, a histogram of relevance scores, recall and the most frequent out-of-scope calls, and the last N scopes. |
| `/jev-toolscope:doctor` | Config layers in effect, the catalog, and the last judgement and guard check. Sends no request of its own: the key option reaches hooks only, so the last judged prompt is the evidence the key works. |

## Configuration

Layers, later wins. Each is merged key by key; an unreadable or malformed file is skipped silently.

1. Plugin default — `config.json` in the plugin
2. Per user — `<data dir>/config.json`
3. Per project — `<project>/.jev-toolscope/config.json`
4. Environment — `JEV_TOOLSCOPE_MODE`

The data dir is `CLAUDE_PLUGIN_DATA` if set, else the first `~/.claude/plugins/data/jev-toolscope-*` directory, else `~/.claude/jev-toolscope/`.

| Key | Default | Meaning |
|---|---|---|
| `mode` | `"shadow"` | `shadow`, `advise`, `enforce` or `off`. |
| `minRelevance` | `0.4` | A tool whose answer is at or above this is in scope. Set from the relevance histogram in `/jev-toolscope:status`. |
| `guardLevel` | `"server"` | What `enforce` blocks. `server`: calls to servers with no in-scope tool. `tool`: calls to any tool that was not selected. |
| `alwaysAllow` | `[]` | Tools always in scope: full names (`"mcp__github__create_issue"`) or a server's tools (`"mcp__github__*"`). |
| `maxTools` | `150` | Above this many tools, Jev is not asked and the scope is left open (`catalog_too_large`). |
| `maxDescriptionChars` | `300` | Each tool description is clipped to this length in its question. |
| `summary` | `true` | Show the one-line summary in `advise` and `enforce`. |
| `model` | `"jev-1.13.0"` | Jev model sent to the endpoint. |
| `endpoint` | `https://api.typesafe.ai/v1/systemone` | Judge endpoint. |
| `timeoutMs` | `3000` | Abort the Jev request after this long; the scope is then left open. |
| `maxPromptChars` | `4000` | Prompt characters sent to Jev. |
| `skip.minChars`, `skip.systemPrefixes`, `skip.skipPatterns` | as in jev-dispatch | Prompts that are not judged; the previous scope carries over. |
| `scan.serverTimeoutMs` | `10000` | How long the scan waits for one server. |
| `journal.promptChars` | `200` | Prompt characters stored as `promptHead`. |

## Journal

`<data dir>/journal.jsonl`, one file for every project.

Scope rows (`hook: "scope"`):

| Field | Meaning |
|---|---|
| `ts`, `session_id`, `cwd`, `mode` | When, where, and the mode in effect. |
| `contract` | `scope@1`. Rows from different contracts should never be pooled. |
| `promptChars`, `promptHead` | Prompt length, and its first `journal.promptChars` characters. |
| `status` | `scoped`, `open` (judged nothing; every call allowed) or `carry` (skipped; previous scope kept). |
| `reason` | `judged`, `no_tools`, `catalog_too_large`, `judge_unavailable`, or `skip:*`. |
| `catalogSource`, `catalogSize`, `servers` | Where the tool list came from, how many tools were judged, from which servers. |
| `selected`, `selectedCount` | The scope. |
| `scores` | Every tool's answer, `[{tool, p}]`, most relevant first. |
| `unanswered` | Tools Jev returned no answer for (kept in scope). |
| `delivered` | Whether a hint was injected. |
| `latencyMs`, `usage` | Jev round-trip time and token usage. |
| `error` | `no_api_key`, `timeout`, `network_error`, `bad_json` or `http_<status>` when the judge was unavailable. |

Guard rows (`hook: "guard"`): `tool`, `inScope` (`null` when there was no scope to check against), `decision` (`allow`, `deny`, `would_deny`), `reason` (`in_scope`, `out_of_scope`, `no_scope`, `open_scope`, `subagent`), `guardLevel`, `scopeSize`, `scopeAgeMs`, `agentId`.

## Privacy and cost

- **Your API key** is read from the plugin option (`CLAUDE_PLUGIN_OPTION_TYPESAFE_API_KEY`, which Claude Code sets for hooks from the system credential store). It is sent only to the configured endpoint and never written to the journal.
- **Your prompt and your tool list leave your machine.** Up to `maxPromptChars` characters of every non-skipped prompt, plus the names and (clipped) descriptions of your MCP tools and their servers' instructions, are sent to TypeSafe (`api.typesafe.ai`). Set `mode` to `off` for a project where that must not happen.
- **The scan runs your MCP servers.** It starts the same commands, with the same env, that Claude Code starts for them, and only when you run `/jev-toolscope:scan`.
- **Latency on every judged prompt.** One Jev round trip — about 200–350 ms in measurement, from 10 to 150 tools — before the prompt reaches the model. Cut off at `timeoutMs` (3000), the hook at 5 seconds. The guard makes no network call.
- **Fail-open** on every error path: no key, no catalog, a slow or failed request, a thrown error. The scope is then open and every call is allowed.

## Limitations

- **The tool list the model sees cannot be changed** by a hook. The hint is advisory; only `enforce` makes the scope binding, and only for MCP tools.
- **A wrong scope blocks a needed tool in `enforce`.** At the default `guardLevel` that takes a whole server judged irrelevant; at `tool` level, any tool missed. That is why shadow comes first and recall is reported. `alwaysAllow` covers tools that should never be blocked.
- **Server-level guarding lets through unneeded tools of a needed server.** The hint still names only the selected tools.
- **Judged from the prompt alone.** A short follow-up such as "now post it to Slack" is judged without the earlier conversation.
- **Built-in tools are out of scope.** Only `mcp__*` tools are judged and guarded.
- **Subagents run unscoped.**

## Tests

```
node --test plugins/jev-toolscope/test/*.test.mjs
```

No network and no key: the hooks are run end to end against a local stand-in for the API, and the scanner against a fake stdio MCP server.

## Changelog

### v0.1.0 — 2026-10-07

Initial release. `UserPromptSubmit` hook with the `scope@1` contract (one Noul per MCP tool, one request), a `PreToolUse` guard on `mcp__.*` (per server by default, `guardLevel: "tool"` for per tool), `off` / `shadow` / `advise` / `enforce` modes with Shadow mode by default, a catalog built from `/jev-toolscope:scan` and the session transcript, `/jev-toolscope:status` with recall and a relevance histogram, `/jev-toolscope:doctor`, layered config, and a JSONL journal.
