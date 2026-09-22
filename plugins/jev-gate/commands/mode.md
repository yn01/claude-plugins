---
description: Show or change the jev-gate mode (shadow / enforce / off) for this project
allowed-tools: Bash, Read, Edit, Write
argument-hint: "[shadow|enforce|off]"
---
# /jev-gate:mode

Shadow records and changes nothing. Enforce can send an agent back. Off disables every gate.

**Usage:**
- `/jev-gate:mode` — show the current mode and where it came from
- `/jev-gate:mode shadow` — record only (the default, and where every gate should start)
- `/jev-gate:mode enforce` — act on verdicts
- `/jev-gate:mode off` — disable

---

## Steps

### 1. Show the resolved configuration

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs"
```

### 2. With no argument, stop here

Report the mode and the config layer it came from. The layers, later winning: the plugin default, `~/.claude/jev-gate/config.json`, `<project>/.jev-gate/config.json`, then the `JEV_GATE_MODE` environment variable.

### 3. With an argument, write it to the project layer

Write or update `.jev-gate/config.json` in the project root:

```json
{ "mode": "enforce" }
```

Preserve any keys already in that file. Create the directory if needed.

### 4. Before switching to `enforce`, check the evidence

Run `/jev-gate:status` first. If it reports fewer than roughly 30 Jev-decided entries, say so and recommend staying in Shadow — thresholds set on a handful of samples are not thresholds.

Remind the user that `JEV_GATE_MODE` in the environment overrides the file, and `JEV_GATE_DISABLE=1` turns everything off for one session.
