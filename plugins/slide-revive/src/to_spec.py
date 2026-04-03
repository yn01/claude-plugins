#!/usr/bin/env python3
"""Convert slide analysis JSON to genpptx spec.yaml.

Usage:
    python3 to_spec.py <json_file> <output_yaml_path> [--theme base] [--title "Title"]

Input JSON format (array of slide analysis objects):
    [
      {
        "slide_number": 1,
        "layout_type": "cover",
        "title": "...",
        "subtitle": "...",
        "body_text": "...",
        "bullets": ["...", "..."],
        "headers": ["Col1", "Col2"],
        "rows": [["A", "B"], ["C", "D"]],
        "left_column": {"heading": "...", "bullets": ["..."]},
        "right_column": {"heading": "...", "bullets": ["..."]},
        "points": [{"title": "...", "description": "..."}],
        "notes": "..."
      }
    ]
"""

import argparse
import json
import os
import sys


try:
    import yaml
except ImportError:
    print("ERROR: PyYAML is not installed.", file=sys.stderr)
    print("Install it with:", file=sys.stderr)
    print("  pip install pyyaml", file=sys.stderr)
    sys.exit(1)


# Mapping from Vision AI layout_type to genpptx layout name
LAYOUT_MAP = {
    # Cover
    "cover": "cover",
    "title_slide": "cover",
    "title": "cover",
    # Section
    "section": "section",
    "section_divider": "section",
    "chapter": "section",
    # Content (catch-all for complex diagrams)
    "content": "content",
    "bullets": "content",
    "flow_chart": "content",
    "flowchart": "content",
    "flow": "content",
    "architecture": "content",
    "diagram": "content",
    "concentric": "content",
    "scope": "content",
    "three_column": "content",
    "card_grid": "content",
    "cards": "content",
    # Two-column
    "two_column": "two-column",
    "two-column": "two-column",
    "comparison": "two-column",
    "side_by_side": "two-column",
    # Table
    "table": "table",
    "comparison_table": "table",
    "grid": "table",
    # Timeline / Roadmap → content (timeline layout not in genpptx)
    "timeline": "content",
    "roadmap": "content",
    "phases": "content",
    # Summary
    "summary": "summary",
    "key_points": "summary",
    "takeaways": "summary",
    # Closing
    "closing": "closing",
    "closing_slide": "closing",
    "end": "closing",
    "thank_you": "closing",
}

MAX_BULLETS = 6
MAX_TABLE_COLS = 6
MAX_TABLE_ROWS = 8


def get_layout(layout_type):
    """Map layout_type string to genpptx layout name."""
    if not layout_type:
        return "content"
    return LAYOUT_MAP.get(layout_type.lower(), "content")


def clean_text(text):
    """Remove leading/trailing whitespace and return None for empty strings."""
    if not text:
        return None
    cleaned = str(text).strip()
    return cleaned if cleaned else None


def map_cover(slide):
    result = {"layout": "cover"}
    if title := clean_text(slide.get("title")):
        result["title"] = title
    if subtitle := clean_text(slide.get("subtitle")):
        result["subtitle"] = subtitle
    # date field optional
    if date := clean_text(slide.get("date")):
        result["date"] = date
    return result


def map_section(slide):
    result = {"layout": "section"}
    if title := clean_text(slide.get("title")):
        result["title"] = title
    if subtitle := clean_text(slide.get("subtitle")):
        result["subtitle"] = subtitle
    return result


def map_content(slide):
    result = {"layout": "content"}
    if title := clean_text(slide.get("title")):
        result["title"] = title

    # Collect bullets from various sources
    bullets = _collect_bullets(slide)

    if bullets:
        result["bullets"] = bullets[:MAX_BULLETS]
    elif body_text := clean_text(slide.get("body_text")):
        result["text"] = body_text

    if sidebar := clean_text(slide.get("sidebar_title")):
        result["sidebarTitle"] = sidebar

    return result


def _collect_bullets(slide):
    """Extract bullet points from slide analysis, trying multiple fields."""
    bullets = slide.get("bullets", [])
    if bullets and isinstance(bullets, list):
        cleaned = [b for b in (clean_text(str(b)) for b in bullets) if b]
        if cleaned:
            return cleaned

    # Try body_text as fallback (split by newlines)
    body = slide.get("body_text", "")
    if body:
        lines = [line.strip() for line in str(body).split("\n") if line.strip()]
        if lines:
            return lines

    # Try elements
    elements = slide.get("elements", [])
    for el in elements:
        el_type = el.get("type", "")
        content = el.get("content")
        if el_type in ("bullet_list", "text_box", "list") and content:
            if isinstance(content, list):
                cleaned = [b for b in (clean_text(str(b)) for b in content) if b]
                if cleaned:
                    return cleaned
            elif isinstance(content, str):
                lines = [line.strip() for line in content.split("\n") if line.strip()]
                if lines:
                    return lines

    return []


