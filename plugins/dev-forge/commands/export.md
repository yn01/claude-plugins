---
description: Export dev-forge database content to Markdown files
allowed-tools: Bash, Write
argument-hint: "[--section messages|contracts|learnings|all]"
---
# /dev-forge:export

Export the contents of the dev-forge SQLite database to human-readable Markdown files in `.dev-forge/export/`.

## Usage

```
/dev-forge:export                         # exports all sections
/dev-forge:export --section messages      # messages only
/dev-forge:export --section contracts     # contracts only
/dev-forge:export --section learnings     # learnings only
```

## Steps

### 1. Setup

```bash
DB=".dev-forge/dev-forge.db"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
EXPORT_DIR=".dev-forge/export"
mkdir -p "$EXPORT_DIR"

SECTION="${SECTION:-all}"  # parse from --section argument
```

### 2. Export messages

If section is `messages` or `all`:

```bash
OUTFILE="$EXPORT_DIR/$TIMESTAMP-messages.md"
echo "# dev-forge Message Export — $TIMESTAMP" > "$OUTFILE"
echo "" >> "$OUTFILE"

sqlite3 "$DB" "SELECT to_agent, from_agent, content, status, created_at FROM messages ORDER BY created_at" | while IFS='|' read to from content status ts; do
  echo "## [$ts] $from → $to ($status)" >> "$OUTFILE"
  echo "" >> "$OUTFILE"
  echo "$content" >> "$OUTFILE"
  echo "" >> "$OUTFILE"
  echo "---" >> "$OUTFILE"
  echo "" >> "$OUTFILE"
done

echo "Messages exported -> $OUTFILE"
```

### 3. Export contracts

If section is `contracts` or `all`:

```bash
OUTFILE="$EXPORT_DIR/$TIMESTAMP-contracts.md"
echo "# dev-forge Contract Export — $TIMESTAMP" > "$OUTFILE"
echo "" >> "$OUTFILE"

sqlite3 "$DB" "SELECT id, task, team_lead, status, criteria, created_at, completed_at, notes FROM contracts ORDER BY created_at" | while IFS='|' read id task lead status criteria created completed notes; do
  echo "## $id" >> "$OUTFILE"
  echo "- **Task**: $task" >> "$OUTFILE"
  echo "- **Team Lead**: $lead" >> "$OUTFILE"
  echo "- **Status**: $status" >> "$OUTFILE"
  echo "- **Created**: $created" >> "$OUTFILE"
  [ -n "$completed" ] && echo "- **Completed**: $completed" >> "$OUTFILE"
  echo "- **Criteria**: $criteria" >> "$OUTFILE"
  [ -n "$notes" ] && echo "- **Notes**: $notes" >> "$OUTFILE"
  echo "" >> "$OUTFILE"
done

echo "Contracts exported -> $OUTFILE"
```

### 4. Export learnings

If section is `learnings` or `all`:

```bash
OUTFILE="$EXPORT_DIR/$TIMESTAMP-learnings.md"
echo "# dev-forge Learnings Export — $TIMESTAMP" > "$OUTFILE"
echo "" >> "$OUTFILE"

sqlite3 "$DB" "SELECT iteration, mistake, pattern, recommendation, impact, created_at FROM learnings ORDER BY iteration" | while IFS='|' read iter mistake pattern rec impact ts; do
  echo "## Iteration #$iter — $ts" >> "$OUTFILE"
  [ -n "$mistake" ] && echo "**Mistake**: $mistake" >> "$OUTFILE"
  [ -n "$pattern" ] && echo "**Pattern**: $pattern" >> "$OUTFILE"
  [ -n "$rec" ] && echo "**Recommendation**: $rec" >> "$OUTFILE"
  [ -n "$impact" ] && echo "**Impact**: $impact" >> "$OUTFILE"
  echo "" >> "$OUTFILE"
done

echo "Learnings exported -> $OUTFILE"
```
