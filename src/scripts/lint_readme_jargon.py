#!/usr/bin/env python3
"""CI guard for README.md above-fold jargon density.

The role-first-onboarding roadmap (Phase 2 Step 3) targets non-developer
readers above the fold. Lines 1..ABOVE_FOLD_LINES of README.md MUST
contain at most MAX_HITS occurrences of the watchlist terms below
(case-insensitive, whole-word matched).

Watchlist comes from feedback8 — words that read fine to a maintainer
but bounce a Founder or Creator off the page within five seconds:

    kernel · contract · iron law · projection · manifest · lint ·
    ADR · soak · drift · gate · harness

Counting rules:
  - Case-insensitive.
  - Whole-word match (no partial hits inside other words).
  - Skip fenced code blocks (```...```), HTML comments, and link URLs.
  - Each match counts once at its location; multi-line lints stay
    deterministic.

Exit codes:
  0 — above-fold jargon hits <= MAX_HITS.
  1 — above-fold jargon hits >  MAX_HITS (print line + match summary).

Invocation:
  python3 scripts/lint_readme_jargon.py
  python3 scripts/lint_readme_jargon.py --quiet
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

README = Path("README.md")
ABOVE_FOLD_LINES = 120
MAX_HITS = 3

WATCHLIST = (
    "kernel",
    "contract",
    "iron law",
    "projection",
    "manifest",
    "lint",
    "ADR",
    "soak",
    "drift",
    "gate",
    "harness",
)


def _strip_noise(lines: list[str]) -> list[str]:
    """Return per-line content with fences / HTML comments / URLs removed.

    Order matters: drop URLs first (they may sit inside fences), then
    blank out fenced code regions so word-boundary matches don't trip
    on stack-trace or shell tokens.
    """
    url_re = re.compile(r"https?://\S+|\(\.[\w./-]+\)")
    cleaned: list[str] = []
    in_fence = False
    in_html = False
    for raw in lines:
        line = raw
        if "<!--" in line and "-->" not in line:
            in_html = True
        if in_html:
            cleaned.append("")
            if "-->" in line:
                in_html = False
            continue
        stripped = line.strip()
        if stripped.startswith("```"):
            in_fence = not in_fence
            cleaned.append("")
            continue
        if in_fence:
            cleaned.append("")
            continue
        cleaned.append(url_re.sub(" ", line))
    return cleaned


def main() -> int:
    quiet = "--quiet" in sys.argv
    if not README.exists():
        print(f"error: {README} not found", file=sys.stderr)
        return 1

    all_lines = README.read_text(encoding="utf-8").splitlines()
    head = _strip_noise(all_lines[:ABOVE_FOLD_LINES])

    patterns = [
        (term, re.compile(r"(?<![A-Za-z0-9])" + re.escape(term) + r"(?![A-Za-z0-9])", re.IGNORECASE))
        for term in WATCHLIST
    ]

    hits: list[tuple[int, str, str]] = []
    for idx, content in enumerate(head, start=1):
        for term, pat in patterns:
            for m in pat.finditer(content):
                hits.append((idx, term, m.group(0)))

    if len(hits) > MAX_HITS:
        print(
            f"FAIL  {README}: {len(hits)} jargon hits above the fold "
            f"(lines 1..{ABOVE_FOLD_LINES}, limit {MAX_HITS})."
        )
        for line_no, term, match in hits:
            print(f"  L{line_no:>3}  {term:<10}  -> {match!r}")
        print(
            "\nFix: rewrite the line in role-first language. Move the "
            "term below line "
            f"{ABOVE_FOLD_LINES + 1} (architecture / contracts section)."
        )
        return 1

    if not quiet:
        print(
            f"OK    {README}: {len(hits)} jargon hits above the fold "
            f"(limit {MAX_HITS})."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
