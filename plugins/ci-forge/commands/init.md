---
description: Install self-contained GitHub Actions CI workflows (marketplace-validate, repo-hygiene) into this repository
allowed-tools: Bash, Read, Write, Glob, AskUserQuestion
argument-hint: "[marketplace|hygiene|both]"
---
# /ci-forge:init

Install ready-to-run GitHub Actions workflows into the current repository's `.github/workflows/`. The workflow definitions are embedded in this command (see the Templates section below) — they are fully self-contained: no reusable-workflow references, no third-party actions beyond `actions/checkout` and `actions/setup-node`, and no secrets required.

**Profiles:**
- `marketplace` — `marketplace-validate.yml`: CI for Claude Code plugin marketplace repos (plugin validation, JSON syntax, marketplace completeness, version-consistency on PRs)
- `hygiene` — `repo-hygiene.yml`: generic hygiene (shellcheck, Conventional Commits PR title check)
- `both` — install both files

**Usage:**
- `/ci-forge:init` — detect the repo type and ask which profile(s) to install
- `/ci-forge:init both` — install both without asking

---

## Steps

### 1. Preflight

Confirm the current directory is inside a git repository:

```bash
git rev-parse --is-inside-work-tree
```

If not, print an error and STOP. Also check for a GitHub remote (`git remote get-url origin`); if there is none, warn that the workflows will only run once the repo is pushed to GitHub, but continue.

### 2. Detect repo type and choose profile(s)

If `$ARGUMENTS` contains `marketplace`, `hygiene`, or `both`, use that and skip the question.

Otherwise, detect: if `.claude-plugin/marketplace.json` exists, this is a plugin marketplace repo — recommend **both**. If not, recommend **hygiene** only (the marketplace jobs would fail on a non-marketplace repo). Ask the user with AskUserQuestion, marking the detected recommendation.

### 3. Check for collisions

For each file to be installed (`.github/workflows/marketplace-validate.yml` and/or `.github/workflows/repo-hygiene.yml`):

- If the target file does not exist, it will be created.
- If it exists, show a diff between the existing file and the template below (`diff <existing> <new>` style), and ask the user whether to overwrite. This is also the **update flow**: after updating the ci-forge plugin, re-run `/ci-forge:init` and review the diff.

### 4. Write the selected workflow file(s)

Create `.github/workflows/` if needed, then write each selected template below **verbatim** to its target path.

### 5. Report

Tell the user:

- which files were written
- that nothing has been committed — suggest:
  ```bash
  git add .github/workflows/ && git commit -m "ci: add ci-forge workflows" && git push
  ```
- the workflows trigger on pushes and PRs to `main`; no secrets are needed
- to update later: `/plugin update ci-forge` (or the `/plugin` UI), then re-run `/ci-forge:init` and review the diff

---

## Templates

### Template: `.github/workflows/marketplace-validate.yml` (profile: marketplace)

