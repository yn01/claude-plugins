# obsidian-archive

Summarize Claude Code sessions into structured Obsidian notes — on demand, and automatically when a session ends — and bring the open carry-over items back when the next session starts.

```
/plugin install obsidian-archive
```

## How it works

`/obsidian-archive:archive` asks the agent you are working with to summarize the conversation — it is the only one that has read it. The agent writes four fixed sections; a script adds everything a later reader matches on, so it never drifts from note to note:

| Written by the agent | Decided by code (`lib/note.mjs`) |
|---|---|
| `## 作業概要` (overview) | file name, date and time |
| `## 主な変更点` (key changes) | frontmatter: `project`, `session_id`, `branch`, `source`, `part`, `tags` |
| `## 決定事項・学び` (decisions and learnings) | the `## git の変更` section (status and recent commits) |
| `## 未完了・次回への持ち越し` (carry-over) | refusing a body with a missing heading |

`project` is the name of the git root, so a `cd` into a subdirectory does not change it. Outside git it is the directory name.

## Auto-save at session end

On by default. When an interactive session ends, a `SessionEnd` hook hands the session to a detached process and returns at once (Claude Code allows SessionEnd hooks 1.5 s). That process:

1. Cuts the transcript down to what a summary needs — typed prompts, the agent's text, one line per tool call; no thinking, no tool output; at most 60,000 characters (the first prompt and the most recent part are kept).
2. Skips the session if it has no typed prompt — or, when the session already has a note (say, from `/obsidian-archive:archive`), no typed prompt after that note.
3. Runs `claude -p --model <auto_save_model>` with no tools, no MCP servers, no hooks and no saved session, and writes the result through the same code as a manual note.

If the session already has a note, the new one covers only the work after it and links back: `part: 2`, `continues: "[[<earlier note>]]"`, title suffixed `（続き）`. File names come from the save time, so notes of the same day never collide; two saves in the same minute get `_2`.

Not summarized: headless runs (`claude -p`, the SDK — `CLAUDE_CODE_ENTRYPOINT` `sdk-*`) and the summarizing child itself.

If you declined `ANTHROPIC_API_KEY` in interactive Claude Code, the child drops it too and signs in the way your sessions do (`claude -p` would otherwise use the key).

Every outcome is one line in `<plugin data dir>/auto-save.jsonl`:

```bash
tail -n 5 ~/.claude/plugins/data/obsidian-archive-*/auto-save.jsonl | jq -c '{ts, action, reason, prompts, file}'
```

| `action` | `reason` |
|---|---|
| `saved` | — |
| `skipped` | `disabled`, `no_prompts`, `no_progress_since_note` |
| `error` | `transcript_unreadable`, `claude_failed`, `timeout` (180 s), `missing_sections` |

Turn it off with `/obsidian-archive:config auto_save false`; pick the model with `/obsidian-archive:config auto_save_model haiku`.

## Carry-over at session start

On by default. When a session starts (or after `/clear`), a `SessionStart` hook finds this project's newest note — within the last 14 days — whose `## 未完了・次回への持ち越し` section still has an unchecked `- [ ]` item, and hands those items to the agent as context, with the note's name. You see one line:

```
📌 obsidian-archive: 前回の持ち越し 6 件 — 2026-10-12_0255_claude-plugins
```

- A newer note with nothing open (a short question, a session that finished everything) does not hide older open work.
- Tick an item in Obsidian (`- [x]`) and it is not handed over again.
- `--resume`, `--continue` and compaction get nothing: that conversation already has it.
- The hook is code only — no model call. The items are given as information, not instructions.

Turn it off with `/obsidian-archive:config carry_over false`.

## Setup

```
/obsidian-archive:config vault_path ~/Documents/Obsidian/MyVault
/obsidian-archive:config
```

## Commands

