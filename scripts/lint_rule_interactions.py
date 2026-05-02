#!/usr/bin/env python3
"""Lint docs/contracts/rule-interactions.yml.

Validates:
  - Schema (required fields per pair)
  - All rule slugs in `rules:` exist as `.agent-src.uncompressed/rules/<slug>.md`
  - Every pair references rules listed in the top-level `rules:` block
  - `relation` is one of the allowed values
  - All `evidence:` entries point at real files (anchors are advisory, not checked)
  - Pair `id`s are unique
  - The anchor pair from `road-to-post-pr29-optimize.md` Phase 2 is present:
    `non-destructive-by-default` × {autonomous-execution, scope-control,
    commit-policy, ask-when-uncertain, verify-before-complete}.

Exits non-zero on any failure. Used in CI via Taskfile target
`lint-rule-interactions`.
"""
from __future__ import annotations

import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
MATRIX = ROOT / "docs" / "contracts" / "rule-interactions.yml"
RULES_DIR = ROOT / ".agent-src.uncompressed" / "rules"

ALLOWED_RELATIONS = {
    "overrides",
    "narrows",
    "defers_to",
    "restates",
    "gates",
    "complements",
}

REQUIRED_PAIR_FIELDS = {"id", "rules", "relation", "conflict", "resolution", "evidence"}

ANCHOR_PARTNERS = {
    "autonomous-execution",
    "scope-control",
    "commit-policy",
    "ask-when-uncertain",
    "verify-before-complete",
}
ANCHOR_RULE = "non-destructive-by-default"


def fail(errors: list[str]) -> None:
    print(f"❌  rule-interactions.yml — {len(errors)} issue(s):")
    for e in errors:
        print(f"  • {e}")
    sys.exit(1)


def main() -> int:
    if not MATRIX.exists():
        fail([f"{MATRIX.relative_to(ROOT)} is missing"])

    data = yaml.safe_load(MATRIX.read_text())
    errors: list[str] = []

    if not isinstance(data, dict):
        fail(["top-level YAML must be a mapping"])

    if data.get("version") != 1:
        errors.append("version must be 1")

    declared_rules = data.get("rules") or []
    if not isinstance(declared_rules, list) or not declared_rules:
        errors.append("`rules:` must be a non-empty list of slugs")

    for slug in declared_rules:
        if not isinstance(slug, str):
            errors.append(f"rule slug not a string: {slug!r}")
            continue
        rule_path = RULES_DIR / f"{slug}.md"
        if not rule_path.exists():
            errors.append(f"rule slug `{slug}` has no file at {rule_path.relative_to(ROOT)}")

    pairs = data.get("pairs") or []
    if not isinstance(pairs, list) or not pairs:
        errors.append("`pairs:` must be a non-empty list")

    seen_ids: set[str] = set()
    declared_set = set(declared_rules) if isinstance(declared_rules, list) else set()
    anchor_partners_seen: set[str] = set()

    for idx, pair in enumerate(pairs):
        if not isinstance(pair, dict):
            errors.append(f"pair[{idx}] is not a mapping")
            continue
        missing = REQUIRED_PAIR_FIELDS - set(pair)
        if missing:
            errors.append(f"pair[{idx}] missing fields: {sorted(missing)}")
            continue

        pid = pair["id"]
        if pid in seen_ids:
            errors.append(f"duplicate pair id: {pid}")
        seen_ids.add(pid)

        rules_pair = pair["rules"]
        if not (isinstance(rules_pair, list) and len(rules_pair) == 2):
            errors.append(f"pair `{pid}` rules must be a 2-element list")
            continue
        for r in rules_pair:
            if r not in declared_set:
                errors.append(f"pair `{pid}` references undeclared rule `{r}`")

        if pair["relation"] not in ALLOWED_RELATIONS:
            errors.append(
                f"pair `{pid}` relation `{pair['relation']}` not in {sorted(ALLOWED_RELATIONS)}"
            )

        evidence = pair.get("evidence") or []
        if not isinstance(evidence, list) or not evidence:
            errors.append(f"pair `{pid}` evidence must be a non-empty list")
        for citation in evidence:
            if not isinstance(citation, str):
                errors.append(f"pair `{pid}` evidence item not a string: {citation!r}")
                continue
            file_part = citation.split("#", 1)[0]
            if not (ROOT / file_part).exists():
                errors.append(f"pair `{pid}` evidence path does not exist: {file_part}")

        # Anchor coverage check
        if ANCHOR_RULE in rules_pair:
            partner = next((r for r in rules_pair if r != ANCHOR_RULE), None)
            if partner in ANCHOR_PARTNERS:
                anchor_partners_seen.add(partner)

    missing_anchors = ANCHOR_PARTNERS - anchor_partners_seen
    if missing_anchors:
        errors.append(
            f"anchor pairs missing for `{ANCHOR_RULE}` × {sorted(missing_anchors)} "
            "(required by road-to-post-pr29-optimize.md P2.2)"
        )

    if errors:
        fail(errors)

    print(f"✅  rule-interactions.yml clean — {len(declared_rules)} rules, {len(pairs)} pairs.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