```yaml
# marketplace-validate — CI for Claude Code plugin marketplace repositories.
#
# Jobs:
#   plugin-validate     : `claude plugin validate .` (official validator, no API key needed)
#   json-syntax         : jq syntax check on marketplace.json / plugin.json / hooks.json
#   completeness        : every plugins/<dir>/ must have a marketplace.json entry
#   version-consistency : on PRs, plugin changes must bump the version in BOTH the
#                         plugin README (### vX.Y.Z) and the root README ([name] `vX.Y.Z`)
#
# Distributed by the ci-forge plugin (/ci-forge:init). Self-contained — no external
# workflow references, no secrets required.
name: marketplace-validate

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  plugin-validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Install Claude Code CLI
        run: npm install -g @anthropic-ai/claude-code
      - name: Validate marketplace
        run: claude plugin validate .

  json-syntax:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check JSON syntax
        run: |
          fail=0
          for f in .claude-plugin/marketplace.json \
                   plugins/*/.claude-plugin/plugin.json \
                   plugins/*/hooks/hooks.json; do
            [ -e "$f" ] || continue
            if jq empty "$f" 2>/dev/null; then
              echo "OK   $f"
            else
              echo "::error file=$f::invalid JSON"
              fail=1
            fi
          done
          exit "$fail"

  completeness:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Every plugins/<dir> has a marketplace entry
        run: |
          fail=0
          sources=$(jq -r '.plugins[].source' .claude-plugin/marketplace.json)
          names=$(jq -r '.plugins[].name' .claude-plugin/marketplace.json)
          for d in plugins/*/; do
            p=$(basename "$d")
            if echo "$sources" | grep -qx "./plugins/$p"; then
              echo "OK   $p (matched by source)"
              continue
            fi
            if echo "$names" | grep -qx "$p"; then
              echo "OK   $p (matched by name)"
              continue
            fi
            echo "::error::plugins/$p has no entry in .claude-plugin/marketplace.json"
            fail=1
          done
          exit "$fail"

  version-consistency:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - name: Version bump check vs base branch
        run: |
          BASE="origin/$GITHUB_BASE_REF"
          git fetch -q origin "$GITHUB_BASE_REF"

          CHANGED=$(git diff --name-only "$BASE"...HEAD)
          CHANGED_PLUGINS=$(echo "$CHANGED" \
            | grep '^plugins/' \
            | grep -v '^plugins/[^/]*/README\.md$' \
            | sed 's|^plugins/\([^/]*\)/.*|\1|' \
            | sort -u || true)

          errors=0
          for plugin in $CHANGED_PLUGINS; do
            plugin_readme="plugins/$plugin/README.md"

            # 0. Skip if the entire plugin is being removed
            DELETED=$(git diff --diff-filter=D --name-only "$BASE"...HEAD)
            if echo "$DELETED" | grep -q "^${plugin_readme}$"; then
              echo "OK   $plugin — removed from repository (version check skipped)."
              continue
            fi

            # 1. Plugin README must be changed too (unless plugin.json is being
            #    synced to a version already present in the base README)
            PLUGIN_JSON="plugins/$plugin/.claude-plugin/plugin.json"
            BASE_README_VER=$(git show "$BASE:${plugin_readme}" 2>/dev/null \
              | grep -oE '### v[0-9]+\.[0-9]+\.[0-9]+' | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || true)
            HEAD_PLUGIN_JSON_VER=$(grep -oE '"version"[[:space:]]*:[[:space:]]*"[^"]*"' "$PLUGIN_JSON" 2>/dev/null \
              | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || true)

            if ! echo "$CHANGED" | grep -q "^${plugin_readme}$"; then
              if [ -n "$BASE_README_VER" ] && [ "$HEAD_PLUGIN_JSON_VER" = "$BASE_README_VER" ]; then
                echo "OK   $plugin v$HEAD_PLUGIN_JSON_VER — plugin.json synced to pre-bumped README version."
                continue
              fi
              echo "::error::$plugin: $plugin_readme is not updated in this PR. Bump the version and update it."
              errors=$((errors + 1))
              continue
            fi

            # 2. Plugin README version must have changed vs base
            NEW_VER=$(grep -oE '### v[0-9]+\.[0-9]+\.[0-9]+' "$plugin_readme" 2>/dev/null \
              | head -1 | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || true)
            OLD_VER="$BASE_README_VER"

            if [ -z "$NEW_VER" ]; then
              echo "::error::$plugin: could not detect a '### vX.Y.Z' heading in $plugin_readme."
              errors=$((errors + 1))
              continue
            fi
            if [ "$NEW_VER" = "$OLD_VER" ]; then
              echo "::error::$plugin: version is still v$OLD_VER in $plugin_readme — bump it."
              errors=$((errors + 1))
              continue
            fi

            # 3. Root README must be changed too
            if ! echo "$CHANGED" | grep -q '^README\.md$'; then
              echo "::error::$plugin: bumped to v$NEW_VER but root README.md is not updated."
              errors=$((errors + 1))
              continue
            fi

            # 4. Root README must show the new version
            ROOT_VER=$(grep -oE "\[${plugin}\].*\`v[0-9]+\.[0-9]+\.[0-9]+\`" README.md \
              | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1 || true)
            if [ "$ROOT_VER" != "$NEW_VER" ]; then
              echo "::error::$plugin: root README.md shows v${ROOT_VER:-?}, expected v$NEW_VER."
              errors=$((errors + 1))
              continue
            fi

            echo "OK   $plugin v$NEW_VER — both READMEs updated."
          done

          if [ "$errors" -gt 0 ]; then
            exit 1
          fi
          echo "version-consistency: all checks passed."
```

### Template: `.github/workflows/repo-hygiene.yml` (profile: hygiene)

```yaml
# repo-hygiene — generic repository hygiene CI.
#
# Jobs:
#   shellcheck : lint all tracked shell scripts (*.sh plus extensionless scripts
#                detected by a first-line bash/sh shebang), excluding archive/
#   pr-title   : on PRs, the title must follow Conventional Commits
#                (<type>: <subject> with type feat|fix|docs|chore|refactor|ci)
#
# Distributed by the ci-forge plugin (/ci-forge:init). Self-contained — no external
# workflow references, no secrets required.
name: repo-hygiene

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

permissions:
  contents: read

jobs:
  shellcheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Shellcheck shell scripts
        run: |
          targets=$(
            {
              git ls-files '*.sh' | grep -Ev '^archive/' || true
              # extensionless scripts: detect by first-line shebang only
              # (grepping whole files would false-positive on code samples in .md)
              git ls-files | grep -v '\.sh$' | grep -Ev '^archive/' \
                | xargs -r awk 'FNR==1 && /^#!.*(bash|sh)/ {print FILENAME}'
            } | sort -u
          )
          if [ -z "$targets" ]; then
            echo "No shell scripts found."
            exit 0
          fi
          echo "Checking:"
          echo "$targets"
          echo "$targets" | xargs shellcheck

  pr-title:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - name: Check Conventional Commits PR title
        env:
          TITLE: ${{ github.event.pull_request.title }}
        run: |
          if echo "$TITLE" | grep -qE '^(feat|fix|docs|chore|refactor|ci): .+'; then
            echo "OK: $TITLE"
          else
            echo "::error::PR title must match '<type>: <subject>' with type feat|fix|docs|chore|refactor|ci"
            echo "Got: $TITLE"
            exit 1
          fi
```
