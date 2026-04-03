#!/usr/bin/env python3
"""Extract pages from a PDF file as PNG images.

Usage:
    python3 extract_pages.py <pdf_path> --output-dir <dir> [--dpi 150]

Output (stdout):
    JSON: {"total_pages": N, "output_dir": "...", "pages": ["/path/page_001.png", ...]}
"""

import argparse
import json
import os
import platform
import sys


def extract_pages(pdf_path, output_dir, dpi=150):
    """Extract PDF pages as PNG images."""
    # Validate input
    if not os.path.isfile(pdf_path):
        print(f"ERROR: PDF file not found: {pdf_path}", file=sys.stderr)
        sys.exit(1)

    # Check pdf2image
    try:
        from pdf2image import convert_from_path
    except ImportError:
        print("ERROR: pdf2image is not installed.", file=sys.stderr)
        print("Install it with:", file=sys.stderr)
        print("  pip install pdf2image pillow", file=sys.stderr)
        sys.exit(1)

    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)

    # Convert PDF to images
    try:
        images = convert_from_path(pdf_path, dpi=dpi)
    except Exception as e:
        error_msg = str(e)
        print(f"ERROR: Failed to convert PDF: {error_msg}", file=sys.stderr)
        if "poppler" in error_msg.lower() or "pdftoppm" in error_msg.lower() or "pdfinfo" in error_msg.lower():
            print("", file=sys.stderr)
            print("poppler is required for PDF conversion.", file=sys.stderr)
            system = platform.system()
            if system == "Darwin":
                print("Install on macOS:", file=sys.stderr)
                print("  brew install poppler", file=sys.stderr)
            elif system == "Windows":
                print("Install on Windows:", file=sys.stderr)
                print("  1. Download from: https://github.com/oschwartz10612/poppler-windows/releases", file=sys.stderr)
                print("  2. Extract and add the bin/ folder to your PATH", file=sys.stderr)
            else:
                print("Install on Linux:", file=sys.stderr)
                print("  sudo apt-get install poppler-utils  # Debian/Ubuntu", file=sys.stderr)
                print("  sudo yum install poppler-utils      # RHEL/CentOS", file=sys.stderr)
        sys.exit(1)

    # Save images
    output_paths = []
    pad = len(str(len(images)))  # dynamic zero-padding
    pad = max(pad, 3)            # minimum 3 digits
    for i, image in enumerate(images):
        filename = f"page_{str(i + 1).zfill(pad)}.png"
        filepath = os.path.join(output_dir, filename)
        image.save(filepath, "PNG")
        output_paths.append(filepath)

    result = {
        "total_pages": len(output_paths),
        "output_dir": output_dir,
        "pages": output_paths,
    }
    print(json.dumps(result, ensure_ascii=False))
    return output_paths


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Extract PDF pages as PNG images"
    )
    parser.add_argument("pdf_path", help="Path to the input PDF file")
    parser.add_argument(
        "--output-dir", required=True, help="Directory to save extracted images"
    )
    parser.add_argument(
        "--dpi", type=int, default=150, help="Image resolution in DPI (default: 150)"
    )
    args = parser.parse_args()

    extract_pages(args.pdf_path, args.output_dir, args.dpi)