def map_two_column(slide):
    result = {"layout": "two-column"}
    if title := clean_text(slide.get("title")):
        result["title"] = title

    left = slide.get("left_column") or {}
    right = slide.get("right_column") or {}

    left_bullets = left.get("bullets", [])
    right_bullets = right.get("bullets", [])

    result["left"] = {
        "heading": clean_text(left.get("heading")) or "",
        "bullets": [b for b in (clean_text(str(b)) for b in left_bullets) if b][:MAX_BULLETS],
    }
    result["right"] = {
        "heading": clean_text(right.get("heading")) or "",
        "bullets": [b for b in (clean_text(str(b)) for b in right_bullets) if b][:MAX_BULLETS],
    }
    return result


def map_table(slide):
    result = {"layout": "table"}
    if title := clean_text(slide.get("title")):
        result["title"] = title

    headers = slide.get("headers", [])
    rows = slide.get("rows", [])

    if headers:
        result["headers"] = [clean_text(str(h)) or "" for h in headers[:MAX_TABLE_COLS]]

    if rows:
        col_count = len(result.get("headers", [])) or MAX_TABLE_COLS
        result["rows"] = [
            [clean_text(str(cell)) or "" for cell in row[:col_count]]
            for row in rows[:MAX_TABLE_ROWS]
        ]

    if description := clean_text(slide.get("description") or slide.get("body_text")):
        result["description"] = description

    return result


def map_summary(slide):
    result = {"layout": "summary"}
    if title := clean_text(slide.get("title")):
        result["title"] = title

    points = slide.get("points", [])
    if points and isinstance(points, list):
        cleaned_points = []
        for p in points:
            if isinstance(p, dict):
                pt = clean_text(p.get("title") or p.get("heading") or "")
                desc = clean_text(p.get("description") or p.get("body") or "")
                if pt:
                    cleaned_points.append({"title": pt, "description": desc or ""})
            elif isinstance(p, str):
                if t := clean_text(p):
                    cleaned_points.append({"title": t, "description": ""})
        if cleaned_points:
            result["points"] = cleaned_points[:MAX_BULLETS]
            return result

    # Fallback: convert bullets to points
    bullets = _collect_bullets(slide)
    if bullets:
        result["points"] = [{"title": b, "description": ""} for b in bullets[:MAX_BULLETS]]

    return result


def map_closing(slide):
    result = {"layout": "closing"}
    if title := clean_text(slide.get("title")):
        result["title"] = title
    if subtitle := clean_text(slide.get("subtitle")):
        result["subtitle"] = subtitle
    return result


LAYOUT_HANDLERS = {
    "cover": map_cover,
    "section": map_section,
    "content": map_content,
    "two-column": map_two_column,
    "table": map_table,
    "summary": map_summary,
    "closing": map_closing,
}


def map_slide(slide_analysis):
    """Convert a single slide analysis dict to a genpptx slide spec dict."""
    layout_type = slide_analysis.get("layout_type", "content")
    layout = get_layout(layout_type)
    handler = LAYOUT_HANDLERS.get(layout, map_content)
    return handler(slide_analysis)


def convert_to_spec(analyses, output_path, theme="base", title="Presentation"):
    """Convert list of slide analyses to a genpptx spec.yaml file."""
    slides = [map_slide(a) for a in analyses]

    spec = {
        "theme": str(theme),  # force string to avoid YAML number parsing
        "title": title,
        "slides": slides,
    }

    # Ensure output directory exists
    output_dir = os.path.dirname(output_path)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)

    with open(output_path, "w", encoding="utf-8") as f:
        yaml.dump(
            spec,
            f,
            allow_unicode=True,
            default_flow_style=False,
            sort_keys=False,
        )

    print(f"spec.yaml written to: {output_path}")
    return output_path


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Convert slide analysis JSON to genpptx spec.yaml"
    )
    parser.add_argument("json_file", help="Path to JSON file containing slide analyses")
    parser.add_argument("output_path", help="Output path for spec.yaml")
    parser.add_argument("--theme", default="base", help="Theme name (default: base)")
    parser.add_argument(
        "--title", default="Presentation", help="Presentation title (default: Presentation)"
    )
    args = parser.parse_args()

    with open(args.json_file, "r", encoding="utf-8") as f:
        analyses = json.load(f)

    convert_to_spec(analyses, args.output_path, args.theme, args.title)
