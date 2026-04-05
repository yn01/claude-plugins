# slide-revive

Rebuild NotebookLM slide PDFs as fully editable PPTX files using Vision AI.

NotebookLM exports — both PDF and PPTX — embed each slide as a flat image, making text and shapes impossible to edit. slide-revive runs each page through Vision AI (Claude itself, no external API key needed), reconstructs the slide structure as a `spec.yaml`, and generates a polished, fully editable `.pptx` alongside an instant `.html` preview — all in one command, with no other plugins required.

## Features

- **Image → editable text** — Vision AI transcribes titles, body copy, table cells, and bullet points accurately, including Japanese
- **Native PPTX objects** — text boxes, tables, and shapes are reconstructed as first-class PPTX elements, not embedded images
- **HTML preview** — a browser-viewable `.html` is always generated alongside the `.pptx`
- **No external API key** — Claude Code itself handles the image analysis
- **Self-contained** — PPTX generation engine is bundled; no other plugins required
- **Theme support** — built-in themes (`base`, `corporate-yellow`) included
- **Cross-platform** — macOS and Windows both supported

## Prerequisites

### Python packages

```bash
pip install pdf2image pillow pyyaml
```

### Node.js 18+

Required for PPTX generation (bundled scripts use Node.js). Dependencies are installed automatically on first run.

### poppler (PDF-to-image backend)

**macOS:**
```bash
brew install poppler
```

**Windows:**
1. Download from [poppler for Windows releases](https://github.com/oschwartz10612/poppler-windows/releases)
2. Extract the archive and add the `bin/` folder to your `PATH`

**Linux:**
```bash
sudo apt-get install poppler-utils   # Debian/Ubuntu
sudo yum install poppler-utils       # RHEL/CentOS
```

## Installation

```bash
/plugin install slide-revive
```

## Usage

### Convert PDF to editable PPTX

```
/slide-revive:convert path/to/notebooklm-output.pdf
```

Outputs `output/<pdf-basename>/presentation.pptx` and `output/<pdf-basename>/presentation.html`.

### Apply a different theme

```
/slide-revive:convert path/to/notebooklm-output.pdf --theme corporate-yellow
```

### Specify an output directory

```
/slide-revive:convert path/to/notebooklm-output.pdf --output output/rebuilt/
```

### Analyze only — generate `spec.yaml` without building PPTX

```
/slide-revive:analyze path/to/notebooklm-output.pdf
```

Useful for reviewing and hand-editing the spec before generating the final PPTX.

## Pipeline

```
PDF input
  ↓
extract_pages.py  →  per-page PNG images (150 dpi)
  ↓
Claude Vision     →  structured JSON per slide
  ↓
to_spec.py        →  spec.yaml
  ↓
generate.mjs      →  presentation.pptx + presentation.html
```

## Layout mapping

| NotebookLM slide pattern | Layout |
|--------------------------|--------|
| Title slide | `cover` |
| Section divider | `section` |
| Bullets, flow diagrams, architecture diagrams | `content` |
| Two-column comparison | `two-column` |
| Comparison table / data grid | `table` |
| Timeline / roadmap | `content` |
| Key takeaways / summary | `summary` |
| Closing slide | `closing` |

## Available themes

| Theme | Style |
|-------|-------|
| `base` | Clean white + blue (default) |
| `corporate-yellow` | Corporate style with yellow accent |

## Limitations

- PDF input only (PPTX input is not supported)
- Complex diagrams and decorative icons are reconstructed as text; pixel-perfect shape reproduction is not possible
- Reconstruction quality depends on Vision AI analysis accuracy; highly complex layouts may be simplified

## License

MIT
