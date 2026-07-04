---
description: Configure git user.email to your GitHub noreply address (<id>+<login>@users.noreply.github.com) via gh api
allowed-tools: Bash
argument-hint: "[--local]"
---
# /git-flow:setup-git-identity

Set your git commit email to the **GitHub-provided noreply address** so your real email is never exposed in commit metadata, while your commits still attribute correctly to your GitHub account. Idempotent — safe to run on any new machine or fresh clone.

**Usage:**
- `/git-flow:setup-git-identity` — configure globally (`git config --global`, default)
- `/git-flow:setup-git-identity --local` — configure only for the current repository

---

## Steps

### 1. Check prerequisites

```bash
gh auth status
```

If `gh` is not authenticated, tell the user to run `gh auth login` and **STOP**.

If `--local` was passed in `$ARGUMENTS`, confirm the current directory is inside a git repository:

```bash
git rev-parse --is-inside-work-tree
```

If not, print an error and STOP.

### 2. Fetch the GitHub identity

```bash
gh api user --jq '{login: .login, id: .id, name: .name}'
```

Build the noreply address:

```
EMAIL="<id>+<login>@users.noreply.github.com"
```

### 3. Idempotency check

Determine the scope flag: `--global` by default, or `--local` if requested.

```bash
git config <scope> user.email
```

If the existing value already equals `EMAIL`, report **"already configured"** and skip the write. Still check `user.name`: if it is empty, set it (step 4) to the GitHub `name`, falling back to `login`.

### 4. Apply

```bash
git config <scope> user.email "$EMAIL"
# only if user.name is currently unset:
git config <scope> user.name "<GitHub name or login>"
```

Never overwrite an existing `user.name`.

### 5. Report

Print the resulting identity and scope:

```
git identity configured (<scope>):
  user.name  = <name>
  user.email = <id>+<login>@users.noreply.github.com
```

Remind the user that the noreply address is only fully "push-safe" when GitHub's
**Settings → Emails → "Keep my email addresses private"** and
**"Block command line pushes that expose my email"** toggles are enabled — the
server-side backstop against accidentally committing with a real email.
