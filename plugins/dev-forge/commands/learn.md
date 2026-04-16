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
/dev-forge:learn record [--iteration <n>] --mistake "<text>" --pattern "<text>" --recommendation "<text>" --impact <low|medium|high|critical>
```

`--iteration` is optional. When omitted, the learning number is assigned automatically as `MAX(iteration) + 1` from the `learnings` table (or `1` if no learnings exist yet).

1. If `--mistake`, `--pattern`, `--recommendation`, or `--impact` are not provided, prompt the user interactively for each field
2. Resolve the learning number:
   ```bash
   DB=".dev-forge/dev-forge.db"
   if [ -z "$ITERATION" ]; then
     ITERATION=$(sqlite3 "$DB" "SELECT COALESCE(MAX(iteration), 0) + 1 FROM learnings")
   fi
   ```
3. Insert into `learnings` table:
   ```bash
   SESSION_ID=$(date +%Y%m%d)
   sqlite3 "$DB" "INSERT INTO learnings (iteration, mistake, pattern, recommendation, impact, created_at, session_id) VALUES ($ITERATION, '$MISTAKE', '$PATTERN', '$RECOMMENDATION', '$IMPACT', datetime('now'), '$SESSION_ID')"
   ```
4. Write human-readable mirror to `.dev-forge/learnings/`:
   ```bash
   LEARNINGS_DIR=".dev-forge/learnings"
   mkdir -p "$LEARNINGS_DIR"
   cat >> "$LEARNINGS_DIR/LEARNINGS.md" << EOF

   ## Learning #$ITERATION

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
5. Output: `Learning #$ITERATION recorded (impact: $IMPACT)`

### status

```
/dev-forge:learn status
```

Show the current state of learnings:

```bash
DB=".dev-forge/dev-forge.db"
NEXT=$(sqlite3 "$DB" "SELECT COALESCE(MAX(iteration), 0) + 1 FROM learnings")
TOTAL=$(sqlite3 "$DB" "SELECT COUNT(*) FROM learnings")
echo "Next learning number : $NEXT"
echo "Total learnings      : $TOTAL"
echo ""
echo "Recent learnings:"
sqlite3 "$DB" "SELECT iteration, impact, date(created_at), mistake FROM learnings ORDER BY iteration DESC LIMIT 5" \
  | while IFS='|' read n impact date mistake; do
      printf "  #%-4s | %-8s | %s | %s\n" "$n" "$impact" "$date" "$mistake"
    done
```

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
