# git-flow

Git workflow guardrails for Claude Code: keep commits off `main`, gate every pull request behind a code review, and configure a privacy-preserving git identity — all as one installable plugin.

```
/plugin install git-flow
```

## Features

- **Branch-first guard (hook)** — an advisory warning whenever you `git commit` directly on `main`/`master`, nudging you to branch first. Never blocks the commit.
- **Review-gated PR (`/git-flow:pr`)** — runs `/code-review` on your diff *before* the PR is created; stops for your decision if anything is flagged, then generates a consistent PR body and opens the PR.
- **Noreply identity (`/git-flow:setup-git-identity`)** — sets your commit email to your GitHub `<id>+<login>@users.noreply.github.com` address so your real email never leaks into commit metadata.

## Commands

| Command | Purpose |
|---|---|
| `/git-flow:pr [issue-number]` | Preflight (branch/commit) → `/code-review` gate → generate PR body → push & `gh pr create`. Pass an issue number to add `Closes #N`. |
| `/git-flow:setup-git-identity [--local]` | Configure `user.email` to your GitHub noreply address via `gh api`. Global by default; `--local` scopes it to the current repo. Idempotent. |

## Branch naming convention

Use `<type>/<slug>`, optionally embedding an issue number as `<type>/<issue>-<slug>`:

```
feat/add-login-form
fix/123-hook-paths
docs/update-readme
```

Types: `feat`, `fix`, `docs`, `chore`, `refactor`.

## Topic granularity

Keep scope uniform across projects by anchoring to issues:

> **1 Issue = 1 branch = 1 PR**

Split into separate branches/PRs when any of these **split signals** appear:

- The change needs "and" to describe two unrelated things.
- It mixes unrelated `<type>`s (a feature *and* an unrelated fix).
- It cannot be reverted as a single unit.
- It touches more than ~10 files (soft cap).

## Hook behavior

The branch-first guard is **advisory only** — it prints a warning on `git commit` while on `main`/`master` and always exits 0, so it never blocks your work. It stays silent outside git repositories and on detached HEAD.

## GitHub email privacy

`/git-flow:setup-git-identity` configures the client side. For a complete setup, also enable, in **GitHub → Settings → Emails**:

- **Keep my email addresses private**
- **Block command line pushes that expose my email** (server-side backstop)

## PR template

Plugins can't install files into your project, so `/git-flow:pr` generates the PR body (概要 / 変更内容 / 検証手順) directly. If you also want a template for human-authored PRs, copy that same structure into your repo's `.github/PULL_REQUEST_TEMPLATE.md`.

## Roadmap

Planned for future releases:

- `/git-flow:sync` — fetch and rebase the latest `main`, with conflict guidance.
- `/git-flow:commit` — standalone Conventional Commits message generation.
- Commit-message format guard hook.

## Changelog

### v1.0.0

- Initial release: main-branch commit guard hook, `/git-flow:pr` with pre-PR code-review gate, `/git-flow:setup-git-identity`.
