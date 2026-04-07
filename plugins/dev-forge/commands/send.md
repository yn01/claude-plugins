---
description: Send a message to a specific dev-forge agent
allowed-tools: Bash
argument-hint: "<agent-name> <message>"
---
# /dev-forge:send

Send a message directly to a named dev-forge agent. The message is inserted into the SQLite messages table.

## Usage

```
/dev-forge:send orchestrator "Please prioritize the authentication feature for sprint 3"
/dev-forge:send team-alpha-lead "Status update requested on contract CONTRACT-20260407-120000"
```

## Steps

### 1. Parse arguments

Extract `<agent-name>` and `<message>` from the invocation arguments.

### 2. Validate agent exists

```bash
DB=".dev-forge/dev-forge.db"

if [ ! -f "$DB" ]; then
  echo "Error: dev-forge not initialized. Run /dev-forge:start first."
  exit 1
fi

exists=$(sqlite3 "$DB" "SELECT COUNT(*) FROM agent_status WHERE agent_name='$AGENT_NAME'")
if [ "$exists" = "0" ]; then
  echo "Error: Agent '$AGENT_NAME' not found. Run /dev-forge:status to see available agents."
  exit 1
fi
```

### 3. Insert message

```bash
ROW_ID=$(sqlite3 "$DB" "INSERT INTO messages (to_agent, from_agent, content, status, created_at) VALUES ('$AGENT_NAME', 'user', '$MESSAGE', 'unread', datetime('now')); SELECT last_insert_rowid()")

echo "Message sent to '$AGENT_NAME' (message ID: $ROW_ID)"
```

**Windows (PowerShell):**
```powershell
$DB = ".dev-forge\dev-forge.db"
sqlite3.exe $DB "INSERT INTO messages (to_agent, from_agent, content, status, created_at) VALUES ('$AgentName', 'user', '$Message', 'unread', datetime('now'))"
```
