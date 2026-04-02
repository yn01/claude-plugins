# obsidian-archive

A Claude Code plugin that automatically generates session summaries and saves them to Obsidian.

## Overview

`obsidian-archive` provides the following features:

- **Auto-save**: Automatically generates and saves a summary to Obsidian when a Claude Code session ends
- **Periodic checkpoints**: Saves intermediate summaries at a configured interval (default: 30 minutes)
- **Manual save**: Save at any time using the `/obsidian-archive:archive` command
- **Configuration management**: View and update settings with the `/obsidian-archive:config` command

## Installation

```
/plugin marketplace add yn01/obsidian-archive
```

## Initial Setup

After installation, set `vault_path` to your Obsidian Vault path:

```
/obsidian-archive:config vault_path ~/Documents/Obsidian/MyVault
```

Verify your configuration:

```
/obsidian-archive:config
```

## Commands

### `/obsidian-archive:archive`

Immediately generates a summary of the current session and saves it to Obsidian.

```
/obsidian-archive:archive
```

**Example output:**
```
✓ Session summary saved:
  ~/Documents/Obsidian/Claude-Dev/Sessions/2026-03-18_14-30_my-project.md
```

### `/obsidian-archive:config`

View or update configuration settings.

```
# Show current settings
/obsidian-archive:config

# Update a setting
/obsidian-archive:config <key> <value>
```

**Examples:**
```
/obsidian-archive:config vault_path ~/Documents/Obsidian/MyVault
/obsidian-archive:config folder WorkSessions
/obsidian-archive:config auto_save_interval_minutes 60
/obsidian-archive:config include_git_diff false
```

## Configuration (obsidian-archive.json)

Settings are managed in `obsidian-archive.json` in the plugin directory.

```json
{
  "vault_path": "~/Documents/Obsidian/Claude-Dev",
  "folder": "Sessions",
  "filename_format": "YYYY-MM-DD_HH-mm_{project}",
  "auto_save_interval_minutes": 30,
  "include_git_diff": true,
  "tags": ["claude-code", "session"]
}
```

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `vault_path` | string | `~/Documents/Obsidian/Claude-Dev` | Path to your Obsidian Vault (`~` expansion supported) |
| `folder` | string | `Sessions` | Folder inside the Vault where session notes are saved |
| `filename_format` | string | `YYYY-MM-DD_HH-mm_{project}` | Filename format |
| `auto_save_interval_minutes` | number | `30` | Interval in minutes for automatic checkpoints. Set to `0` to disable |
| `include_git_diff` | boolean | `true` | Whether to include a git diff summary in the note |
| `tags` | array | `["claude-code", "session"]` | Tags added to the Obsidian note |

### filename_format variables

| Variable | Description |
|----------|-------------|
| `YYYY` | Year (4 digits) |
| `MM` | Month (2 digits) |
| `DD` | Day (2 digits) |
| `HH` | Hour (2 digits) |
| `mm` | Minute (2 digits) |
| `{project}` | Project name (current directory name) |

## Saved Note Structure

```markdown
---
date: 2026-03-18
project: my-project
tags: ["claude-code", "session"]
---

# Session Summary: my-project (2026-03-18 14:30)

## Overview
...

## Key Changes
...

## Decisions & Learnings
...

## Incomplete / Carry-over to Next Session
- [ ] Unfinished task...

## git diff Summary
...
```

### Intermediate save files

Intermediate saves are stored under `{vault_path}/{folder}/intermediate/`:

```
YYYY-MM-DD_HH-mm_{project}_autosave.md
```

## Using with devteam

`obsidian-archive` works independently but pairs well with the `devteam` plugin for a more powerful workflow.

### Recommended workflow

```
# 1. Start the development team
/devteam:start

# 2. Work on development...
/devteam:send orchestrator Please implement the new feature

# 3. Manually save at important milestones
/obsidian-archive:archive

# 4. Stop devteam
/devteam:stop

# → obsidian-archive automatically saves a summary when the session ends
```

### Archiving devteam agent output

Since the work done by each devteam agent is part of the session, their outputs are automatically captured in the session summary — giving you a complete record of multi-agent work with no extra effort.

## Hook behavior

### SessionStop hook

Runs automatically when the Claude Code session ends:
1. Reads configuration from `obsidian-archive.json`
2. Launches the `obsidian-archive:summarizer` agent
3. Generates a full session summary
4. Saves to `{vault_path}/{folder}/{filename}.md`

### PostToolUse hook (periodic checkpoints)

After each tool use, checks the time elapsed since the last save. If it exceeds `auto_save_interval_minutes`, an intermediate save is triggered:
1. Tracks the last save time via `/tmp/obsidian-archive-last-save`
2. Only runs when the interval has elapsed — not after every tool use
3. Saves to `{vault_path}/{folder}/intermediate/{filename}_autosave.md`

## Changelog

### v1.0.0 — 2026-03-17
- Initial release

## License

MIT
