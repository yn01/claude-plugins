# claude-plugins

A collection of Claude Code plugins by Yohei Nakanishi. New plugins are added over time as new workflows and use cases emerge.

## Plugins

### [devteam](./devteam)

Multi-agent development team orchestration with file-based message queues.

Assemble an AI-powered team where an Orchestrator delegates tasks to specialized agents — implementers, reviewers, evaluators, doc managers, and release managers — all coordinated via sprint contracts and a structured chain of command.

```
/plugin install devteam
```

### [obsidian-archive](./obsidian-archive)

Automatically generates session summaries and saves them to an Obsidian vault.

Captures what you built, decided, and carried over — at session end or on a configurable interval — as structured Markdown notes in your vault.

```
/plugin install obsidian-archive
```

### [genpptx](./genpptx)

Generates PowerPoint presentations from content files (meeting notes, memos).

Provide a content file and the plugin designs a story-driven slide structure, produces a `spec.yaml`, and outputs `.pptx` + `.html` — end to end.

```
/plugin install genpptx
```

## Installation

Add the marketplace once, then install any plugin by name:

```
/plugin marketplace add yn01/claude-plugins
/plugin install <plugin-name>
```
