# claude-plugins

A collection of Claude Code plugins by Yohei Nakanishi. New plugins are added over time as new workflows and use cases emerge.

## Plugins

### [devteam](./devteam) `v1.1.0`

Multi-agent development team orchestration with file-based message queues.

Assemble an AI-powered team where an Orchestrator delegates tasks to specialized agents — implementers, reviewers, evaluators, doc managers, and release managers — all coordinated via sprint contracts and a structured chain of command.

```
/plugin install devteam
```

### [dev-forge](./plugins/dev-forge) `v1.1.0`

SQLite-backed multi-agent development team with wiki, learnings, and bug council escalation.

Orchestrates an AI-powered team where agents communicate via a single SQLite database — no scattered inbox files. Includes sprint contracts, Generator/Evaluator pattern, automatic model escalation, a 3-analyst Bug Council for critical failures, project wiki, and learnings capture.

```
/plugin install dev-forge
```

### [genpptx](./plugins/genpptx) `v1.4.4`

Generates PowerPoint presentations from content files (meeting notes, memos).

Provide a content file and the plugin designs a story-driven slide structure, produces a `spec.yaml`, and outputs `.pptx` + `.html` — end to end.

```
/plugin install genpptx
```

### [mcpa](./plugins/mcpa) `v1.0.0`

Add a stdio MCP server to Claude Code interactively or with arguments.

A wrapper around `claude mcp add` that guides you through server name, command, args, env vars, and scope — or accepts them all as flags for one-shot registration.

```
/plugin install mcpa
```

### [mcpd](./plugins/mcpd) `v1.0.1`

Diagnose MCP server configuration, connectivity, and available tools.

Reads all MCP configuration files (global and project-level), checks environment variables, verifies server connectivity, and lists available tools — all in one command.

```
/plugin install mcpd
```

### [mcpg](./plugins/mcpg) `v1.0.0`

Generate MCP server scaffold and tool implementation code from a natural language description.

Describe what tools you want in plain language, choose TypeScript or Python, and get a working server skeleton — complete with input schemas and handler logic — ready to install.

```
/plugin install mcpg
```

### [mcpl](./plugins/mcpl) `v1.0.0`

Tail and display MCP server stderr logs in real time.

引数なしで設定済み全サーバーのログを統合表示、`--server` 指定で特定サーバーに絞ってリアルタイム監視する。

```
/plugin install mcpl
```

### [mcpr](./plugins/mcpr) `v1.0.0`

Run MCP server tools directly and inspect their responses.

Call any tool with explicit arguments for scripted use, or use interactive mode to walk through server → tool → argument input step by step.

```
/plugin install mcpr
```

### [mcpx](./plugins/mcpx) `v1.0.0`

Interactively explore MCP server tools and their input schemas.

Drill down from server → tool → schema to inspect parameter names, types, and descriptions — without writing any code.

```
/plugin install mcpx
```

### [obsidian-archive](./plugins/obsidian-archive) `v1.0.0`

Automatically generates session summaries and saves them to an Obsidian vault.

Captures what you built, decided, and carried over — at session end or on a configurable interval — as structured Markdown notes in your vault.

```
/plugin install obsidian-archive
```

### [slide-revive](./plugins/slide-revive) `v1.0.0`

Rebuild NotebookLM slide PDFs as fully editable PPTX files using Vision AI.

NotebookLM exports embed each slide as a flat image with no editable content. slide-revive runs every page through Claude's Vision AI, reconstructs titles, bullets, and tables as native PPTX objects, and outputs `.pptx` + `.html` — no external API key required.

```
/plugin install slide-revive
```

## Installation

Add the marketplace once, then install any plugin by name:

```
/plugin marketplace add yn01/claude-plugins
/plugin install <plugin-name>
```

## Versioning

Versions follow [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`):

| Increment | When to use |
|-----------|-------------|
| `MAJOR` | Breaking changes — commands renamed/removed, behavior changed incompatibly |
| `MINOR` | New features added in a backward-compatible manner |
| `PATCH` | Bug fixes, documentation updates, minor refinements |

Version is declared in each plugin's `.claude-plugin/plugin.json`. If omitted, Claude Code falls back to the git commit SHA.

## Changelog

### 2026-04-17
- Update **dev-forge** to v1.1.0 — auto-assign learning numbers, add `learn status` subcommand, add Key Concepts glossary to README

### 2026-04-07
- Add **dev-forge** v1.0.0 — SQLite-backed multi-agent development team with wiki, learnings, and bug council escalation

### 2026-04-05
- Add **slide-revive** v1.0.0 — rebuild NotebookLM slide PDFs as editable PPTX using Vision AI

### 2026-04-03
- Add **mcpl** v1.0.0 — tail and display MCP server stderr logs in real time

### 2026-04-02
- Add **mcpa** v1.0.0 — add stdio MCP servers to Claude Code interactively or with arguments
- Add **mcpg** v1.0.0 — generate MCP server scaffold from natural language description
- Add **mcpr** v1.0.0 — run MCP server tools directly and inspect responses
- Add **mcpx** v1.0.0 — interactive MCP server tool explorer

### 2026-04-01
- Add **mcpd** v1.0.0 — MCP server diagnostic plugin

### 2026-03-28
- Update **devteam** to v1.1.0 — sprint contracts, evaluator agents, communication rules

### 2026-03-17
- Add **devteam** v1.0.0 — multi-agent development team orchestration
- Add **genpptx** v1.0.0 — PowerPoint generation from content files
- Add **obsidian-archive** v1.0.0 — automatic session archiving to Obsidian

