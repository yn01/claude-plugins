# claude-plugins

A collection of Claude Code plugins by Yohei Nakanishi. New plugins are added over time as new workflows and use cases emerge.

## Plugins

### [devteam](./devteam) `v1.1.0`

Multi-agent development team orchestration with file-based message queues.

Assemble an AI-powered team where an Orchestrator delegates tasks to specialized agents — implementers, reviewers, evaluators, doc managers, and release managers — all coordinated via sprint contracts and a structured chain of command.

```
/plugin install devteam
```

### [obsidian-archive](./obsidian-archive) `v1.0.0`

Automatically generates session summaries and saves them to an Obsidian vault.

Captures what you built, decided, and carried over — at session end or on a configurable interval — as structured Markdown notes in your vault.

```
/plugin install obsidian-archive
```

### [genpptx](./genpptx) `v1.1.0`

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

## Versioning

Versions follow [Semantic Versioning](https://semver.org/) (`MAJOR.MINOR.PATCH`):

| Increment | When to use |
|-----------|-------------|
| `MAJOR` | Breaking changes — commands renamed/removed, behavior changed incompatibly |
| `MINOR` | New features added in a backward-compatible manner |
| `PATCH` | Bug fixes, documentation updates, minor refinements |

Version is declared in each plugin's `.claude-plugin/plugin.json`. If omitted, Claude Code falls back to the git commit SHA.

## Changelog

### devteam

#### v1.1.0 — 2026-03-28
- Add sprint contracts (`/devteam:contract create/list/complete/report`) — pre-agreed definitions of done between Orchestrator and Team Lead
- Add Evaluator agents (`evaluator-a`, `evaluator-b`) implementing the Generator/Evaluator pattern
- Add `agents/communication-rules.md` defining allowed/prohibited message paths for all agents
- Enforce chain of command: Orchestrator → Team Lead → team members only; no skip-level messages
- Update `devteam.yaml` with `sprint_contracts` config and evaluator agent entries

#### v1.0.0 — 2026-03-17
- Initial release

---

### obsidian-archive

#### v1.0.0 — 2026-03-17
- Initial release

---

### genpptx

#### v1.1.0 — 2026-03-28
- Add PDF support to `/genpptx:read` — reads PDF files via Claude's native Read tool, displays content page by page
- Add PDF support to `/genpptx:theme` — visually analyzes PDF to estimate colors and fonts, generates theme file directly

#### v1.0.0 — 2026-03-17
- Initial release
