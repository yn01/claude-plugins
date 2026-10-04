# obsidian-archive

A Claude Code plugin that generates session summaries and saves them to Obsidian.

## Overview

`obsidian-archive` provides the following features:

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
/obsidian-archive:config include_git_diff false
```

## Configuration (obsidian-archive.json)

Settings are managed in `obsidian-archive.json` in the plugin directory.

```json
{
  "vault_path": "~/Documents/Obsidian/Claude-Dev",
  "folder": "Sessions",
  "filename_format": "YYYY-MM-DD_HH-mm_{project}",
  "include_git_diff": true,
  "tags": ["claude-code", "session"]
}
```

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `vault_path` | string | `~/Documents/Obsidian/Claude-Dev` | Path to your Obsidian Vault (`~` expansion supported) |
| `folder` | string | `Sessions` | Folder inside the Vault where session notes are saved |
| `filename_format` | string | `YYYY-MM-DD_HH-mm_{project}` | Filename format |
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
```

### Archiving devteam agent output

Since the work done by each devteam agent is part of the session, their outputs are automatically captured in the session summary — giving you a complete record of multi-agent work with no extra effort.

## Changelog

### v1.0.1 — 2026-10-05
- Docs: the README describes only the working manual commands (`archive`, `config`); the auto-save hook claims are removed.

### v1.0.0 — 2026-03-17
- Initial release

## License

MIT
