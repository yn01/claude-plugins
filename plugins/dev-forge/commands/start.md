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
"
```

**Windows (PowerShell):**
```powershell
New-Item -ItemType Directory -Force -Path .dev-forge, .dev-forge\wiki, .dev-forge\learnings, .dev-forge\guidelines, .dev-forge\archive | Out-Null
$DB = ".dev-forge\dev-forge.db"
# Run the same SQL schema via sqlite3.exe $DB "CREATE TABLE IF NOT EXISTS ..."
```

### 3. Parse devforge.yaml and populate agent_status + communication_rules

Read `devforge.yaml` and for each agent (orchestrator, each cross_team_agent, each team member):

```bash
# Insert agent into agent_status
sqlite3 "$DB" "INSERT OR REPLACE INTO agent_status (agent_name, status, model, last_active) VALUES ('$AGENT_ID', 'stopped', '$MODEL', datetime('now'))"

# Insert communication rules from can_contact list
# For each target in can_contact:
sqlite3 "$DB" "INSERT OR REPLACE INTO communication_rules (from_agent, to_agent, allowed) VALUES ('$AGENT_ID', '$CONTACT', 1)"
```

Also clear old rules first: `sqlite3 "$DB" "DELETE FROM communication_rules"`

### 4. Write the agent watchdog script

Each agent runs as a polling loop rather than a single interactive `claude` session. This ensures agents detect new DB messages continuously, not just at startup.

Write `.dev-forge/agent-loop.sh`:

```bash
cat > .dev-forge/agent-loop.sh << 'LOOP_SCRIPT'
#!/usr/bin/env bash
# dev-forge agent watchdog loop
# Polls the SQLite message bus for unread messages and processes each one
# via `claude --print`, which runs Claude headlessly with full tool access.
#
# Usage: agent-loop.sh <agent-id> <model> <system-prompt-file>

AGENT_ID="$1"
MODEL="$2"
SYSTEM_PROMPT_FILE="$3"
DB=".dev-forge/dev-forge.db"
POLL_INTERVAL=5

echo "[dev-forge] $AGENT_ID watchdog started (model: $MODEL)"

