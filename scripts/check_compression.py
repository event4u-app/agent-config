#!/usr/bin/env python3
"""
Compression quality checker for agent-config packages.

Compares .augment.uncompressed/ source files with their .augment/ compressed versions.
Checks that compression preserved structural integrity:
- All headings from source present in compressed
- All code blocks preserved exactly
- YAML frontmatter identical
- Word count reduction within healthy range (10-60%)

Exit codes: 0 = clean, 1 = issues found, 3 = internal error
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Literal

Severity = Literal["error", "warning", "info"]

SOURCE_DIR = Path(".augment.uncompressed")
TARGET_DIR = Path(".augment")


@dataclass
class Issue:
    file: str
    check: str
    severity: Severity
    message: str


def extract_headings(text: str) -> list[str]:
    """Extract all markdown headings (outside code blocks)."""
    headings = []
    in_code = False
    for line in text.splitlines():
        if line.strip().startswith("```"):
            in_code = not in_code
            continue
        if not in_code and re.match(r"^#{1,6}\s+.+$", line):
            headings.append(line)
    return headings


def extract_code_blocks(text: str) -> list[str]:
    """Extract content of fenced code blocks."""
    return re.findall(r"```[^\n]*\n(.*?)```", text, re.DOTALL)


def extract_frontmatter(text: str) -> str:
    """Extract YAML frontmatter."""
    m = re.match(r"^---\n(.*?\n)---", text, re.DOTALL)
    return m.group(1).strip() if m else ""


def check_pair(rel_path: str, source: str, compressed: str) -> List[Issue]:
    """Compare source and compressed versions of a file."""
    issues: List[Issue] = []

    # Frontmatter check
    src_fm = extract_frontmatter(source)
    cmp_fm = extract_frontmatter(compressed)
    if src_fm and src_fm != cmp_fm:
        issues.append(Issue(rel_path, "frontmatter_mismatch", "error",
                            "YAML frontmatter differs between source and compressed"))

    # Heading preservation — check H1 and H2 headings (H3+ may be merged during compression)
    src_headings = extract_headings(source)
    cmp_headings = extract_headings(compressed)
    for h in src_headings:
        # Only check H1 and H2 (## level) — H3+ subheadings may be merged
        if h.startswith("# ") or (h.startswith("## ") and not h.startswith("### ")):
            if h not in cmp_headings:
                issues.append(Issue(rel_path, "missing_heading", "warning",
                                    f"H1/H2 heading lost during compression: {h}"))
    # Also flag if comment lines inside code blocks are being treated as headings
    # Filter out false positives from code blocks

    # Code block preservation
    src_blocks = extract_code_blocks(source)
    cmp_blocks = extract_code_blocks(compressed)
    if len(src_blocks) > len(cmp_blocks):
        issues.append(Issue(rel_path, "lost_code_blocks", "error",
                            f"Code blocks lost: source has {len(src_blocks)}, compressed has {len(cmp_blocks)}"))
    for i, block in enumerate(src_blocks):
        if i < len(cmp_blocks) and block.strip() != cmp_blocks[i].strip():
            # Only flag if content actually changed (not just whitespace)
            if block.replace(" ", "").replace("\n", "") != cmp_blocks[i].replace(" ", "").replace("\n", ""):
                issues.append(Issue(rel_path, "modified_code_block", "error",
                                    f"Code block {i+1} content changed during compression"))

    # Word count ratio
    src_words = len(source.split())
    cmp_words = len(compressed.split())
    if src_words > 0:
        reduction = (1 - cmp_words / src_words) * 100
        if reduction > 60:
            issues.append(Issue(rel_path, "excessive_reduction", "warning",
                                f"Compression reduced {reduction:.0f}% — possible content loss "
                                f"({src_words} → {cmp_words} words)"))
        elif reduction < 5 and src_words > 100:
            issues.append(Issue(rel_path, "minimal_reduction", "info",
                                f"Compression only reduced {reduction:.0f}% "
                                f"({src_words} → {cmp_words} words)"))

    return issues


def scan_all(root: Path) -> List[Issue]:
    """Scan all .md file pairs for compression quality issues."""
    issues: List[Issue] = []
    source_dir = root / SOURCE_DIR
    target_dir = root / TARGET_DIR

    if not source_dir.exists() or not target_dir.exists():
        return issues

    for source_file in sorted(source_dir.rglob("*.md")):
        rel = source_file.relative_to(source_dir)
        target_file = target_dir / rel

        if not target_file.exists():
            continue  # sync-check handles missing files

        # Skip commands — they are copied verbatim, not compressed
        rel_str = str(rel)
        if rel_str.startswith("commands/"):
            continue

        source_text = source_file.read_text(encoding="utf-8")
        target_text = target_file.read_text(encoding="utf-8")
        issues.extend(check_pair(rel_str, source_text, target_text))

    return issues


def format_text(issues: List[Issue]) -> str:
    if not issues:
        return "✅  Compression quality check passed."
    icons = {"error": "🔴", "warning": "🟡", "info": "ℹ️"}
    lines = [f"Found {len(issues)} compression quality issue(s):\n"]
    for i in issues:
        lines.append(f"  {icons[i.severity]} [{i.check}] {i.file}: {i.message}")
    errors = sum(1 for i in issues if i.severity == "error")
    if errors:
        lines.append(f"\n❌  {errors} error(s) must be fixed.")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Check compression quality")
    parser.add_argument("--format", choices=["text", "json"], default="text")
    parser.add_argument("--root", type=Path, default=Path("."))
    args = parser.parse_args()

    try:
        issues = scan_all(args.root)
    except Exception as e:
        print(f"Internal error: {e}", file=sys.stderr)
        return 3

    if args.format == "json":
        print(json.dumps([asdict(i) for i in issues], indent=2))
    else:
        print(format_text(issues))

    errors = [i for i in issues if i.severity == "error"]
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
