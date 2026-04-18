---
description: Manage agent model profiles and individual model overrides
allowed-tools: Read, Write, Bash
argument-hint: "profile <name> | set <agent> <model> | reset"
---
# /dev-forge:model

Manage which Claude models agents use. Switch between profiles for bulk changes, or override individual agents.

Model aliases: `opus` = claude-opus-4-6, `sonnet` = claude-sonnet-4-6, `haiku` = claude-haiku-4-5-20251001. Full model IDs are also accepted.

## Subcommands

### profile

```
/dev-forge:model profile <name>
```

Switch all agents to a named profile defined in `devforge.yaml`. Changes take effect on the next message each agent processes — no restart required.

1. Read `devforge.yaml` to locate `model_profiles.<name>`. If the profile doesn't exist, list available profiles and exit.

2. Define alias resolution:

```bash
DB=".dev-forge/dev-forge.db"

resolve_model() {
  local alias="$1"
  case "$alias" in
    opus)   echo "claude-opus-4-6" ;;
    sonnet) echo "claude-sonnet-4-6" ;;
    haiku)  echo "claude-haiku-4-5-20251001" ;;
    *)      echo "$alias" ;;
  esac
}
```

3. For each agent in `agent_status`, resolve its model from the profile:
   - Look up agent name in `model_profiles.<name>` in devforge.yaml
   - If not found, use the `default` key from the same profile block
   - Resolve alias to full model ID

4. Update all agents in one transaction:

```bash
sqlite3 "$DB" "BEGIN TRANSACTION;"
# For each agent:
sqlite3 "$DB" "UPDATE agent_status SET model='$FULL_MODEL' WHERE agent_name='$AGENT_ID';"
sqlite3 "$DB" "COMMIT;"

# Store active profile name
sqlite3 "$DB" "INSERT OR REPLACE INTO config (key, value) VALUES ('model_profile', '$PROFILE_NAME')"
```

5. Output summary:

```
Profile switched to: quality

Agent                  Model
──────────────────────────────────
orchestrator           opus
doc-manager            opus
implementer-alpha      opus
explorer               sonnet
...

Changes take effect on each agent's next message.
```

---

### set

```
/dev-forge:model set <agent-name> <model>
```

Override the model for a specific agent. Accepts alias or full model ID.

1. Verify agent exists in `agent_status`. If not, print available agents and exit.

2. Resolve alias:

```bash
DB=".dev-forge/dev-forge.db"

resolve_model() {
  local alias="$1"
  case "$alias" in
    opus)   echo "claude-opus-4-6" ;;
    sonnet) echo "claude-sonnet-4-6" ;;
    haiku)  echo "claude-haiku-4-5-20251001" ;;
    *)      echo "$alias" ;;
  esac
}

FULL_MODEL=$(resolve_model "$MODEL_ARG")
```

3. Update the agent:

```bash
sqlite3 "$DB" "UPDATE agent_status SET model='$FULL_MODEL' WHERE agent_name='$AGENT_NAME'"
```

4. Output:

```
implementer-alpha → opus (claude-opus-4-6)
Takes effect on next message. Use /dev-forge:model reset to restore profile defaults.
```

---

### reset

```
/dev-forge:model reset
```

Re-apply the current profile to all agents, clearing any individual overrides.

1. Read the active profile from config:

```bash
DB=".dev-forge/dev-forge.db"
ACTIVE_PROFILE=$(sqlite3 "$DB" "SELECT value FROM config WHERE key='model_profile'" 2>/dev/null || echo "balanced")
```

2. Re-apply the profile the same way `profile` subcommand does.

3. Output:

```
Reset to profile: balanced

All overrides cleared. Agents will use profile defaults on next message.
```
