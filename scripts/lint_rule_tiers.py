#!/usr/bin/env python3
"""Lint rule frontmatter for the `tier:` key.

Hard-fails CI if any rule under .agent-src.uncompressed/rules/ lacks a
`tier:` declaration or uses an unknown tier value. The valid tier set is
locked by agents/settings/contexts/hardening-pattern.md and the matrix in
agents/settings/contexts/rule-trigger-matrix.md.

Hooked into `task ci` after `task lint-skills`.

Exit codes:
  0  every rule declares a valid tier
  1  one or more rules missing or using an invalid tier
"""
from __future__ import annotations

import sys
from pathlib import Path

QUIET = "--quiet" in sys.argv

REPO = Path(__file__).resolve().parents[1]

# Rules live under every artefact root post-monorepo Phase 4.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib.agent_src import artefact_roots  # noqa: E402

RULES_DIRS = [root / "rules" for root in artefact_roots() if (root / "rules").is_dir()]

VALID_TIERS = frozenset({"1", "2a", "2b", "3", "safety-floor", "mechanical-already"})


def parse_tier(text: str) -> str | None:
    if not text.startswith("---\n"):
        return None
    end = text.find("\n---\n", 4)
    if end == -1:
        return None
    for line in text[4:end].splitlines():
        if ":" not in line:
            continue
        k, _, v = line.partition(":")
        if k.strip() == "tier":
            return v.strip().strip('"').strip("'")
    return None


def main() -> int:
    rules: list[Path] = []
    for rules_dir in RULES_DIRS:
        rules.extend(rules_dir.glob("*.md"))
    rules.sort()
    if not rules:
        roots_label = ", ".join(str(d) for d in RULES_DIRS) or "<no rules root>"
        print(f"lint_rule_tiers: no rules found under {roots_label}", file=sys.stderr)
        return 1

    missing: list[str] = []
    invalid: list[tuple[str, str]] = []

    for rule in rules:
        tier = parse_tier(rule.read_text(encoding="utf-8"))
        if tier is None:
            missing.append(rule.name)
        elif tier not in VALID_TIERS:
            invalid.append((rule.name, tier))

    if missing or invalid:
        print(
            f"❌  lint_rule_tiers: {len(missing)} missing, "
            f"{len(invalid)} invalid (of {len(rules)} rules)",
            file=sys.stderr,
        )
        for name in missing:
            print(f"    missing tier: {name}", file=sys.stderr)
        for name, tier in invalid:
            print(f"    invalid tier '{tier}': {name}", file=sys.stderr)
        print(
            f"    valid tiers: {sorted(VALID_TIERS)}",
            file=sys.stderr,
        )
        return 1

    if not QUIET:
        print(f"✅  lint_rule_tiers: {len(rules)} rules, all tier values valid")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
