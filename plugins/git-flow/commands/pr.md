---
description: Create a pull request with a pre-PR code review gate — review the diff, resolve or waive findings, then push and open the PR
allowed-tools: Bash, Read, Grep, Glob, Skill
argument-hint: "[issue-number]"
---
# /git-flow:pr

Open a pull request the right way: branch-checked, committed, **reviewed before it leaves your machine**, and described in a consistent format. The review gate runs `/code-review` on the local diff and stops for your decision if anything is flagged — no PR is created until the diff is clean or you explicitly waive the findings.

**Usage:**
- `/git-flow:pr` — create a PR for the current branch
- `/git-flow:pr <issue-number>` — link the PR to an issue (adds `Closes #N`)

---

## Steps

### 1. Parse arguments

`$ARGUMENTS` may contain an issue number (e.g. `123` or `#123`).

- If present, strip any leading `#` and remember it as `N`. It will be used for `Closes #N` and to enrich the PR context: run `gh issue view N --json title,body` to pull the issue title/description (ignore failures — the issue may be private or `gh` may lack access).
- Run the review at **normal depth by default**. Only use `ultra` depth if the user explicitly asked for it in their request.

### 2. Preflight — branch check

```bash
git branch --show-current
```

If the current branch is `main` or `master`, **STOP**. Do not commit or create a PR from the default branch (rule: 1 Issue = 1 branch = 1 PR).

- Summarize the pending changes and propose a topic branch name following the convention `<type>/<slug>` — or `<type>/<N>-<slug>` when an issue number was given (types: `feat`, `fix`, `docs`, `chore`, `refactor`).
- After the user agrees, create and switch to it with `git switch -c <branch>`, then continue.

### 3. Preflight — uncommitted changes

```bash
git status --porcelain
```

If the working tree is dirty:

1. Summarize what changed.
2. Propose a Conventional Commits message (`<type>: <summary>`).
3. Commit with the standard footer once the user is happy:

   ```bash
   git commit -m "$(cat <<'EOF'
   <type>: <summary>

   Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
   EOF
   )"
   ```

### 4. Scope sanity check (advisory)

```bash
git diff main...HEAD --stat
```

Check the diff against the **split signals**. Suggest splitting into multiple branches/PRs if any apply — but let the user decide, do not block:

- The change needs "and" to describe two unrelated things.
- It mixes unrelated `<type>`s (e.g. a feature *and* an unrelated fix).
- It cannot be reverted as a single unit.
- It touches more than ~10 files (soft cap).

### 5. Review gate (blocking)

Invoke the `code-review` skill on the local diff (normal depth by default; `ultra` only if the user explicitly asked).

- **No findings** → continue to step 6.
- **Findings** → **STOP** and present them. Ask the user how to proceed:
  - **fix** — apply the fixes, commit them (footer as above), then re-run the review from the top of this step.
  - **waive** — proceed to create the PR; note the waived findings in the PR body under a short "Waived review findings" list.

  Never create the PR before the user has decided.

### 6. Generate the PR title and body

- **Title:** `<type>: <concise summary>` describing the branch's primary change.
- **Body:** use these sections (Japanese headers, matching the project convention):

  ```
  ## 概要
  <what this PR does and why, 1–3 sentences>

  ## 変更内容
  - <bulleted changes, derived from the commits and diff>

  ## 検証手順
  1. <how a reviewer verifies this end to end>

  Closes #N        ← only when an issue number was given

  🤖 Generated with [Claude Code](https://claude.com/claude-code)
  ```

Show the draft to the user before creating the PR.

### 7. Push and create

```bash
git push -u origin "$(git branch --show-current)"
gh pr create --base main --title "<title>" --body "$(cat <<'EOF'
<body>
EOF
)"
```

Print the resulting PR URL.

### 8. Optional — inline review comments

If the user wants the review findings recorded on the PR itself, tell them they can run:

```
/code-review --comment
```

to post the findings as inline comments on the pull request.
