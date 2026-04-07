---
description: Record and review dev-forge learnings from sprint iterations
allowed-tools: Bash, Read, Write
argument-hint: "<subcommand> [args]"
---
# /dev-forge:learn

Capture and review agent learnings — mistakes made, anti-patterns identified, and recommended approaches — from sprint iterations. Data is stored in the SQLite `learnings` table and mirrored to `.dev-forge/learnings/`.

## Subcommands

### record (default, no subcommand)

```
/dev-forge:learn
/dev-forge:learn record --iteration <n> --mistake "<text>" --pattern "<text>" --recommendation "<text>" --impact <low|medium|high|critical>
```

1. If arguments are not provided, prompt the user interactively for each field
2. Insert into `learnings` table:
   ```bash
   DB=".dev-forge/dev-forge.db"
   SESSION_ID=$(date +%Y%m%d)
   sqlite3 "$DB" "INSERT INTO learnings (iteration, mistake, pattern, recommendation, impact, created_at, session_id) VALUES ($ITERATION, '$MISTAKE', '$PATTERN', '$RECOMMENDATION', '$IMPACT', datetime('now'), '$SESSION_ID')"
   ```
3. Write human-readable mirror to `.dev-forge/learnings/`:
   ```bash
   LEARNINGS_DIR=".dev-forge/learnings"
   mkdir -p "$LEARNINGS_DIR"
   cat >> "$LEARNINGS_DIR/LEARNINGS.md" << EOF

   ## Agent Learning Log: Iteration #$ITERATION

   ### Mistake Made
   - *Description:* $MISTAKE
   - *Impact:* $IMPACT

   ### Patterns to Avoid
   - *Pattern:* $PATTERN

   ### Better Approaches
   - *Recommendation:* $RECOMMENDATION

   ---
   EOF
   ```
4. Output: `Learning recorded (iteration #$ITERATION, impact: $IMPACT)`

### review

```
/dev-forge:learn review [--iteration <n>] [--impact <level>]
```

Query learnings with optional filters:
```bash
WHERE_CLAUSE=""
[ -n "$ITERATION" ] && WHERE_CLAUSE="WHERE iteration=$ITERATION"
[ -n "$IMPACT" ] && WHERE_CLAUSE="${WHERE_CLAUSE:+$WHERE_CLAUSE AND }impact='$IMPACT'"
[ -n "$WHERE_CLAUSE" ] && WHERE_CLAUSE="WHERE $WHERE_CLAUSE"

sqlite3 "$DB" "SELECT iteration, mistake, pattern, recommendation, impact, created_at FROM learnings $WHERE_CLAUSE ORDER BY iteration DESC"
```

Display as a formatted table.

### export

```
/dev-forge:learn export
```

Write all learnings from SQLite to `.dev-forge/learnings/all-learnings.md`:

```bash
OUTFILE=".dev-forge/learnings/all-learnings.md"
echo "# dev-forge — All Learnings" > "$OUTFILE"
echo "Generated: $(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$OUTFILE"
echo "" >> "$OUTFILE"

sqlite3 "$DB" "SELECT iteration, mistake, pattern, recommendation, impact, created_at FROM learnings ORDER BY iteration" | while IFS='|' read iter mistake pattern rec impact ts; do
  cat >> "$OUTFILE" << EOF

## Iteration #$iter ($impact) — $ts

**Mistake**: $mistake

**Pattern to avoid**: $pattern

**Recommendation**: $rec

---
EOF
done

echo "Learnings exported -> $OUTFILE"
```
