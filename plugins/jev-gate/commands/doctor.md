---
description: Verify jev-gate configuration and report the last session-start health check — installed and working are different facts
allowed-tools: Bash, Read
---
# /jev-gate:doctor

Check that the gate is configured and that the API key worked at the start of this session. The key is never printed.

The key is passed to hooks but not to commands Claude runs through the Bash tool, so this command cannot test it directly. Instead a `SessionStart` hook sends one small request when each session starts and records the outcome; this command reads that record.

---

## Steps

### 1. Run the check

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs"
```

It prints the resolved configuration, then the last health check: when it ran, whether a key is set, whether the request succeeded, the latency, and the serving model.

### 2. Interpret the result

| Symptom | Meaning |
|---|---|
| `health check      no result yet` | The check runs at session start and has not run yet. Start a new session, then run this again. |
| `STALE` next to the check time | The result is over 24 hours old. Start a new session for a fresh check. |
| `API key           NOT SET` | Every hook event will fail open. The gate is installed but inert. Set the key in `/plugin`, on the **Installed** tab: open jev-gate and choose **Configure options**. Then start a new session. |
| `request           FAILED: http_401` | The key is wrong or revoked. Re-enter it under **Configure options**. |
| `request           FAILED: http_429` | Rate limited. Retry in a new session; if it persists, the account limit is the cause, and raising `timeoutMs` will not help. |
| `request           FAILED: timeout` | The configured `timeoutMs` is tighter than the round trip. Compare against the `latency` line in `/jev-gate:status`. |
| latency close to `timeoutMs` | Raise `timeoutMs`, or accept a fail-open rate. |

### 3. Confirm the hooks are registered

```bash
grep -c gates/completion.mjs "${CLAUDE_PLUGIN_ROOT}/hooks/hooks.json"
```

Three matches is correct — `TaskCompleted`, `SubagentStop`, `Stop`. The health check is a fourth hook, `SessionStart`.

Note that `TaskCompleted` needs `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` in the environment; without it that event never fires and only `SubagentStop` and `Stop` are live.
