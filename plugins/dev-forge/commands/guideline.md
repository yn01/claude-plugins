---
description: Add and list project guidelines for dev-forge agents
allowed-tools: Read, Write, Bash, Glob
argument-hint: "<subcommand> [args]"
---
# /dev-forge:guideline

Manage project guidelines stored in `.dev-forge/guidelines/`. This is the **human-managed zone** — LLM agents do not auto-update guidelines. Guidelines are referenced by the Reviewer agent during code review.

## Subcommands

### add

```
/dev-forge:guideline add "<title>" "<content>"
```

Or to import from a file:
```
/dev-forge:guideline add --file <path>
```

1. Generate a slug from the title
2. Write to `.dev-forge/guidelines/<slug>.md`:
   ```bash
   GUIDELINES_DIR=".dev-forge/guidelines"
   mkdir -p "$GUIDELINES_DIR"
   cat > "$GUIDELINES_DIR/$SLUG.md" << EOF
   ---
   title: $TITLE
   created_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
   author: user
   ---

   $CONTENT
   EOF
   echo "Guideline '$TITLE' added -> $GUIDELINES_DIR/$SLUG.md"
   ```

### list

```
/dev-forge:guideline list
```

```bash
GUIDELINES_DIR=".dev-forge/guidelines"
if [ ! -d "$GUIDELINES_DIR" ] || [ -z "$(ls -A "$GUIDELINES_DIR" 2>/dev/null)" ]; then
  echo "No guidelines found. Add one with: /dev-forge:guideline add \"<title>\" \"<content>\""
  exit 0
fi

for file in "$GUIDELINES_DIR"/*.md; do
  title=$(grep "^title:" "$file" | sed 's/title: //')
  created=$(grep "^created_at:" "$file" | sed 's/created_at: //')
  echo "$title ($created) -> $file"
done
```
