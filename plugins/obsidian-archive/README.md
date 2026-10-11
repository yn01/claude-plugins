# obsidian-archive

Summarize a Claude Code session and save it to your Obsidian vault as a structured note.

```
/plugin install obsidian-archive
```

## How it works

`/obsidian-archive:archive` asks the agent you are working with to summarize the conversation — it is the only one that has read it. The agent writes four fixed sections; a script adds everything a later reader matches on, so it never drifts from note to note:

| Written by the agent | Decided by code (`scripts/write-note.mjs`) |
|---|---|
| `## 作業概要` (overview) | file name, date and time |
| `## 主な変更点` (key changes) | frontmatter: `project`, `session_id`, `branch`, `tags` |
| `## 決定事項・学び` (decisions and learnings) | the `## git の変更` section (status and recent commits) |
| `## 未完了・次回への持ち越し` (carry-over) | refusing a body with a missing heading |

`project` is the name of the git root, so a `cd` into a subdirectory does not change it. Outside git it is the directory name.

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

## Saved note

`<vault>/<folder>/YYYY-MM-DD_HHmm_<project>.md` (`_2`, `_3` … if the name is taken):

```markdown
---
date: "2026-10-12"
time: "21:40"
project: "claude-plugins"
session_id: "b034e387-e395-4111-a4fa-0c9c5b42fcea"
branch: "main"
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
