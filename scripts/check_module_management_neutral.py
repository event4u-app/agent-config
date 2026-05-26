#!/usr/bin/env python3
"""Lint guard: ``module-management`` SKILL must stay framework-neutral.

Phase C Step 5 of road-to-configurable-modules. Refuses two regressions:

1. ``framework:`` frontmatter key is back (locks the skill to one stack
   again).
2. ``app/Modules/`` literal appears outside the explicitly-labeled
   "Laravel HMVC carve-out" section (drift back to a Laravel-only body).

Stack-specific paths inside their own carve-out sections (Laravel HMVC,
Symfony DDD-lite, Node monorepo, Python src layout, Go internal) are
allowed by construction \u2014 the section header is the carve-out boundary.

Exit codes:
    0 \u2014 file clean
    2 \u2014 lint violation (regression)
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILL_PATH = (
    REPO_ROOT
    / "packages"
    / "core"
    / ".agent-src.uncondensed"
    / "skills"
    / "module-management"
    / "SKILL.md"
)

CARVE_OUT_HEADER = "### Laravel HMVC carve-out"
FRONTMATTER_BANNED_KEYS = ("framework:",)
BODY_BANNED_PATTERNS = (
    re.compile(r"\bapp/Modules/"),
    re.compile(r"App\\\\Modules\\\\"),
)


def _split_frontmatter(text: str) -> tuple[str, str]:
    """Return ``(frontmatter, body)`` \u2014 body starts after closing ``---``."""
    if not text.startswith("---\n"):
        return "", text
    end = text.find("\n---\n", 4)
    if end < 0:
        return "", text
    return text[4:end], text[end + 5:]


def _laravel_carveout_span(body: str) -> tuple[int, int] | None:
    """Locate ``### Laravel HMVC carve-out`` and return ``(start, end)`` lines.

    ``end`` is exclusive and points at the next ``### `` header (or EOF).
    Returns ``None`` if the carve-out is missing.
    """
    lines = body.splitlines()
    start: int | None = None
    for idx, line in enumerate(lines):
        if line.strip() == CARVE_OUT_HEADER:
            start = idx
            break
    if start is None:
        return None
    end = len(lines)
    for idx in range(start + 1, len(lines)):
        if lines[idx].startswith("### "):
            end = idx
            break
    return start, end


def _scan_body(body: str) -> list[str]:
    """Return human-readable violations from the SKILL body."""
    span = _laravel_carveout_span(body)
    if span is None:
        return [
            "Laravel HMVC carve-out section "
            f"({CARVE_OUT_HEADER!r}) missing \u2014 add it back before "
            "moving Laravel-specific prose around."
        ]
    carve_start, carve_end = span
    lines = body.splitlines()
    violations: list[str] = []
    for idx, line in enumerate(lines):
        if carve_start <= idx < carve_end:
            continue
        for pattern in BODY_BANNED_PATTERNS:
            if pattern.search(line):
                violations.append(
                    f"line {idx + 1}: {pattern.pattern!r} outside the "
                    "Laravel HMVC carve-out section "
                    f"\u2014 {line.strip()!r}"
                )
                break
    return violations


def _scan_frontmatter(fm: str) -> list[str]:
    violations: list[str] = []
    for line in fm.splitlines():
        stripped = line.strip()
        for banned in FRONTMATTER_BANNED_KEYS:
            if stripped.startswith(banned):
                violations.append(
                    f"frontmatter has banned key {banned!r} \u2014 "
                    "module-management is stack-agnostic; "
                    "stack hints live in body carve-outs"
                )
    return violations


def main() -> int:
    if not SKILL_PATH.is_file():
        print(
            f"error: SKILL.md not found at {SKILL_PATH}",
            file=sys.stderr,
        )
        return 2
    text = SKILL_PATH.read_text(encoding="utf-8")
    fm, body = _split_frontmatter(text)
    issues = _scan_frontmatter(fm) + _scan_body(body)
    if not issues:
        print(
            f"\u2705  {SKILL_PATH.relative_to(REPO_ROOT)} "
            "framework-neutral check: clean"
        )
        return 0
    print(
        f"\u274c  {SKILL_PATH.relative_to(REPO_ROOT)} "
        "framework-neutral check: FAIL",
        file=sys.stderr,
    )
    for issue in issues:
        print(f"   {issue}", file=sys.stderr)
    print(
        "   Fix: keep stack-specific prose inside its labeled "
        "carve-out section; do not put `framework:` back into "
        "frontmatter.",
        file=sys.stderr,
    )
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
