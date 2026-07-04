---
description: Manage the project knowledge base — add, list, search, and inject guidelines, decisions, and concepts
allowed-tools: Read, Write, Bash, Glob
argument-hint: "<subcommand> [args]"
---
# /dev-forge:guide

Manage the human-authored knowledge base in `.dev-forge/guide/`. Knowledge pages capture guidelines, design decisions, and project-specific concepts so that agents can reference them during development.

**Subcommands:**
- `/dev-forge:guide add <category> "<title>"` — create a new knowledge page
- `/dev-forge:guide list [category]` — list registered pages
- `/dev-forge:guide query <question>` — search with a natural language question
- `/dev-forge:guide inject <topic>` — load topic-specific pages into context

---

## /dev-forge:guide add

**Usage:** `/dev-forge:guide add <category> "<title>"`

- `category`: one of `guideline`, `decision`, `concept`
- `title`: a short, descriptive title for the page

### Steps

#### 1. Validate arguments

Check that both `<category>` and `<title>` are provided. If not, print usage and stop:

```
Usage: /dev-forge:guide add <category> "<title>"
  category: guideline | decision | concept
  title:    short descriptive title

Examples:
  /dev-forge:guide add guideline "API Design Rules"
  /dev-forge:guide add decision "Use JWT for Authentication"
  /dev-forge:guide add concept "Tenant"
```

Validate that `<category>` is one of `guideline`, `decision`, `concept`. If not, print an error and stop.

#### 2. Ensure .dev-forge/guide directories exist

```bash
mkdir -p .dev-forge/guide/guidelines .dev-forge/guide/decisions .dev-forge/guide/concepts
```

If `.dev-forge/guide/index.md` does not exist yet, create it with:

```markdown
# Guide Index

## Guidelines

## Decisions

## Concepts
```

#### 3. Generate the filename

Convert `<title>` to a kebab-case filename:
- Lowercase all characters
- Replace spaces and special characters with hyphens
- Remove leading/trailing hyphens
- Append `.md`

For `decision` category, prepend `adr-NNN-` where `NNN` is the next available ADR number (zero-padded to 3 digits). Determine `NNN` by counting existing files in `.dev-forge/guide/decisions/` that match `adr-*.md`, then adding 1.

Examples:
- `guideline` + `"API Design Rules"` → `guidelines/api-design-rules.md`
- `decision` + `"Use JWT for Authentication"` → `decisions/adr-001-use-jwt-for-authentication.md`
- `concept` + `"Tenant"` → `concepts/tenant.md`

#### 4. Copy the template

Locate the plugin directory:

```bash
PLUGIN_DIR="$(claude plugin path dev-forge)"
```

- `guideline` → `$PLUGIN_DIR/templates/guide/guideline.md`
- `decision`  → `$PLUGIN_DIR/templates/guide/decision.md`
- `concept`   → `$PLUGIN_DIR/templates/guide/concept.md`

Copy the template to `.dev-forge/guide/<category>s/<filename>`. For `decision`, replace `ADR-XXX` in the template with the actual ADR number (e.g. `ADR-001`).

If the target file already exists, print an error and stop — do not overwrite.

#### 5. Update index.md

Append an entry under the appropriate section heading in `.dev-forge/guide/index.md`:

```markdown
- [<Title>](<relative-path>) — <YYYY-MM-DD>
```

The date is today's date. The relative path is relative to `.dev-forge/guide/`, e.g. `guidelines/api-design-rules.md`.

If the section heading does not exist in `index.md`, add it before appending.

#### 6. Print confirmation

```
Created: .dev-forge/guide/<category>s/<filename>.md
Updated: .dev-forge/guide/index.md

Open the file and fill in the content. The template includes prompts for each section.
```

---

## /dev-forge:guide list

**Usage:** `/dev-forge:guide list [category]`

- `category` (optional): `guideline`, `decision`, or `concept`. If omitted, all categories are shown.

### Steps

#### 1. Check that .dev-forge/guide exists

If `.dev-forge/guide/` does not exist, print:

```
No guide knowledge base found in this project.
Run /dev-forge:guide add to create your first page.
```

Then stop.

#### 2. Collect pages

For each relevant category directory, list all `.md` files. For each file, extract:

- **Title**: the first `# Heading` line
- **Category**: derived from the directory name
- **Last modified**: `date -r <file> +%Y-%m-%d` on macOS/Linux

#### 3. Display results

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

If no pages exist, print:

```
No knowledge pages found.
Run /dev-forge:guide add guideline|decision|concept "<title>" to add one.
```

---

## /dev-forge:guide query

**Usage:** `/dev-forge:guide query <question>`

Example: `/dev-forge:guide query "How should we handle API errors?"`

### Steps

#### 1. Check that .dev-forge/guide exists

If `.dev-forge/guide/` does not exist, print:

```
No guide knowledge base found in this project.
Run /dev-forge:guide add to create your first page.
```

Then stop.

#### 2. Read all knowledge pages

Read every `.md` file under `.dev-forge/guide/guidelines/`, `.dev-forge/guide/decisions/`, and `.dev-forge/guide/concepts/`.

#### 3. Find relevant pages

For each page, assess relevance to the question by reading its content. A page is relevant if it contains information that directly or indirectly addresses the question — including related concepts, constraints, or rationale.

#### 4. Display results

If relevant pages are found:

```
Found 2 relevant page(s) for: "How should we handle API errors?"

────────────────────────────────────────────────────────────────
[guideline] guidelines/error-handling-policy.md
────────────────────────────────────────────────────────────────

<full content of the page>

────────────────────────────────────────────────────────────────
[decision] decisions/adr-003-error-response-format.md
────────────────────────────────────────────────────────────────

<full content of the page>
```

If no relevant pages are found:

```
No relevant knowledge found for: "<question>"

You can add new pages with:
  /dev-forge:guide add guideline "<title>"
  /dev-forge:guide add decision "<title>"
  /dev-forge:guide add concept "<title>"
```

---

## /dev-forge:guide inject

**Usage:** `/dev-forge:guide inject <topic>`

Example: `/dev-forge:guide inject "authentication"`

Use this command when you need to load a specific topic into context — for example, before starting a task where that topic is relevant.

### Steps

#### 1. Check that .dev-forge/guide exists

If `.dev-forge/guide/` does not exist, print:

```
No guide knowledge base found in this project.
Run /dev-forge:guide add to create your first page.
```

Then stop.

#### 2. Search for relevant pages

Read every `.md` file under `.dev-forge/guide/guidelines/`, `.dev-forge/guide/decisions/`, and `.dev-forge/guide/concepts/`. Find pages whose title or content is related to `<topic>`. Cast a wide net — if a page is partially relevant, include it.

#### 3. Inject and display

If relevant pages are found:

```
Injecting 2 knowledge page(s) for topic: "authentication"

────────────────────────────────────────────────────────────────
[decision] decisions/adr-001-use-jwt-for-authentication.md
────────────────────────────────────────────────────────────────

<full content>

────────────────────────────────────────────────────────────────
[guideline] guidelines/api-design-rules.md
────────────────────────────────────────────────────────────────

<full content>

These pages are now in your context. Apply the guidance above to the current task.
```

If no relevant pages are found:

```
No knowledge pages found for topic: "<topic>"

Try /dev-forge:guide query "<topic>" to search with a full question, or
/dev-forge:guide list to browse all available pages.
```
