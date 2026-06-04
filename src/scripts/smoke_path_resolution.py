#!/usr/bin/env python3
"""Smoke-test path resolution against the package's own `.augment/` projection.

Per `agents/roadmaps/road-to-path-fixes.md` Phase 7 (Council Decision 3,
2026-05-06): the package's `.augment/` tree has the same shape as the
`.augment/` tree a consumer would receive after `scripts/install.sh`.
If `load_context:` entries resolve cleanly here, they resolve cleanly
in any consumer.

What it does:
  - Walks `.augment/rules/*.md`.
  - Parses each rule's YAML frontmatter.
  - Resolves every `load_context:` and `load_context_eager:` entry
    against the rule file's directory.
  - Reports any miss with a file:entry line.

Exit codes: 0 = all entries resolve, 1 = one or more misses, 3 = no
`.augment/rules/` directory found (run `task sync` first).
"""
from __future__ import annotations

import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent.parent
AUGMENT_RULES = ROOT / ".augment" / "rules"


def _split_frontmatter(text: str):
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---\n", 4)
    if end == -1:
        return None
    try:
        fm = yaml.safe_load(text[4:end])
    except yaml.YAMLError:
        return None
    return fm if isinstance(fm, dict) else {}


def _check_rule(rule_file: Path, misses: list[tuple[str, str]]) -> int:
    fm = _split_frontmatter(rule_file.read_text(encoding="utf-8"))
    if not fm:
        return 0
    checked = 0
    rule_dir = rule_file.parent
    for key in ("load_context", "load_context_eager"):
        entries = fm.get(key) or []
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if not isinstance(entry, str):
                continue
            checked += 1
            target = (rule_dir / entry).resolve()
            if not target.is_file():
                misses.append((str(rule_file.relative_to(ROOT)), entry))
    return checked


def main() -> int:
    if not AUGMENT_RULES.is_dir():
        print(
            f"❌  {AUGMENT_RULES.relative_to(ROOT)} not found — run `task sync` first",
            file=sys.stderr,
        )
        return 3

    misses: list[tuple[str, str]] = []
    rule_count = 0
    entry_count = 0
    for rule_file in sorted(AUGMENT_RULES.glob("*.md")):
        rule_count += 1
        entry_count += _check_rule(rule_file, misses)

    if misses:
        print(f"❌  {len(misses)} unresolved load_context entr(y/ies):")
        for rule, entry in misses:
            print(f"    {rule} → {entry!r}")
        return 1

    print(
        f"✅  smoke-path-resolution clean "
        f"({rule_count} rules, {entry_count} load_context entr(y/ies) resolved)"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
