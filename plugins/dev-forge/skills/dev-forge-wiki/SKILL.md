---
description: Manage the dev-forge wiki knowledge base (ingest, query, lint)
allowed-tools: Read, Write, Bash, Glob, Grep
argument-hint: "<subcommand> [args]"
---
# dev-forge:wiki skill

## When to use this skill
Use this skill when:
- New knowledge (external docs, design decisions, architectural notes) needs to be captured
- Searching the wiki for existing information before starting a new task
- Routine wiki maintenance (lint check for orphaned entries)
- A team member needs to reference project-specific knowledge

## Subcommands
- `ingest <file-or-url>` — add a new entry to the wiki
- `query <search terms>` — search wiki content
- `lint` — detect missing frontmatter, broken links, empty files

Refer to `commands/wiki.md` for full implementation.
