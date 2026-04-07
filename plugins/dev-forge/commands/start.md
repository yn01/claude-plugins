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

### 4. Launch tmux sessions

For each agent, read its definition from the plugin's `agents/` directory and launch:

```bash
PLUGIN_DIR="$(dirname "$(dirname "${BASH_SOURCE[0]}")")"
COMM_RULES=$(cat "$PLUGIN_DIR/agents/communication-rules.md")

# Orchestrator
AGENT_PROMPT=$(cat "$PLUGIN_DIR/agents/core/orchestrator.md")
SYSTEM_PROMPT="$AGENT_PROMPT

---

$COMM_RULES"

# Write prompt to temp file to avoid shell argument length limits
PROMPT_FILE=$(mktemp /tmp/dev-forge-orchestrator.XXXXXX)
echo "$SYSTEM_PROMPT" > "$PROMPT_FILE"

tmux new-session -d -s "dev-forge-orchestrator" \
  "claude --model claude-opus-4-6 --system-prompt \"$(cat $PROMPT_FILE)\""
rm -f "$PROMPT_FILE"

sqlite3 "$DB" "UPDATE agent_status SET status='active', last_active=datetime('now') WHERE agent_name='orchestrator'"
```

Repeat for all agents using their respective model and agent .md file:
- Core agents: `agents/core/<name>.md`
- Team leads: `agents/team/team-lead.md` with team name substitution
- Team members: `agents/team/<role>.md` with team name substitution

**Windows (PowerShell):** Use `wt new-tab` or `Start-Process powershell` instead of tmux.

### 5. Output summary

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