| Command | Purpose |
|---|---|
| `/obsidian-archive:archive` | Summarize this session and save it. Prints the note's path. |
| `/obsidian-archive:config` | Show the resolved settings and the file they come from. |
| `/obsidian-archive:config <key> <value>` | Set one key. Values are parsed by type. |

## Configuration

Stored in the plugin's data directory (`~/.claude/plugins/data/obsidian-archive-*/config.json`), so it survives plugin updates.

| Key | Type | Default | Description |
|---|---|---|---|
| `vault_path` | string | `~/Documents/Obsidian/Claude-Dev` | Path to the vault (`~` is expanded) |
| `folder` | string | `Summaries` | Folder inside the vault |
| `include_git_diff` | boolean | `true` | Add the `## git の変更` section |
| `tags` | array | `["claude-code", "session-summary"]` | `["a", "b"]` or `a, b` |
| `auto_save` | boolean | `true` | Summarize and save when a session ends |
| `auto_save_model` | string | `sonnet` | Model for the auto-save summary |
| `carry_over` | boolean | `true` | Hand open carry-over items to the agent at session start |

## Saved note

`<vault>/<folder>/YYYY-MM-DD_HHmm_<project>.md` (`_2`, `_3` … if the name is taken):

```markdown
---
date: "2026-10-12"
time: "21:40"
saved_at: "2026-10-12T12:40:03.512Z"
project: "claude-plugins"
session_id: "b034e387-e395-4111-a4fa-0c9c5b42fcea"
branch: "main"
source: "manual"          # or "auto"
part: 1                   # 2, 3 … for later notes of the same session
tags: ["claude-code", "session-summary"]
---

# claude-plugins · 2026-10-12 21:40

## 作業概要
## 主な変更点
## 決定事項・学び
## 未完了・次回への持ち越し
- [ ] ...

## git の変更
```

The section headings are a contract: tools that read notes back find sections by these exact names.

## Development

```bash
node --test plugins/obsidian-archive/test/*.test.mjs
```

## Changelog

### v1.3.0 — 2026-10-12
- Carry-over at session start, on by default (`carry_over`). A `SessionStart` hook hands the agent the unchecked items of this project's newest note (≤ 14 days old) that still has any, and shows one line with the count and the note's name. Code only; skipped on resume and compaction.

### v1.2.0 — 2026-10-12
- Auto-save at session end, on by default (`auto_save`, `auto_save_model`, default `sonnet`). A `SessionEnd` hook starts a detached summarizer and returns at once; the summary comes from a cut-down transcript via `claude -p` with no tools, MCP servers, hooks or saved session. Headless runs are not summarized. Outcomes are logged to `auto-save.jsonl`.
- A session that already has a note gets a follow-up note covering only the later work: `part`, `continues`, title `（続き）`.
- Frontmatter gains `saved_at`, `source` (`manual` / `auto`) and `part`.

### v1.1.0 — 2026-10-12
- The session summary is written by the main agent. The `summarizer` subagent is removed: a subagent starts with a fresh context and never saw the conversation it was asked to summarize.
- File name, frontmatter and the git section are produced by `scripts/write-note.mjs`; a body missing one of the four headings is refused. Frontmatter gains `time`, `session_id` and `branch`; `project` is the git root's name.
- Settings move to the plugin data directory and survive updates; `/obsidian-archive:config` reads and writes them through `scripts/config.mjs`. Breaking: `filename_format` (the name format is now fixed) and `auto_save_interval_minutes` are removed; the default `folder` is `Summaries` and the default tag `session-summary`. Settings in the old `obsidian-archive.json` are not carried over — set them again with `/obsidian-archive:config`.
- Removed the auto-save hooks, which never ran (unknown `SessionStop` event, invalid matcher), the template and the plugin-level `.gitignore`. `claude plugin validate --strict` now passes.

### v1.0.1 — 2026-10-05
- Docs: the README describes only the working manual commands (`archive`, `config`); the auto-save hook claims are removed.

### v1.0.0 — 2026-03-17
- Initial release

## License

MIT
