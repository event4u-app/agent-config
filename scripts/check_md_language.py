#!/usr/bin/env python3
"""
Markdown language checker — enforces language-and-tone § ".md files are ALWAYS English".

Scans .md files for German content (umlauts, function words, quoted DE phrases)
in body prose, skipping:
- Fenced code blocks (``` ... ```)
- Inline code (`...`)
- Labeled DE: ... · EN: ... anchor blocks
- URLs and file paths inside backticks

Exit codes: 0 = clean, 1 = violations found, 3 = internal error.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, asdict
from pathlib import Path

# Umlauts and German-only characters
UMLAUT_RE = re.compile(r"[äöüÄÖÜß]")

# German function words that almost never appear in English technical prose
DE_WORDS = [
    "für", "nicht", "dass", "wenn", "sollte", "werden", "arbeite",
    "selbstständig", "jetzt", "einfach", "weiter", "lösche", "frag",
    "schreib", "mach", "auch", "hier", "diese", "dieser", "dieses",
    "vermutlich", "bitte", "kannst", "sollen", "müssen", "wäre",
]
DE_WORD_RE = re.compile(
    r"\b(" + "|".join(re.escape(w) for w in DE_WORDS) + r")\b",
    re.IGNORECASE,
)

# Labeled bilingual anchor: lines starting with "DE:" or "- DE:" (and same for EN)
DE_ANCHOR_RE = re.compile(r"^\s*[-*]?\s*(DE|EN):\s", re.IGNORECASE)

# Inline code spans
INLINE_CODE_RE = re.compile(r"`[^`]*`")

# Per-line escape: append `<!-- md-language-check: ignore -->` to a line
# to suppress findings on that line. For meta-documentation that quotes
# German tokens as trigger examples (e.g. inside language-and-tone.md).
IGNORE_RE = re.compile(r"<!--\s*md-language-check:\s*ignore\s*-->", re.IGNORECASE)


@dataclass
class Violation:
    file: str
    line: int
    kind: str        # "umlaut" | "de_word"
    match: str
    context: str


def _strip_inline_code(text: str) -> str:
    return INLINE_CODE_RE.sub("", text)


def scan_file(path: Path) -> list[Violation]:
    violations: list[Violation] = []
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except (OSError, UnicodeDecodeError) as exc:
        print(f"⚠️  Cannot read {path}: {exc}", file=sys.stderr)
        return violations

    in_fence = False
    in_frontmatter = False
    for lineno, raw in enumerate(lines, start=1):
        stripped = raw.lstrip()

        # YAML frontmatter at top of file
        if lineno == 1 and stripped == "---":
            in_frontmatter = True
            continue
        if in_frontmatter:
            if stripped == "---":
                in_frontmatter = False
            continue

        # Fenced code blocks
        if stripped.startswith("```") or stripped.startswith("~~~"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue

        # Indented code blocks (4+ leading spaces, non-list)
        if raw.startswith("    ") and not stripped.startswith(("-", "*", "+", "1", "2", "3", "4", "5", "6", "7", "8", "9")):
            continue

        # Labeled bilingual anchor — allowed location for DE prose
        if DE_ANCHOR_RE.match(raw):
            continue

        # Per-line opt-out marker
        if IGNORE_RE.search(raw):
            continue

        # Strip inline code spans before scanning
        scan_text = _strip_inline_code(raw)

        for m in UMLAUT_RE.finditer(scan_text):
            violations.append(Violation(
                file=str(path), line=lineno, kind="umlaut",
                match=m.group(0), context=raw.rstrip(),
            ))

        for m in DE_WORD_RE.finditer(scan_text):
            violations.append(Violation(
                file=str(path), line=lineno, kind="de_word",
                match=m.group(0), context=raw.rstrip(),
            ))

    return violations


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paths", nargs="+", help="One or more .md files to scan")
    parser.add_argument("--format", choices=["text", "json"], default="text")
    args = parser.parse_args()

    all_violations: list[Violation] = []
    for raw_path in args.paths:
        path = Path(raw_path)
        if not path.exists():
            print(f"⚠️  Not found: {path}", file=sys.stderr)
            continue
        if path.suffix != ".md":
            print(f"⚠️  Skipping non-.md: {path}", file=sys.stderr)
            continue
        all_violations.extend(scan_file(path))

    if args.format == "json":
        print(json.dumps([asdict(v) for v in all_violations], indent=2, ensure_ascii=False))
    else:
        if not all_violations:
            print("✅  No German content detected.")
        else:
            print(f"❌  {len(all_violations)} violation(s) found:\n")
            for v in all_violations:
                print(f"  {v.file}:{v.line} — {v.kind} `{v.match}`")
                print(f"    │ {v.context}")

    return 1 if all_violations else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except Exception as exc:  # noqa: BLE001
        print(f"❌  Internal error: {exc}", file=sys.stderr)
        sys.exit(3)
