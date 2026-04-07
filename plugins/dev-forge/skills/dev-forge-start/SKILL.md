---
description: Initialize dev-forge SQLite database and launch all agent tmux sessions
allowed-tools: Read, Bash, Write, Glob
argument-hint: "[--resume]"
---
# dev-forge:start skill

## When to use this skill
Use this skill when:
- The user says "start dev-forge", "launch the team", or "initialize dev-forge"
- A `/dev-forge:start` command is issued
- The dev-forge system needs to be initialized at the beginning of a development session

## Steps
Refer to `commands/start.md` for the full implementation steps. This skill covers the same workflow:
1. Locate `devforge.yaml` in the project root
2. Initialize `.dev-forge/dev-forge.db` with the 6-table SQLite schema
3. Populate `communication_rules` from `devforge.yaml` `can_contact` lists
4. Launch tmux sessions (or Windows Terminal on Windows) for each agent
5. Output a launch summary table
