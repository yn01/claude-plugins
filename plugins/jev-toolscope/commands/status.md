---
description: Read the jev-toolscope journal — tools checked per prompt, latency, relevance histogram, and how often the scope held the tool that was actually called
allowed-tools: Bash, Read
argument-hint: "[--last N]"
---
# /jev-toolscope:status

Read back what the scope hook and the guard have recorded.

**Usage:**
- `/jev-toolscope:status` — summary and the last 5 scopes
- `/jev-toolscope:status --last 20` — more recent scopes

---

## Steps

### 1. Print the summary

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/stats.mjs" $ARGUMENTS
```

If it reports no journal, say so plainly and stop.

### 2. Read recall before anything else

`recall` is the share of MCP calls, made under a scope, whose tool was inside it. It is the number that says whether `enforce` is safe to turn on:

- **Recall well below 100%** means the scope keeps missing tools the agent then uses. Look at the out-of-scope list: a tool that appears often is either a candidate for `alwaysAllow` or a sign that `minRelevance` is too high.
- **Few checked calls** means there is not enough evidence yet. Say so instead of recommending a threshold.

### 3. Read the histogram

The relevance histogram covers every tool of every judged prompt. `minRelevance` (default 0.4) should sit in a gap: most tools near 0, the relevant few well above. A crowded middle means the descriptions are too vague to judge — a re-scan, or a server whose tool descriptions are thin, is the usual cause.

### 4. Recommend, do not apply

State a recommended `minRelevance` and `alwaysAllow`, with the numbers they come from. Ask before writing them to `.jev-toolscope/config.json`, and before switching `mode` — that is the user's call.
