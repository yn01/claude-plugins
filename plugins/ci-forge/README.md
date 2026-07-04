# ci-forge

Install self-contained GitHub Actions CI into any repository with one command. No reusable-workflow references, no third-party actions beyond `actions/checkout` and `actions/setup-node`, no secrets.

```
/plugin install ci-forge
```

## How it works

`/ci-forge:init` writes complete workflow files into your repo's `.github/workflows/`. The workflow definitions are embedded in the command itself, so installed repos have **zero runtime dependency** on this plugin or any central repository — the copied YAML is all there is.

This repository ([yn01/claude-plugins](https://github.com/yn01/claude-plugins)) dogfoods the same workflows in its own `.github/workflows/`.

## Profiles

| Profile | File | Jobs |
|---|---|---|
| `marketplace` | `marketplace-validate.yml` | `claude plugin validate .` / JSON syntax (`jq`) on marketplace.json, plugin.json, hooks.json / marketplace completeness (every `plugins/<dir>/` listed) / version-consistency on PRs (plugin changes must bump the version in both the plugin README and the root README) |
| `hygiene` | `repo-hygiene.yml` | shellcheck on all tracked shell scripts (including extensionless scripts detected by first-line shebang, `archive/` excluded) / Conventional Commits PR title check (`feat|fix|docs|chore|refactor|ci: ...`) |

The `marketplace` profile is meant for Claude Code plugin marketplace repositories. `hygiene` works anywhere.

## Usage

```
/ci-forge:init            # detect repo type, ask which profile(s) to install
/ci-forge:init both       # install both without asking
/ci-forge:init hygiene    # generic repos
/ci-forge:init marketplace
```

The command detects a marketplace repo by the presence of `.claude-plugin/marketplace.json` and recommends profiles accordingly. If a target file already exists, it shows a diff and asks before overwriting.

After installation, commit and push:

```bash
git add .github/workflows/ && git commit -m "ci: add ci-forge workflows" && git push
```

Workflows trigger on pushes and pull requests to `main`.

## Updating

Installed workflows are snapshots — they do not change when this plugin updates. To pick up new workflow versions:

1. `/plugin update ci-forge` (or use the `/plugin` UI)
2. Re-run `/ci-forge:init` — it diffs the embedded templates against your installed files and asks before overwriting

## Design notes

- **Why copies instead of `uses:` references?** A central reusable workflow would make every consuming repo depend on one repository at runtime. Copies keep each repo self-contained and pin behavior explicitly; updates are opt-in via the flow above.
- The `pr-title` job reads the title through an environment variable (never inline interpolation) to avoid script injection from PR titles.
- The version-consistency job is a server-side port of this repository's local `hooks/pre-commit` check, diffing against the PR base branch.

## Changelog

### v1.0.0

- Initial release: `/ci-forge:init` with `marketplace` (plugin validation, JSON syntax, completeness, version-consistency) and `hygiene` (shellcheck, PR title) profiles.
