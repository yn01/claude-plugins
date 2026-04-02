# claude-plugins

A collection of Claude Code plugins by Yohei Nakanishi. New plugins are added over time as new workflows and use cases emerge.

## Plugins

### [devteam](./devteam) `v1.1.0`

Multi-agent development team orchestration with file-based message queues.

Assemble an AI-powered team where an Orchestrator delegates tasks to specialized agents — implementers, reviewers, evaluators, doc managers, and release managers — all coordinated via sprint contracts and a structured chain of command.

```
/plugin install devteam
```

### [genpptx](./genpptx) `v1.4.4`

Generates PowerPoint presentations from content files (meeting notes, memos).

Provide a content file and the plugin designs a story-driven slide structure, produces a `spec.yaml`, and outputs `.pptx` + `.html` — end to end.

```
/plugin install genpptx
```

### [mcpg](./plugins/mcpg) `v1.0.0`

Generate MCP server scaffold and tool implementation code from a natural language description.

Describe what tools you want in plain language, choose TypeScript or Python, and get a working server skeleton — complete with input schemas and handler logic — ready to install.

```
/plugin install mcpg
```

### [mcpd](./plugins/mcpd) `v1.0.1`

Diagnose MCP server configuration, connectivity, and available tools.

Reads all MCP configuration files (global and project-level), checks environment variables, verifies server connectivity, and lists available tools — all in one command.

```
/plugin install mcpd
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

### [obsidian-archive](./obsidian-archive) `v1.0.0`

Automatically generates session summaries and saves them to an Obsidian vault.

Captures what you built, decided, and carried over — at session end or on a configurable interval — as structured Markdown notes in your vault.

```
/plugin install obsidian-archive
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

### 2026-04-02
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

