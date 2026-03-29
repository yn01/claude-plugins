# genpptx

A Claude Code plugin that generates PowerPoint presentations from content files (meeting notes, memos).

## Overview

`genpptx` wraps the PPTX generation system so you can use it seamlessly from Claude Code.
Just provide a content file and the plugin automatically designs a story-driven slide structure, generates a `spec.yaml`, and produces `.pptx` + `.html` output — end to end.

## Requirements

- **Node.js 18+**

The generation scripts and dependencies are bundled with the plugin. No project-side setup is needed — `npm install` runs automatically on first use.

## Installation

```
/plugin marketplace add yn01/claude-plugins
/plugin install genpptx
```

## Commands

### `/genpptx:create` — Generate PPTX from content (main)

The primary command. Provide a content file and it handles everything from slide design to generation.

```
/genpptx:create output/my-project/content.md
/genpptx:create output/my-project/content.md --theme corporate-yellow
```

**What happens:**
1. Reads the content file
2. `slide-designer` agent designs a story-driven slide structure
3. Generates `output/<project-name>/spec.yaml`
4. Runs the bundled `generate.mjs` to produce PPTX and HTML
5. Reports the output file paths

---

### `/genpptx:generate` — Generate PPTX from spec.yaml

Use this after manually creating or editing a `spec.yaml`.

```
/genpptx:generate output/my-project/spec.yaml
/genpptx:generate output/my-project/spec.yaml --skip-html
/genpptx:generate output/my-project/spec.yaml --skip-images
```

---

### `/genpptx:catalog` — Generate layout catalog

Generates PPTX+HTML samples of all 10 layouts. Useful for previewing themes or verifying a new theme.

```
/genpptx:catalog
/genpptx:catalog --theme corporate-yellow
```

Output: `output/catalog/catalog-<theme-name>.pptx` / `.html`

---

### `/genpptx:read` — Read an existing PPTX or PDF

Reads and displays the content of an existing PPTX or PDF file. Useful for review and revision.

```
/genpptx:read output/my-project/presentation.pptx
/genpptx:read refs/sample.pptx
/genpptx:read refs/proposal.pdf
/genpptx:read refs/report.pdf
```

---

### `/genpptx:theme` — Extract theme from PPTX or PDF

Extracts design tokens (colors, fonts) from an existing PPTX or PDF and generates a theme file skeleton.

For PPTX, tokens are extracted programmatically from the file's XML. For PDF, Claude visually analyzes the document and estimates colors and fonts — results are approximate and should be reviewed before use.

```
/genpptx:theme refs/sample.pptx my-theme
/genpptx:theme refs/corporate.pptx corporate-blue
/genpptx:theme refs/brand-guide.pdf brand-colors
/genpptx:theme refs/proposal.pdf proposal-theme
```

Output: `themes/<theme-name>.mjs` in your project (auto-loaded at runtime — no registration needed)

---

## Available Layouts

| Layout | Use case |
|--------|----------|
| `cover` | Title slide (one per presentation) |
| `section` | Section divider |
| `content` | Key message + bullet points (default) |
| `two-column` | Before/After or A vs B comparison |
| `table` | Numeric or spec comparison (up to 6 cols × 8 rows) |
| `chart` | Time-series or ratio data (bar/line/pie/doughnut) |
| `image-text` | Image with description |
| `image-full` | Full-bleed image |
| `summary` | Section summary / key takeaways |
| `closing` | Final slide (one per presentation) |

## Workflow Examples

### From content.md to PPTX (recommended)

```
1. Create output/my-project/content.md (paste in meeting notes or memos as-is)

2. /genpptx:create output/my-project/content.md
   → slide-designer designs the structure
   → output/my-project/spec.yaml is generated
   → output/my-project/presentation.pptx + .html are generated

3. Open output/my-project/presentation.html in a browser to review

4. If edits are needed, update output/my-project/spec.yaml and run:
   /genpptx:generate output/my-project/spec.yaml
```

### Adding a new theme (from PPTX or PDF)

```
1. /genpptx:theme refs/sample.pptx my-theme     # from PPTX (programmatic extraction)
   /genpptx:theme refs/brand-guide.pdf my-theme  # from PDF (visual estimation)
   → themes/my-theme.mjs is generated in your project

2. Review and adjust colors/fonts in themes/my-theme.mjs
   (especially important when extracted from PDF — values are approximate)

3. /genpptx:catalog --theme my-theme
   → Preview the design in output/catalog/catalog-my-theme.pptx
```

Theme files in `themes/` are loaded automatically at runtime. No registration needed.
They persist in your project and survive plugin updates.

## Changelog

### v1.4.1 — 2026-03-30
- Fix: `/genpptx:theme` (PPTX extraction) generated a theme file with `import base from "./base.mjs"` which failed silently because `base.mjs` does not exist in the project's `themes/` directory — generated theme is now fully standalone

### v1.4.0 — 2026-03-28
- Custom themes are now saved to `themes/` in the user's project instead of the plugin cache — survives plugin updates, can be committed to git
- `generate.mjs` and `catalog.mjs` auto-load any `.mjs` files in `themes/` at runtime (no manual registration needed)
- `/genpptx:theme` output path updated to `themes/<name>.mjs` (both PPTX and PDF modes)

### v1.3.0 — 2026-03-28
- Bundle generation scripts (`src/`, `package.json`) into the plugin — no project-side setup required
- Commands auto-detect plugin cache path and run scripts directly from there
- `npm install` runs automatically on first use

### v1.2.0 — 2026-03-28
- Rewrite `slide-designer` agent to match source project guidelines: correct story type definitions (A=problem-solving, B=competitive advantage, C=outcome-driven), add Rules 2–8 (section design, mountain/valley density, layout selection matrix, full spec.yaml schema, prohibited patterns, 2-turn output formats)
- Add `--story-type A/B/C` option to `/genpptx:create` for forcing story type selection
- Add `--output <dir>` and `--quiet` options to `/genpptx:catalog`

### v1.1.0 — 2026-03-28
- Add PDF support to `/genpptx:read` — reads PDF files via Claude's native Read tool, displays content page by page
- Add PDF support to `/genpptx:theme` — visually analyzes PDF to estimate colors and fonts, generates theme file directly

### v1.0.0 — 2026-03-17
- Initial release

## License

MIT © Yohei Nakanishi
