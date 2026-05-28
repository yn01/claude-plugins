---
description: Manually inject topic-specific knowledge pages into the current context
allowed-tools: Read, Bash, Glob
argument-hint: "<topic>"
---
# /dev-guide:inject

Manually inject knowledge pages related to a specific topic into the current agent context.

**Usage:** `/dev-guide:inject <topic>`

Example: `/dev-guide:inject "authentication"`

Use this command when the automatic session-start injection did not include a page you need right now — for example, because the topic wasn't obviously relevant at session start but is needed for the current task.

## Steps

### 1. Check that .dev-guide exists

If `.dev-guide/` does not exist, print:

```
No dev-guide knowledge base found in this project.
Run /dev-guide:add to create your first page.
```

Then stop.

### 2. Search for relevant pages

Read every `.md` file under `.dev-guide/guidelines/`, `.dev-guide/decisions/`, and `.dev-guide/concepts/`. Find pages whose title or content is related to `<topic>`.

Cast a wide net — if a page is partially relevant, include it.

### 3. Inject and display

If relevant pages are found, read each one in full and display them in the context:

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

If no relevant pages are found, print:

```
No knowledge pages found for topic: "<topic>"

Try /dev-guide:query "<topic>" to search with a full question, or
/dev-guide:list to browse all available pages.
```