while true; do
  # Fetch the oldest unread message addressed to this agent
  MSG_ROW=$(sqlite3 "$DB" \
    "SELECT id, from_agent, content FROM messages
     WHERE to_agent='$AGENT_ID' AND status='unread'
     ORDER BY created_at ASC LIMIT 1" 2>/dev/null)

  if [ -n "$MSG_ROW" ]; then
    MSG_ID=$(echo "$MSG_ROW"   | cut -d'|' -f1)
    FROM_AGENT=$(echo "$MSG_ROW" | cut -d'|' -f2)
    CONTENT=$(echo "$MSG_ROW"  | cut -d'|' -f3)

    # Mark as read before processing to avoid double-delivery on crash/restart
    sqlite3 "$DB" \
      "UPDATE messages SET status='read', read_at=datetime('now') WHERE id=$MSG_ID"
    sqlite3 "$DB" \
      "UPDATE agent_status SET status='processing', current_task='msg-$MSG_ID', last_active=datetime('now') WHERE agent_name='$AGENT_ID'"

    echo "[dev-forge] $AGENT_ID processing message $MSG_ID from $FROM_AGENT"

    # Run Claude headlessly. Tool calls (sqlite3 INSERT etc.) execute normally.
    # The agent's system prompt already instructs it to write replies to the DB.
    printf '[Message from %s, msg-id=%s]:\n%s\n' \
      "$FROM_AGENT" "$MSG_ID" "$CONTENT" \
      | claude --model "$MODEL" \
               --system-prompt-file "$SYSTEM_PROMPT_FILE" \
               --print \
               --allowedTools "Bash,Read,Write,Edit,Grep,Glob"

    sqlite3 "$DB" \
      "UPDATE agent_status SET status='idle', current_task=NULL, last_active=datetime('now') WHERE agent_name='$AGENT_ID'"
  else
    sleep "$POLL_INTERVAL"
  fi
done
LOOP_SCRIPT
chmod +x .dev-forge/agent-loop.sh
```

### 5. Launch tmux sessions

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
    "bash .dev-forge/agent-loop.sh '$AGENT_ID' '$MODEL' '$PROMPT_FILE'; \
     echo '[dev-forge] $AGENT_ID loop exited'; read"

  sqlite3 "$DB" \
    "UPDATE agent_status SET status='idle', last_active=datetime('now') WHERE agent_name='$AGENT_ID'"
}

# Core agents
launch_agent "orchestrator"     "claude-opus-4-6"    "$PLUGIN_DIR/agents/core/orchestrator.md"
launch_agent "doc-manager"      "claude-sonnet-4-6"  "$PLUGIN_DIR/agents/core/doc-manager.md"
launch_agent "release-manager"  "claude-sonnet-4-6"  "$PLUGIN_DIR/agents/core/release-manager.md"
launch_agent "explorer"         "claude-haiku-4-5-20251001" "$PLUGIN_DIR/agents/core/explorer.md"

# Team agents — substitute TEAM_NAME placeholder in the template before writing
for TEAM in alpha beta; do
  LEAD_PROMPT=".dev-forge/prompts/team-$TEAM-lead.md"
  sed "s/{{TEAM_NAME}}/$TEAM/g" "$PLUGIN_DIR/agents/team/team-lead.md" > "$LEAD_PROMPT"
  echo; echo "$COMM_RULES" >> "$LEAD_PROMPT"
  tmux new-session -d -s "dev-forge-team-$TEAM-lead" \
    "bash .dev-forge/agent-loop.sh 'team-$TEAM-lead' 'claude-sonnet-4-6' '$LEAD_PROMPT'; read"
  sqlite3 "$DB" "UPDATE agent_status SET status='idle', last_active=datetime('now') WHERE agent_name='team-$TEAM-lead'"

  for ROLE in implementer evaluator reviewer; do
    MEMBER_PROMPT=".dev-forge/prompts/$ROLE-$TEAM.md"
    sed "s/{{TEAM_NAME}}/$TEAM/g" "$PLUGIN_DIR/agents/team/$ROLE.md" > "$MEMBER_PROMPT"
    echo; echo "$COMM_RULES" >> "$MEMBER_PROMPT"
    tmux new-session -d -s "dev-forge-$ROLE-$TEAM" \
      "bash .dev-forge/agent-loop.sh '$ROLE-$TEAM' 'claude-sonnet-4-6' '$MEMBER_PROMPT'; read"
    sqlite3 "$DB" "UPDATE agent_status SET status='idle', last_active=datetime('now') WHERE agent_name='$ROLE-$TEAM'"
  done
done
```

**Windows (PowerShell):** Use `Start-Process powershell -ArgumentList "-NoExit", "-File", ".dev-forge\agent-loop.ps1", $agentId, $model, $promptFile"` instead of tmux.

> **Why `--print` instead of an interactive session?**
> An interactive `claude` session goes idle after its initial response and will not react to new DB inserts. The watchdog loop re-invokes `claude --print` for each message, so every new message gets a fresh, fully-tooled Claude run. Tool calls inside that run (e.g. `sqlite3 INSERT` to reply to another agent) execute normally.

### 6. Output summary

Print a table of launched agents:

```
dev-forge started

Agent                  Model                    Status
─────────────────────────────────────────────────────────
orchestrator           claude-opus-4-6          active
doc-manager            claude-sonnet-4-6        active
release-manager        claude-sonnet-4-6        active
explorer               claude-haiku-4-5-*       active
team-alpha-lead        claude-sonnet-4-6        active
implementer-alpha      claude-sonnet-4-6        active
evaluator-alpha        claude-sonnet-4-6        active
reviewer-alpha         claude-sonnet-4-6        active
team-beta-lead         claude-sonnet-4-6        active
implementer-beta       claude-sonnet-4-6        active
evaluator-beta         claude-sonnet-4-6        active
reviewer-beta          claude-sonnet-4-6        active

Use /dev-forge:status to monitor agents and message queues.
Use /dev-forge:contract create to assign work.
```
