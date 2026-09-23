---
description: Verify jev-gate configuration and confirm the Jev API actually answers — installed and working are different facts
allowed-tools: Bash, Read
---
# /jev-gate:doctor

Check that the gate is configured, that `TYPESAFE_API_KEY` is present, and that a real request comes back. The key is never printed.

---

## Steps

### 1. Run the check

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/doctor.mjs"
```

It prints the resolved configuration, then sends one small real request and reports the latency, the serving model, and the token usage.

### 2. Interpret the result

| Symptom | Meaning |
|---|---|
| `TYPESAFE_API_KEY NOT SET` | Every hook event will fail open. The gate is installed but inert. |
| `request FAILED: http_401` | The key is wrong or revoked. |
| `request FAILED: http_429` | Rate limited. Retry; if it persists, raise `timeoutMs` will not help — the account limit will. |
| `request FAILED: timeout` | The configured `timeoutMs` is tighter than the round trip. Compare against the `latency` line in `/jev-gate:status`. |
| latency close to `timeoutMs` | Raise `timeoutMs`, or accept a fail-open rate. |

### 3. Confirm the hooks are registered

```bash
grep -c gates/completion.mjs "${CLAUDE_PLUGIN_ROOT}/hooks/hooks.json"
```

Three matches is correct — `TaskCompleted`, `SubagentStop`, `Stop`.

Note that `TaskCompleted` needs `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` in the environment; without it that event never fires and only `SubagentStop` and `Stop` are live.
