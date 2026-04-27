---
description: Initialize dev-forge SQLite database and launch all agent tmux sessions
allowed-tools: Read, Bash, Write, Glob
argument-hint: "[--resume]"
---
# /dev-forge:start

Initialize the dev-forge system: create the SQLite database, populate routing rules from `devforge.yaml`, and launch all agents as tmux sessions.

## Prerequisites

- `sqlite3` CLI installed (`brew install sqlite3` / `winget install SQLite.SQLite`)
- `tmux` installed on macOS/Linux (`brew install tmux`); Windows Terminal (`wt`) on Windows
- `claude` CLI available in PATH
- `devforge.yaml` in project root (or copy from plugin's `templates/devforge.yaml`)

## Steps

### 1. Locate devforge.yaml

Check for `devforge.yaml` in the current project root. If not found, print instructions to copy the template:

```bash
if [ ! -f "devforge.yaml" ]; then
  echo "devforge.yaml not found. Copy the template first:"
  echo "  cp $(claude plugin path dev-forge)/templates/devforge.yaml ./devforge.yaml"
  exit 1
fi
```

### 2. Initialize directories and database

```bash
# macOS/Linux
mkdir -p .dev-forge .dev-forge/wiki .dev-forge/learnings .dev-forge/guidelines .dev-forge/archive

DB=".dev-forge/dev-forge.db"
sqlite3 "$DB" "
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  to_agent TEXT NOT NULL,
  from_agent TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread',
  created_at TEXT NOT NULL,
  read_at TEXT
);
CREATE TABLE IF NOT EXISTS contracts (
  id TEXT PRIMARY KEY,
  task TEXT NOT NULL,
  team_lead TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  criteria TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS agent_status (
  agent_name TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'stopped',
  current_task TEXT,
  model TEXT NOT NULL,
  last_active TEXT
);
CREATE TABLE IF NOT EXISTS communication_rules (
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  allowed INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (from_agent, to_agent)
);
CREATE TABLE IF NOT EXISTS violation_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_agent TEXT NOT NULL,
  to_agent TEXT NOT NULL,
  message_content TEXT,
  attempted_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS learnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  iteration INTEGER NOT NULL,
  mistake TEXT,
  pattern TEXT,
  recommendation TEXT,
  impact TEXT,
  created_at TEXT NOT NULL,
  session_id TEXT
);
CREATE TABLE IF NOT EXISTS config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
"
```

**Windows (PowerShell):**
```powershell
New-Item -ItemType Directory -Force -Path .dev-forge, .dev-forge\wiki, .dev-forge\learnings, .dev-forge\guidelines, .dev-forge\archive | Out-Null
$DB = ".dev-forge\dev-forge.db"
# Run the same SQL schema via sqlite3.exe $DB "CREATE TABLE IF NOT EXISTS ..."
```

### 3. Define model alias resolution

Alias resolution is used throughout start and model commands. Implement as a shell function:

```bash
resolve_model() {
  local alias="$1"
  case "$alias" in
    opus)   echo "claude-opus-4-6" ;;
    sonnet) echo "claude-sonnet-4-6" ;;
    haiku)  echo "claude-haiku-4-5-20251001" ;;
    *)      echo "$alias" ;;  # pass-through for full model IDs
  esac
}
```

### 4. Read active profile and resolve models from devforge.yaml

Parse the active profile from `devforge.yaml` and resolve the model for each agent:

```bash
# Extract active profile name (default: balanced)
ACTIVE_PROFILE=$(grep '^model_profile:' devforge.yaml | awk '{print $2}' | tr -d '"' || echo "balanced")

# Store active profile in config table
sqlite3 "$DB" "INSERT OR REPLACE INTO config (key, value) VALUES ('model_profile', '$ACTIVE_PROFILE')"

# resolve_profile_model <agent_name> <profile_name>
# Returns the full model ID for the agent within the given profile
resolve_profile_model() {
  local agent="$1"
  local profile="$2"

  # Try to find agent-specific override within the profile block in devforge.yaml
  # Profile block is indented under "model_profiles:\n  <profile>:"
  local agent_alias
  agent_alias=$(awk "
    /^model_profiles:/ { in_profiles=1; next }
    in_profiles && /^  $profile:/ { in_profile=1; next }
    in_profile && /^  [a-z]/ && !/^  $profile:/ { in_profile=0 }
    in_profile && /^    $agent:/ { print \$2; exit }
  " devforge.yaml)

  # If not found, fall back to 'default' key in the profile
  if [ -z "$agent_alias" ]; then
    agent_alias=$(awk "
      /^model_profiles:/ { in_profiles=1; next }
      in_profiles && /^  $profile:/ { in_profile=1; next }
      in_profile && /^  [a-z]/ && !/^  $profile:/ { in_profile=0 }
      in_profile && /^    default:/ { print \$2; exit }
    " devforge.yaml)
  fi

  resolve_model "${agent_alias:-sonnet}"
}
```

### 5. Parse devforge.yaml and populate agent_status + communication_rules

Read `devforge.yaml` and for each agent (orchestrator, project-manager, each cross_team_agent, each team member):

- `orchestrator` and `project-manager` are top-level keys in devforge.yaml
- `cross_team_agents` entries (doc-manager, release-manager, explorer) are nested under `cross_team_agents:`
- Team members (lead + implementer/evaluator/reviewer per team) are nested under `teams:`

```bash
# Resolve model for each agent using active profile
MODEL=$(resolve_profile_model "$AGENT_ID" "$ACTIVE_PROFILE")

# Insert agent into agent_status
sqlite3 "$DB" "INSERT OR REPLACE INTO agent_status (agent_name, status, model, last_active) VALUES ('$AGENT_ID', 'stopped', '$MODEL', datetime('now'))"

# Insert communication rules from can_contact list
# For each target in can_contact:
sqlite3 "$DB" "INSERT OR REPLACE INTO communication_rules (from_agent, to_agent, allowed) VALUES ('$AGENT_ID', '$CONTACT', 1)"
```

Also clear old rules first: `sqlite3 "$DB" "DELETE FROM communication_rules"`

### 6. Write the agent watchdog script

Each agent runs as a polling loop rather than a single interactive `claude` session. This ensures agents detect new DB messages continuously, not just at startup.

Write `.dev-forge/agent-loop.sh`:

```bash
cat > .dev-forge/agent-loop.sh << 'LOOP_SCRIPT'
#!/usr/bin/env bash
# dev-forge agent watchdog loop
AGENT_ID="$1"
INITIAL_MODEL="$2"
SYSTEM_PROMPT_FILE="$3"
DB=".dev-forge/dev-forge.db"
POLL_INTERVAL=5

unset ANTHROPIC_API_KEY

# SQLite helper with busy timeout and retry
db_exec() {
  local sql="$1"
  local retries=5
  local delay=1
  for i in $(seq 1 $retries); do
    result=$(sqlite3 -cmd ".timeout 5000" "$DB" "$sql" 2>&1)
    rc=$?
    if [ $rc -eq 0 ]; then
      echo "$result"
      return 0
    fi
    echo "[dev-forge] $AGENT_ID DB retry $i: $result" >&2
    sleep $delay
  done
  echo "[dev-forge] $AGENT_ID DB failed after $retries retries: $sql" >&2
  return 1
}

echo "[dev-forge] $AGENT_ID watchdog started (initial model: $INITIAL_MODEL)"

while true; do
  MSG_ID=$(db_exec \
    "SELECT id FROM messages
     WHERE to_agent='$AGENT_ID' AND status='unread'
     ORDER BY created_at ASC LIMIT 1")

  if [ -n "$MSG_ID" ]; then
    FROM_AGENT=$(db_exec "SELECT from_agent FROM messages WHERE id=$MSG_ID")
    CONTENT=$(db_exec "SELECT content FROM messages WHERE id=$MSG_ID")

    # Read current model from DB on each message (enables runtime model changes)
    CURRENT_MODEL=$(db_exec "SELECT model FROM agent_status WHERE agent_name='$AGENT_ID'")
    MODEL="${CURRENT_MODEL:-$INITIAL_MODEL}"

    db_exec "UPDATE messages SET status='read', read_at=datetime('now') WHERE id=$MSG_ID"
    db_exec "UPDATE agent_status SET status='processing', current_task='msg-$MSG_ID', last_active=datetime('now') WHERE agent_name='$AGENT_ID'"

    echo "[dev-forge] $AGENT_ID processing message $MSG_ID from $FROM_AGENT (model: $MODEL)"

    printf '[Message from %s, msg-id=%s]:\n%s\n' \
      "$FROM_AGENT" "$MSG_ID" "$CONTENT" \
      | claude --model "$MODEL" \
               --system-prompt-file "$SYSTEM_PROMPT_FILE" \
               --print \
               --dangerously-skip-permissions

    db_exec "UPDATE agent_status SET status='idle', current_task=NULL, last_active=datetime('now') WHERE agent_name='$AGENT_ID'"
  else
    sleep "$POLL_INTERVAL"
  fi
done
LOOP_SCRIPT
chmod +x .dev-forge/agent-loop.sh
```

### 7. Launch tmux sessions

Write each agent's system prompt to `.dev-forge/prompts/` and launch via the watchdog:

```bash
PLUGIN_DIR="$(claude plugin path dev-forge)"
COMM_RULES=$(cat "$PLUGIN_DIR/agents/communication-rules.md")
mkdir -p .dev-forge/prompts

launch_agent() {
  local AGENT_ID="$1"
  local MODEL="$2"
  local AGENT_MD="$3"   # path to the agent's .md file

  local PROMPT_FILE=".dev-forge/prompts/$AGENT_ID.md"
  # Combine agent definition + shared communication rules
  { cat "$AGENT_MD"; echo; echo "---"; echo; echo "$COMM_RULES"; } > "$PROMPT_FILE"

  tmux new-session -d -s "dev-forge-$AGENT_ID" \
    -e "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY" \
    "bash .dev-forge/agent-loop.sh '$AGENT_ID' '$MODEL' '$PROMPT_FILE'; \
     echo '[dev-forge] $AGENT_ID loop exited'; read"

  sqlite3 "$DB" \
    "UPDATE agent_status SET status='idle', last_active=datetime('now') WHERE agent_name='$AGENT_ID'"
}

# Resolve models from active profile
ORC_MODEL=$(resolve_profile_model "orchestrator" "$ACTIVE_PROFILE")
PM_MODEL=$(resolve_profile_model "project-manager" "$ACTIVE_PROFILE")
DOC_MODEL=$(resolve_profile_model "doc-manager" "$ACTIVE_PROFILE")
REL_MODEL=$(resolve_profile_model "release-manager" "$ACTIVE_PROFILE")
EXP_MODEL=$(resolve_profile_model "explorer" "$ACTIVE_PROFILE")
LEAD_MODEL=$(resolve_profile_model "team-lead" "$ACTIVE_PROFILE")
MEMBER_MODEL=$(resolve_profile_model "implementer" "$ACTIVE_PROFILE")

# Core agents
launch_agent "orchestrator"     "$ORC_MODEL"    "$PLUGIN_DIR/agents/core/orchestrator.md"
launch_agent "project-manager"  "$PM_MODEL"     "$PLUGIN_DIR/agents/core/project-manager.md"
launch_agent "doc-manager"      "$DOC_MODEL"    "$PLUGIN_DIR/agents/core/doc-manager.md"
launch_agent "release-manager"  "$REL_MODEL"    "$PLUGIN_DIR/agents/core/release-manager.md"
launch_agent "explorer"         "$EXP_MODEL"    "$PLUGIN_DIR/agents/core/explorer.md"

# Team agents — substitute TEAM_NAME placeholder in the template before writing
for TEAM in alpha beta; do
  LEAD_PROMPT=".dev-forge/prompts/team-$TEAM-lead.md"
  sed "s/{{TEAM_NAME}}/$TEAM/g" "$PLUGIN_DIR/agents/team/team-lead.md" > "$LEAD_PROMPT"
  echo; echo "$COMM_RULES" >> "$LEAD_PROMPT"
  tmux new-session -d -s "dev-forge-team-$TEAM-lead" \
    -e "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY" \
    "bash .dev-forge/agent-loop.sh 'team-$TEAM-lead' '$LEAD_MODEL' '$LEAD_PROMPT'; read"
  sqlite3 "$DB" "UPDATE agent_status SET status='idle', last_active=datetime('now') WHERE agent_name='team-$TEAM-lead'"

  for ROLE in implementer evaluator reviewer; do
    MEMBER_PROMPT=".dev-forge/prompts/$ROLE-$TEAM.md"
    sed "s/{{TEAM_NAME}}/$TEAM/g" "$PLUGIN_DIR/agents/team/$ROLE.md" > "$MEMBER_PROMPT"
    echo; echo "$COMM_RULES" >> "$MEMBER_PROMPT"
    tmux new-session -d -s "dev-forge-$ROLE-$TEAM" \
      -e "ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY" \
      "bash .dev-forge/agent-loop.sh '$ROLE-$TEAM' '$MEMBER_MODEL' '$MEMBER_PROMPT'; read"
    sqlite3 "$DB" "UPDATE agent_status SET status='idle', last_active=datetime('now') WHERE agent_name='$ROLE-$TEAM'"
  done
done
```

**Windows (PowerShell):** Use `Start-Process powershell -ArgumentList "-NoExit", "-File", ".dev-forge\agent-loop.ps1", $agentId, $model, $promptFile"` instead of tmux.

> **Why `--print` instead of an interactive session?**
> An interactive `claude` session goes idle after its initial response and will not react to new DB inserts. The watchdog loop re-invokes `claude --print` for each message, so every new message gets a fresh, fully-tooled Claude run. Tool calls inside that run (e.g. `sqlite3 INSERT` to reply to another agent) execute normally.

> **Why read model from DB on each message?**
> Reading the model from `agent_status` on every message means runtime changes (via `/dev-forge:model`) take effect immediately on the next message — no agent restart required. The `$INITIAL_MODEL` arg is only a fallback if the DB is unavailable.

### 8. Output summary

Print a table of launched agents:

```
dev-forge started  [profile: balanced]

Agent                  Model     Status
─────────────────────────────────────────────
orchestrator           opus      active
project-manager        sonnet    active
doc-manager            sonnet    active
release-manager        sonnet    active
explorer               haiku     active
team-alpha-lead        sonnet    active
implementer-alpha      sonnet    active
evaluator-alpha        sonnet    active
reviewer-alpha         sonnet    active
team-beta-lead         sonnet    active
implementer-beta       sonnet    active
evaluator-beta         sonnet    active
reviewer-beta          sonnet    active

Use /dev-forge:status to monitor agents and message queues.
Use /dev-forge:model profile <name> to switch model profiles.
Use /dev-forge:contract create to assign work.
```
