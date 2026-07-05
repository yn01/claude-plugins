# CLAUDE.md

Development notes for working on this plugin marketplace repository.

## Marketplace Registration Gotcha

When registering this marketplace while working inside this project's directory, Claude Code detects the local git clone and registers it using the `"git"` source format with a `path` field pointing to the local directory:

```json
"yn01-claude-plugins-marketplace": {
  "source": {
    "source": "git",
    "url": "https://github.com/yn01/claude-plugins.git",
    "path": "/Users/yoheinakanishi/Dev/claude-plugins"
  }
}
```

**This is undesirable for non-development sessions** — Claude Code will read from the local directory instead of the published GitHub version, which may expose in-progress, unpublished code.

The correct form for general use is the `"github"` source:

```json
"yn01-claude-plugins-marketplace": {
  "source": {
    "source": "github",
    "repo": "yn01/claude-plugins"
  }
}
```

**Rule:** After registering this marketplace from within this project, always verify `~/.claude/settings.json` and fix the source to `"github"` form if it was auto-set to `"git"`.
