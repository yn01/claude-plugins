---
description: Stop all dev-forge agents and archive unread messages
allowed-tools: Bash, Glob
---
# /dev-forge:stop

Gracefully shut down all dev-forge agents. Archives unread messages and updates agent status in the database.

## Steps

### 1. Archive unread messages

```bash
DB=".dev-forge/dev-forge.db"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
ARCHIVE_FILE=".dev-forge/archive/messages-$TIMESTAMP.json"
mkdir -p .dev-forge/archive

sqlite3 -json "$DB" "SELECT * FROM messages WHERE status='unread'" > "$ARCHIVE_FILE" 2>/dev/null
sqlite3 "$DB" "UPDATE messages SET status='archived' WHERE status='unread'" 2>/dev/null

count=$(cat "$ARCHIVE_FILE" | grep -c '"id"' 2>/dev/null || echo 0)
echo "Archived $count unread message(s) to $ARCHIVE_FILE"
```

**Windows (PowerShell):**
```powershell
$DB = ".dev-forge\dev-forge.db"
$Timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$ArchiveFile = ".dev-forge\archive\messages-$Timestamp.json"
New-Item -ItemType Directory -Force -Path .dev-forge\archive | Out-Null
sqlite3.exe -json $DB "SELECT * FROM messages WHERE status='unread'" | Out-File $ArchiveFile
sqlite3.exe $DB "UPDATE messages SET status='archived' WHERE status='unread'"
```

### 2. Kill tmux sessions

```bash
# macOS/Linux
tmux list-sessions 2>/dev/null | grep "^dev-forge-" | cut -d: -f1 | while read session; do
  tmux kill-session -t "$session"
  echo "Stopped: $session"
done
```

**Windows (PowerShell):**
```powershell
# Stop background Claude processes started with dev-forge prefix
Get-Process -Name "claude" -ErrorAction SilentlyContinue | Stop-Process -Force
```

### 3. Update agent status

```bash
sqlite3 "$DB" "UPDATE agent_status SET status='stopped', last_active=datetime('now')"
echo "All agents marked as stopped."
```

### 4. Output summary

```
dev-forge stopped

Sessions terminated: N
Messages archived:   M  ->  .dev-forge/archive/messages-<timestamp>.json
```
