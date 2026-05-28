---
description: Add a new knowledge page to the dev-guide knowledge base
allowed-tools: Read, Write, Bash, Glob
argument-hint: "<category> \"<title>\""
---
# /dev-guide:add

Add a new knowledge page to `.dev-guide/` in the current project.

**Usage:** `/dev-guide:add <category> "<title>"`

- `category`: one of `guideline`, `decision`, `concept`
- `title`: a short, descriptive title for the page

## Steps

### 1. Validate arguments

Check that both `<category>` and `<title>` are provided. If not, print usage and stop:

```
Usage: /dev-guide:add <category> "<title>"
  category: guideline | decision | concept
  title:    short descriptive title

Examples:
  /dev-guide:add guideline "API Design Rules"
  /dev-guide:add decision "Use JWT for Authentication"
  /dev-guide:add concept "Tenant"
```

Validate that `<category>` is one of `guideline`, `decision`, `concept`. If not, print an error and stop.

### 2. Ensure .dev-guide directories exist

```bash
mkdir -p .dev-guide/guidelines .dev-guide/decisions .dev-guide/concepts
```

If `.dev-guide/index.md` does not exist yet, create it with the following content:

```markdown
# dev-guide Index

## Guidelines

## Decisions

## Concepts
```

### 3. Generate the filename

Convert `<title>` to a kebab-case filename:
- Lowercase all characters
- Replace spaces and special characters with hyphens
- Remove leading/trailing hyphens
- Append `.md`

For `decision` category, prepend `adr-NNN-` where `NNN` is the next available ADR number (zero-padded to 3 digits). Determine `NNN` by counting existing files in `.dev-guide/decisions/` that match the pattern `adr-*.md`, then adding 1.

Examples:
- `guideline` + `"API Design Rules"` → `guidelines/api-design-rules.md`
- `decision` + `"Use JWT for Authentication"` → `decisions/adr-001-use-jwt-for-authentication.md`
- `concept` + `"Tenant"` → `concepts/tenant.md`

### 4. Copy the template

Locate the appropriate template from the plugin directory:

```bash
PLUGIN_DIR="$(claude plugin path dev-guide)"
```

- `guideline` → `$PLUGIN_DIR/templates/guideline.md`
- `decision`  → `$PLUGIN_DIR/templates/decision.md`
- `concept`   → `$PLUGIN_DIR/templates/concept.md`

Copy the template to the target path. For the `decision` category, replace `ADR-XXX` in the template with the actual ADR number (e.g. `ADR-001`).

If the target file already exists, print an error and stop — do not overwrite.

### 5. Update index.md

Append an entry under the appropriate section heading in `.dev-guide/index.md`:

```markdown
- [<Title>](<relative-path>) — <YYYY-MM-DD>
```

The date is today's date (`date +%Y-%m-%d`).

The relative path is relative to `.dev-guide/`, e.g. `guidelines/api-design-rules.md`.

If the section heading does not exist in `index.md`, add it before appending.

### 6. Print confirmation

```
Created: .dev-guide/<category>s/<filename>.md
Updated: .dev-guide/index.md

Open the file and fill in the content. The template includes prompts for each section.
```
