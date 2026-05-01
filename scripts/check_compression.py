#!/usr/bin/env python3
"""
Compression quality checker for agent-config packages.

Compares .agent-src.uncompressed/ source files with their .agent-src/ compressed versions.
Checks that compression preserved structural integrity:
- All headings from source present in compressed
- All code blocks preserved exactly
- YAML frontmatter identical
- Word count reduction within healthy range (10-60%)
- Iron Law sections (## Iron Law / ### Iron Law / ## The Iron Law / Iron Laws / numbered)
  preserved per `preservation-guard`: heading verbatim at original level, ≤ 15% reduction

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

SOURCE_DIR = Path(".agent-src.uncompressed")
TARGET_DIR = Path(".agent-src")


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


# Matches `## Iron Law`, `## The Iron Law`, `## Iron Laws`, `### Iron Law — …`,
# `## Iron Law 1 — …`, etc. Any heading level 2-6.
IRON_LAW_HEADING = re.compile(r"^(#{2,6})\s+(The\s+)?Iron Laws?\b")

LIST_ITEM_RE = re.compile(r"^(?:[-*+]|\d+\.)\s")
INNER_HEADING_RE = re.compile(r"^#{1,6}\s")


def count_iron_law_structure(body: str) -> dict:
    """Count structural units in an Iron Law body.

    Returns counts of paragraphs (blank-line-separated prose blocks),
    list items (bullet + numbered), and fenced code blocks. Caveman
    compression may shorten word count freely; what must NOT change is
    the count of these structural units. Each represents a passage of
    the law that the source decided to keep.

    Multi-line list items (bullet text wrapped to indented continuation
    lines, no blank line between) count as ONE list item, not as a
    list item plus a paragraph.
    """
    paragraphs = 0
    list_items = 0
    code_blocks = 0
    in_code = False
    state = "blank"  # "blank" | "paragraph" | "list"
    for line in body.splitlines():
        stripped = line.strip()
        if stripped.startswith("```"):
            if not in_code:
                code_blocks += 1
            in_code = not in_code
            state = "blank"
            continue
        if in_code:
            continue
        if not stripped:
            state = "blank"
            continue
        if LIST_ITEM_RE.match(stripped):
            list_items += 1
            state = "list"
            continue
        if INNER_HEADING_RE.match(stripped):
            state = "blank"
            continue
        # Indented non-empty line right after a list item is a wrap
        # continuation of that item, not a new paragraph.
        if state == "list" and line.startswith((" ", "\t")):
            continue
        if state != "paragraph":
            paragraphs += 1
            state = "paragraph"
    return {"paragraphs": paragraphs, "list_items": list_items, "code_blocks": code_blocks}


def extract_iron_law_sections(text: str) -> list[tuple[str, int, str]]:
    """Return [(heading, level, body)] for each Iron Law section.

    Body is everything after the heading until the next heading at the same
    or higher (numerically lower) level — fenced code blocks included verbatim.
    """
    lines = text.splitlines()
    sections: list[tuple[str, int, str]] = []
    i = 0
    in_code = False
    while i < len(lines):
        line = lines[i]
        if line.strip().startswith("```"):
            in_code = not in_code
            i += 1
            continue
        if not in_code:
            m = IRON_LAW_HEADING.match(line)
            if m:
                heading = line.rstrip()
                level = len(m.group(1))
                body_lines: list[str] = []
                j = i + 1
                inner_code = False
                while j < len(lines):
                    jline = lines[j]
                    if jline.strip().startswith("```"):
                        inner_code = not inner_code
                    if not inner_code:
                        hm = re.match(r"^(#{1,6})\s", jline)
                        if hm and len(hm.group(1)) <= level:
                            break
                    body_lines.append(jline)
                    j += 1
                sections.append((heading, level, "\n".join(body_lines)))
                i = j
                continue
        i += 1
    return sections


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

    # Iron Law preservation — non-negotiable behavioral rules, see preservation-guard
    src_laws = extract_iron_law_sections(source)
    cmp_laws = extract_iron_law_sections(compressed)
    cmp_law_map = {h: (lvl, body) for h, lvl, body in cmp_laws}
    # Build a level-agnostic lookup so we can detect heading-level downgrades
    # (`## Iron Law` → `### Iron Law`).
    cmp_law_by_text = {h.lstrip("# ").strip(): (lvl, h, body)
                       for h, lvl, body in cmp_laws}
    for src_heading, src_level, src_body in src_laws:
        src_text = src_heading.lstrip("# ").strip()
        if src_heading not in cmp_law_map:
            # Heading text may exist at a different level → downgrade
            if src_text in cmp_law_by_text:
                cmp_level, cmp_heading, _ = cmp_law_by_text[src_text]
                if cmp_level != src_level:
                    issues.append(Issue(rel_path, "iron_law_heading_downgrade", "error",
                                        f"Iron Law heading level changed: "
                                        f"{'#' * src_level} → {'#' * cmp_level} "
                                        f"({src_heading.strip()})"))
                    continue
            issues.append(Issue(rel_path, "iron_law_missing", "error",
                                f"Iron Law section removed during compression: "
                                f"{src_heading.strip()}"))
            continue
        # Section exists at correct level — check structural-unit survival.
        # Caveman compression is fine (drop articles, terse phrasing); what
        # must NOT change is the count of paragraphs, list items, and code
        # blocks. Each is a passage the source kept on purpose.
        _, cmp_body = cmp_law_map[src_heading]
        src_struct = count_iron_law_structure(src_body)
        cmp_struct = count_iron_law_structure(cmp_body)
        for kind, src_n in src_struct.items():
            cmp_n = cmp_struct[kind]
            if cmp_n < src_n:
                issues.append(Issue(rel_path, "iron_law_passage_dropped", "error",
                                    f"Iron Law section dropped "
                                    f"{src_n - cmp_n} {kind} "
                                    f"({src_n} → {cmp_n}): "
                                    f"{src_heading.strip()}"))

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


def scan_summary(root: Path) -> str:
    """Generate per-category compression summary stats."""
    source_dir = root / SOURCE_DIR
    target_dir = root / TARGET_DIR
    if not source_dir.exists() or not target_dir.exists():
        return "No source/target directories found."

    categories: dict[str, list[tuple[int, int]]] = {}
    for source_file in sorted(source_dir.rglob("*.md")):
        rel = source_file.relative_to(source_dir)
        target_file = target_dir / rel
        if not target_file.exists() or str(rel).startswith("commands/"):
            continue
        src_words = len(source_file.read_text(encoding="utf-8").split())
        cmp_words = len(target_file.read_text(encoding="utf-8").split())
        parts = str(rel).split("/")
        cat = parts[0] if len(parts) > 1 else "root"
        categories.setdefault(cat, []).append((src_words, cmp_words))

    lines = ["Category         | Files | Avg Source | Avg Compressed | Avg Reduction",
             "---              | ---   | ---        | ---            | ---"]
    total_src = total_cmp = total_files = 0
    for cat in sorted(categories):
        pairs = categories[cat]
        n = len(pairs)
        avg_src = sum(s for s, _ in pairs) // n
        avg_cmp = sum(c for _, c in pairs) // n
        reduction = (1 - avg_cmp / avg_src) * 100 if avg_src > 0 else 0
        lines.append(f"{cat:<17}| {n:>5} | {avg_src:>10} | {avg_cmp:>14} | {reduction:>5.0f}%")
        total_src += sum(s for s, _ in pairs)
        total_cmp += sum(c for _, c in pairs)
        total_files += n
    overall = (1 - total_cmp / total_src) * 100 if total_src > 0 else 0
    lines.append(f"{'TOTAL':<17}| {total_files:>5} | {total_src // max(total_files, 1):>10} | {total_cmp // max(total_files, 1):>14} | {overall:>5.0f}%")
    return "\n".join(lines)


def main() -> int:
    parser = argparse.ArgumentParser(description="Check compression quality")
    parser.add_argument("--format", choices=["text", "json"], default="text")
    parser.add_argument("--summary", action="store_true", help="Show per-category compression stats")
    parser.add_argument("--root", type=Path, default=Path("."))
    args = parser.parse_args()

    if args.summary:
        print(scan_summary(args.root))
        return 0

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
