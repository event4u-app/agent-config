#!/usr/bin/env python3
"""Auto-rule description-length CI gate (Phase 1.3 of
road-to-augment-limit-fit).

For every `type: auto` rule under `.agent-src.uncondensed/rules/`,
fail CI when the frontmatter `description:` exceeds DESC_CAP chars.

Why: Augment injects each auto-rule's description into the
workspace-guidelines registry stub. Empirical 2026-05-08 budget
analysis showed this channel consuming 25 % of the 49,512-char
ceiling. Capping descriptions guards future drift.

Source of truth: `.agent-src.uncondensed/rules/`. The condensed
projection is regenerated; the source dictates what ships.

Exit codes: 0 = pass, 1 = at least one rule over cap.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RULES_DIR = REPO_ROOT / ".agent-src.uncondensed" / "rules"
DESC_CAP = 150


def parse_frontmatter(text: str) -> dict[str, str]:
    if not text.startswith("---\n"):
        return {}
    end = text.find("\n---", 4)
    if end < 0:
        return {}
    fm: dict[str, str] = {}
    for line in text[4:end].splitlines():
        m = re.match(r"^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$", line)
        if m:
            fm[m.group(1)] = m.group(2).strip().strip('"').strip("'")
    return fm


def main() -> int:
    failures: list[tuple[str, int, str]] = []
    checked = 0

    for path in sorted(RULES_DIR.glob("*.md")):
        text = path.read_text()
        fm = parse_frontmatter(text)
        if fm.get("type") != "auto":
            continue
        desc = fm.get("description", "")
        checked += 1
        if len(desc) > DESC_CAP:
            failures.append((path.name, len(desc), desc))

    if failures:
        print(
            f"❌  {len(failures)} auto-rule description(s) exceed {DESC_CAP} chars:\n",
            file=sys.stderr,
        )
        for name, dlen, desc in sorted(failures, key=lambda x: -x[1]):
            print(f"  [{dlen:>3}] {name}", file=sys.stderr)
            print(f"        {desc}", file=sys.stderr)
        print(
            f"\n  Guard rationale: each char in an auto-rule description "
            f"costs one char in the\n  Augment workspace-guidelines budget "
            f"(cap 49,512). Trim to ≤ {DESC_CAP}.",
            file=sys.stderr,
        )
        return 1

    print(f"✅  All {checked} auto-rule descriptions ≤ {DESC_CAP} chars.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
