#!/usr/bin/env python3
"""Emit the per-domain skill list as Markdown for skill-domains.md § 4."""
from __future__ import annotations

import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _backfill_skill_domains import SKILL_DOMAIN_MAP  # noqa: E402

ORDER = ["engineering", "product", "quality", "devops", "process", "discovery"]


def main() -> int:
    by_domain: dict[str, list[str]] = defaultdict(list)
    for slug, dom in SKILL_DOMAIN_MAP.items():
        by_domain[dom].append(slug)

    lines: list[str] = []
    total = 0
    for dom in ORDER:
        skills = sorted(by_domain[dom])
        total += len(skills)
        lines.append(f"### {dom} ({len(skills)})")
        lines.append("")
        lines.append(", ".join(f"`{s}`" for s in skills))
        lines.append("")
    lines.append(f"**Total: {total} skills.**")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    sys.exit(main())
