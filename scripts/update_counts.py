#!/usr/bin/env python3
"""Sync package-content counts (skills/rules/commands/guidelines) across docs.

Source of truth: `.agent-src.uncompressed/`.

Target files have explicit regex patterns for each count mention — no
fuzzy matching, no risk of touching unrelated numbers.

Modes:
  update (default)  Rewrite each target to match the true counts.
  --check           Exit 1 if any target is stale.

Run as part of `task sync` (update) and `task ci` (check).
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SRC = REPO_ROOT / ".agent-src.uncompressed"


def count(kind: str) -> int:
    if kind == "skills":
        return sum(1 for _ in (SRC / "skills").rglob("SKILL.md"))
    if kind == "guidelines":
        # guidelines are grouped by topic subdirectory
        return sum(1 for _ in (SRC / "guidelines").rglob("*.md"))
    return sum(1 for _ in (SRC / kind).glob("*.md"))


# file → list of (regex, kind)
# Each regex MUST use three capture groups: (prefix)(number)(suffix).
TARGETS: list[tuple[str, list[tuple[str, str]]]] = [
    (
        "README.md",
        [
            (r"(Browse all )(\d+)( commands\])", "commands"),
            (r"(package \(rules \+ )(\d+)( skills)", "skills"),
            (r"(skills \+ )(\d+)( native commands)", "commands"),
        ],
    ),
    (
        "AGENTS.md",
        [
            (r"(skills/\s+\()(\d+)( skills\))", "skills"),
            (r"(rules/\s+\()(\d+)( rules\))", "rules"),
            (r"(commands/\s+\()(\d+)( commands\))", "commands"),
            (r"(guidelines/\s+\()(\d+)( guidelines\))", "guidelines"),
        ],
    ),
    (
        "docs/getting-started.md",
        [
            (r"(automatically by )(\d+)( rules)", "rules"),
            (r"(Browse all )(\d+)( commands\])", "commands"),
        ],
    ),
]


def apply_to_text(text: str, patterns: list[tuple[str, str]], counts: dict[str, int]) -> tuple[str, list[tuple[str, int, int]]]:
    """Return (new_text, drifts). Each drift is (kind, old, new)."""
    drifts: list[tuple[str, int, int]] = []
    new_text = text
    for pattern, kind in patterns:
        compiled = re.compile(pattern)
        matches = list(compiled.finditer(new_text))
        if not matches:
            print(f"  ⚠️  pattern missed: /{pattern}/ (kind={kind})", file=sys.stderr)
            continue
        for m in matches:
            old = int(m.group(2))
            new = counts[kind]
            if old != new:
                drifts.append((kind, old, new))
        new_text = compiled.sub(
            lambda m, k=kind: f"{m.group(1)}{counts[k]}{m.group(3)}",
            new_text,
        )
    return new_text, drifts


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="exit 1 on drift instead of rewriting")
    args = parser.parse_args()

    counts = {k: count(k) for k in ("skills", "rules", "commands", "guidelines")}
    print(f"📊  Truth: skills={counts['skills']} rules={counts['rules']} "
          f"commands={counts['commands']} guidelines={counts['guidelines']}")

    any_drift = False
    any_change = False
    for rel, patterns in TARGETS:
        path = REPO_ROOT / rel
        if not path.exists():
            print(f"❌  Missing target: {rel}", file=sys.stderr)
            return 1
        text = path.read_text(encoding="utf-8")
        new_text, drifts = apply_to_text(text, patterns, counts)
        if drifts:
            any_drift = True
            for kind, old, new in drifts:
                print(f"  {'🔴' if args.check else '🔧'}  {rel}: {kind} {old} → {new}")
        if new_text != text and not args.check:
            path.write_text(new_text, encoding="utf-8")
            any_change = True

    if args.check:
        if any_drift:
            print("\n❌  Stale counts detected. Run `task counts-update` to fix.", file=sys.stderr)
            return 1
        print("✅  All counts in sync.")
        return 0

    if any_change:
        print("✅  Counts updated.")
    else:
        print("✅  Counts already in sync.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
