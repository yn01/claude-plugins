---
description: Search the dev-guide knowledge base with a natural language question
allowed-tools: Read, Bash, Glob
argument-hint: "<question>"
---
# /dev-guide:query

Search the `.dev-guide/` knowledge base for content relevant to a natural language question.

**Usage:** `/dev-guide:query <question>`

Example: `/dev-guide:query "How should we handle API errors?"`

## Steps

### 1. Check that .dev-guide exists

If `.dev-guide/` does not exist, print:

```
No dev-guide knowledge base found in this project.
Run /dev-guide:add to create your first page.
```

Then stop.

### 2. Read all knowledge pages

Read every `.md` file under `.dev-guide/guidelines/`, `.dev-guide/decisions/`, and `.dev-guide/concepts/`.

### 3. Find relevant pages

For each page, assess relevance to the question by reading its content. A page is relevant if it contains information that directly or indirectly addresses the question — including related concepts, constraints, or rationale that would inform an answer.

### 4. Display results

If relevant pages are found, print each one in full with a header showing its path and category:

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

If no relevant pages are found, print:

```
No relevant knowledge found for: "<question>"

You can add new pages with:
  /dev-guide:add guideline "<title>"
  /dev-guide:add decision "<title>"
  /dev-guide:add concept "<title>"
```
