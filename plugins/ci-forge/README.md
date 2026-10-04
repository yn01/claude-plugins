# ci-forge

Install self-contained GitHub Actions CI into any repository with one command. No reusable-workflow references, no third-party actions beyond `actions/checkout`, no secrets.

```
/plugin install ci-forge
```

## How it works

`/ci-forge:init` writes complete workflow files into your repo's `.github/workflows/`. The workflow definitions are embedded in the command itself, so installed repos have **zero runtime dependency** on this plugin or any central repository — the copied YAML is all there is.

This repository ([yn01/claude-plugins](https://github.com/yn01/claude-plugins)) dogfoods the same workflows in its own `.github/workflows/`.

## Profiles

| Profile | File | Jobs |
|---|---|---|
| `marketplace` | `marketplace-validate.yml` | `claude plugin validate --strict` on the marketplace and each plugin (optional `.github/validate-strict-exempt.txt`) / JSON syntax (`jq`) on marketplace.json, plugin.json, hooks.json / marketplace completeness (every `plugins/<dir>/` listed) / version-consistency on PRs (plugin changes must bump the version in both the plugin README and the root README) |
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

### v1.1.1

- `marketplace-validate`: the Claude Code CLI is now installed with the native installer (`curl -fsSL https://claude.ai/install.sh | bash`, unpinned latest release; `~/.local/bin` added to `GITHUB_PATH`) instead of `npm install -g`, because the npm package lagged behind (2.1.197 vs 2.1.285) and CI validated with an outdated validator. The `actions/setup-node` step is dropped. Re-run `/ci-forge:init` to pick this up.

### v1.1.0

- `marketplace-validate`: the `plugin-validate` job now runs `claude plugin validate --strict` on the marketplace and on every `plugins/<dir>/` (so warnings such as unknown hook events fail the build) and prints a per-plugin PASS/EXEMPT/FAIL summary. The Claude Code CLI is installed unpinned (latest) and its version is printed, since results can change with new Claude Code releases.
- Optional `.github/validate-strict-exempt.txt` allowlist (`name  # reason`, reason required). Exempt plugins are known failures with a deferred fix: they are reported as `EXEMPT` (validator output in a collapsed log group) and never block the job, but the job fails if an exempt plugin starts passing `--strict` (stale exemption). No file means no exemptions. Re-run `/ci-forge:init` to pick this up.

### v1.0.0

- Initial release: `/ci-forge:init` with `marketplace` (plugin validation, JSON syntax, completeness, version-consistency) and `hygiene` (shellcheck, PR title) profiles.
