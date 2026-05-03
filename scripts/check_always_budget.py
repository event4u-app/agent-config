#!/usr/bin/env python3
"""Always-rule budget gate (Phases 7.1 + 7.4 of road-to-pr-34-followups).

Enforces a stricter budget contract than `tests/test_always_budget.py`:
the test suite fails only at 100% utilization (49,000 chars). This
script lives in CI as:

- Warn-at-80% / fail-at-90% global trend gate (Phase 7.1).
- Per-rule cap (≤ 6,000 chars per always-rule, Phase 7.4).
- Top-3 cap (top-3 combined ≤ 50% of TOTAL_CAP, Phase 7.4).

The same caps are enforced as hard assertions in
`tests/test_always_budget.py`; this script duplicates them so a
contributor sees a single, fast pre-test signal during local edits.

Exit codes: 0 = pass (or warn), 1 = fail (≥ 90% utilization,
per-rule breach, or top-3 breach), 3 = internal error.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
RULES_DIR = REPO_ROOT / ".agent-src" / "rules"

TOTAL_CAP = 49_000
WARN_THRESHOLD = 0.80   # 80% — emit warning, exit 0
FAIL_THRESHOLD = 0.90   # 90% — emit error,  exit 1
PER_RULE_CAP = 6_000    # Phase 7.4 — no single always-rule may exceed this
TOP3_CAP = TOTAL_CAP // 2  # Phase 7.4 — top-3 combined ≤ 50% of total budget


def _always_rules() -> list[Path]:
    rules: list[Path] = []
    for path in sorted(RULES_DIR.glob("*.md")):
        head = path.read_text(encoding="utf-8").splitlines()[1:2]
        if head == ['type: "always"']:
            rules.append(path)
    return rules


def _summary(rules: list[Path]) -> tuple[int, list[tuple[str, int]]]:
    sizes = [(p.name, p.stat().st_size) for p in rules]
    return sum(s for _, s in sizes), sorted(sizes, key=lambda x: -x[1])


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="suppress the per-rule breakdown unless threshold is crossed",
    )
    args = parser.parse_args()

    if not RULES_DIR.is_dir():
        print(f"❌  rules dir missing: {RULES_DIR}", file=sys.stderr)
        return 3

    rules = _always_rules()
    if not rules:
        print(f"❌  no always-rules found under {RULES_DIR}", file=sys.stderr)
        return 3

    total, sizes = _summary(rules)
    pct = total / TOTAL_CAP
    over_per_rule = [(n, s) for n, s in sizes if s > PER_RULE_CAP]
    top3 = sum(s for _, s in sizes[:3])
    top3_breach = top3 > TOP3_CAP

    if pct >= FAIL_THRESHOLD or over_per_rule or top3_breach:
        status = "❌  FAIL"
        rc = 1
    elif pct >= WARN_THRESHOLD:
        status = "⚠️  WARN"
        rc = 0
    else:
        status = "✅  OK"
        rc = 0

    print(
        f"{status}  always-rule budget: {total:,} / {TOTAL_CAP:,} chars "
        f"({pct * 100:.1f}%) across {len(rules)} rule(s)"
    )
    print(
        f"      thresholds: warn {WARN_THRESHOLD * 100:.0f}% · "
        f"fail {FAIL_THRESHOLD * 100:.0f}% · "
        f"per-rule ≤ {PER_RULE_CAP:,} · top-3 ≤ {TOP3_CAP:,}"
    )

    if rc != 0 or pct >= WARN_THRESHOLD or not args.quiet:
        print()
        print(f"      breakdown (largest first; top-3 sum = {top3:,}):")
        for i, (name, size) in enumerate(sizes):
            mark = "  ❌" if size > PER_RULE_CAP else ""
            tag = " (top-3)" if i < 3 else ""
            print(f"        {size:>5}  {name}{tag}{mark}")

    if over_per_rule:
        names = ", ".join(f"{n}={s:,}" for n, s in over_per_rule)
        print(
            f"\n      Per-rule cap breach (> {PER_RULE_CAP:,} chars): {names}"
        )

    if top3_breach:
        print(
            f"\n      Top-3 cap breach: {top3:,} > {TOP3_CAP:,} chars "
            f"(top-3 must stay ≤ 50% of {TOTAL_CAP:,} total budget)."
        )

    if rc == 1:
        print(
            f"\n      Action: trim the offending rule(s) via load_context: "
            f"extraction (see contexts/execution + contexts/authority) "
            f"until utilization drops below {FAIL_THRESHOLD * 100:.0f}% "
            f"and all per-rule / top-3 caps hold."
        )

    return rc


if __name__ == "__main__":
    sys.exit(main())
