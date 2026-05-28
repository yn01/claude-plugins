---
description: List registered knowledge pages in the dev-guide knowledge base
allowed-tools: Read, Bash, Glob
argument-hint: "[category]"
---
# /dev-guide:list

List all knowledge pages registered in `.dev-guide/`.

**Usage:** `/dev-guide:list [category]`

- `category` (optional): `guideline`, `decision`, or `concept`. If omitted, all categories are shown.

## Steps

### 1. Check that .dev-guide exists

If `.dev-guide/` does not exist in the current directory, print:

```
No dev-guide knowledge base found in this project.
Run /dev-guide:add to create your first page.
```

Then stop.

### 2. Collect pages

For each relevant category directory (`guidelines/`, `decisions/`, `concepts/`), list all `.md` files. For each file, extract:

- **Title**: read the first `# Heading` line from the file
- **Category**: derived from the directory name (strip trailing `s`: `guidelines` → `guideline`, etc.)
- **Last modified**: use the file's modification date (`date -r <file> +%Y-%m-%d` on macOS/Linux)

If no files exist in a category, skip that category.

### 3. Display results

Print a formatted table grouped by category:

```
Guidelines
──────────────────────────────────────────────
  API Design Rules                  2026-05-29
  Error Handling Policy             2026-05-28

Decisions
──────────────────────────────────────────────
  ADR-001: Use JWT for Authentication  2026-05-27

Concepts
──────────────────────────────────────────────
  Tenant                            2026-05-26

Total: 4 pages
```

If no pages exist at all, print:

```
No knowledge pages found.
Run /dev-guide:add guideline|decision|concept "<title>" to add one.
```
