#!/usr/bin/env python3
"""
Iron Law prominence checker — enforces that any rule file declaring an
"Iron Law" places it at the top of the file at H2 level.

Rules:
  1. No heading at H3 or deeper may match "Iron Law(s)" — Iron Laws must
     be H2 sections, never sub-sections.
  2. If a file declares one or more Iron-Law H2 sections, at least one
     of them must be among the first two H2 headings of the file.

Files with no Iron-Law heading at all are exempt — they may legitimately
reference Iron Laws from other rules in prose only.

Code blocks are skipped to avoid false positives on quoted text.

Exit codes: 0 = clean, 1 = violations found, 3 = internal error.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, asdict
from pathlib import Path

HEADING_RE = re.compile(r"^(#{1,6})\s+(.+?)\s*$")
IRON_LAW_RE = re.compile(r"\biron\s+laws?\b", re.IGNORECASE)
FENCE_RE = re.compile(r"^\s*```")


@dataclass
class Violation:
    file: str
    line: int
    kind: str        # "deep_iron_law" | "buried_iron_law"
    detail: str


def _parse_headings(text: str) -> list[tuple[int, int, str]]:
    """Return (line_no, depth, title) for each heading outside code fences."""
    headings: list[tuple[int, int, str]] = []
    in_fence = False
    for lineno, raw in enumerate(text.splitlines(), start=1):
        if FENCE_RE.match(raw):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        m = HEADING_RE.match(raw)
        if not m:
            continue
        depth = len(m.group(1))
        title = m.group(2).strip()
        headings.append((lineno, depth, title))
    return headings


def scan_file(path: Path) -> list[Violation]:
    text = path.read_text(encoding="utf-8")
    headings = _parse_headings(text)

    violations: list[Violation] = []

    # Rule 1: no Iron Law at H3 or deeper
    for lineno, depth, title in headings:
        if depth >= 3 and IRON_LAW_RE.search(title):
            violations.append(Violation(
                file=str(path), line=lineno, kind="deep_iron_law",
                detail=f"H{depth} heading `{title}` — promote to H2",
            ))

    # Rule 2: if any H2 Iron Law exists, it must be in first 2 H2 positions
    h2 = [(ln, t) for ln, d, t in headings if d == 2]
    iron_h2 = [(ln, t) for ln, t in h2 if IRON_LAW_RE.search(t)]
    if iron_h2:
        first_two_lines = {ln for ln, _ in h2[:2]}
        if not any(ln in first_two_lines for ln, _ in iron_h2):
            first_iron_ln, first_iron_title = iron_h2[0]
            preceding = [t for ln, t in h2 if ln < first_iron_ln]
            violations.append(Violation(
                file=str(path), line=first_iron_ln, kind="buried_iron_law",
                detail=(
                    f"Iron Law H2 `{first_iron_title}` at line {first_iron_ln} "
                    f"is preceded by {len(preceding)} non-Iron-Law H2 section(s): "
                    f"{preceding}. Move Iron Law into the first 2 H2 positions."
                ),
            ))

    return violations


def _resolve_targets(paths: list[str]) -> list[Path]:
    out: list[Path] = []
    for raw in paths:
        p = Path(raw)
        if p.is_dir():
            out.extend(sorted(p.rglob("*.md")))
        elif p.suffix == ".md":
            out.append(p)
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "paths", nargs="*",
        default=[".agent-src.uncompressed/rules"],
        help="Files or directories to scan (default: .agent-src.uncompressed/rules)",
    )
    parser.add_argument("--format", choices=["text", "json"], default="text")
    args = parser.parse_args()

    targets = _resolve_targets(args.paths)
    all_violations: list[Violation] = []
    for path in targets:
        if not path.exists():
            print(f"⚠️  Not found: {path}", file=sys.stderr)
            continue
        all_violations.extend(scan_file(path))

    if args.format == "json":
        print(json.dumps([asdict(v) for v in all_violations], indent=2, ensure_ascii=False))
    else:
        if not all_violations:
            print(f"✅  Iron Law prominence clean ({len(targets)} file(s) scanned).")
        else:
            print(f"❌  {len(all_violations)} Iron-Law prominence violation(s):\n")
            for v in all_violations:
                print(f"  {v.file}:{v.line} — {v.kind}")
                print(f"    │ {v.detail}")

    return 1 if all_violations else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"❌  Internal error: {exc}", file=sys.stderr)
        sys.exit(3)
