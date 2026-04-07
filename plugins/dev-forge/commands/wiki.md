---
description: Manage the dev-forge wiki knowledge base (ingest, query, lint)
allowed-tools: Read, Write, Bash, Glob, Grep
argument-hint: "<subcommand> [args]"
---
# /dev-forge:wiki

Manage the project wiki stored in `.dev-forge/wiki/`. Storage location is controlled by `devforge.yaml` `wiki.storage` setting (`local` or `obsidian`).

## Subcommands

### ingest

```
/dev-forge:wiki ingest <file-or-url>
```

1. Accept a local file path or URL
2. Read the content (use Bash `curl -s` for URLs, `cat` for files)
3. Generate a URL-safe slug from the title or filename
4. Write a wiki entry with frontmatter:
   ```bash
   WIKI_DIR=$(grep "wiki_folder:" devforge.yaml 2>/dev/null | awk '{print $2}' || echo ".dev-forge/wiki")
   mkdir -p "$WIKI_DIR"
   cat > "$WIKI_DIR/$SLUG.md" << EOF
   ---
   title: $TITLE
   source: $SOURCE
   ingested_at: $(date -u +%Y-%m-%dT%H:%M:%SZ)
   tags: []
   ---

   $CONTENT_SUMMARY
   EOF
   ```
5. If `wiki.storage: obsidian` is set in `devforge.yaml` and `obsidian_vault` is non-empty, copy the file to the configured vault path
6. Update `.dev-forge/wiki/index.md` by appending the new entry

### query

```
/dev-forge:wiki query <search terms>
```

Search the wiki directory for matching content:

```bash
WIKI_DIR=".dev-forge/wiki"
grep -r "$QUERY" "$WIKI_DIR" --include="*.md" -l | while read file; do
  echo "$file"
  grep -n "$QUERY" "$file" | head -3
  echo ""
done
```

### lint

```
/dev-forge:wiki lint
```

Scan all wiki files for issues:

```bash
WIKI_DIR=".dev-forge/wiki"
errors=0

for file in "$WIKI_DIR"/**/*.md "$WIKI_DIR"/*.md; do
  [ -f "$file" ] || continue

  # Check for frontmatter
  if ! head -1 "$file" | grep -q "^---"; then
    echo "WARNING: Missing frontmatter: $file"
    ((errors++))
  fi

  # Check for empty files
  if [ ! -s "$file" ]; then
    echo "WARNING: Empty file: $file"
    ((errors++))
  fi
done

echo "Lint complete. Issues found: $errors"
```
