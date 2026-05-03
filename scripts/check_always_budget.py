#!/usr/bin/env python3
"""Always-rule budget gate (Phase 7.1 of road-to-pr-34-followups).

Enforces a stricter budget contract than `tests/test_always_budget.py`:
the test suite fails only at 100% utilization (49,000 chars). This
script lives in CI as a warn-at-80% / fail-at-90% gate so the budget
trends are surfaced *before* the hard cap is reached.

Per-rule and top-N caps are owned by `tests/test_always_budget.py`
and intentionally not duplicated here — this script is the global
trend gate, not the per-rule enforcement.

Exit codes: 0 = pass (or warn), 1 = fail (≥ 90% utilization),
3 = internal error.
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

    if pct >= FAIL_THRESHOLD:
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
    print(f"      thresholds: warn {WARN_THRESHOLD * 100:.0f}% · fail {FAIL_THRESHOLD * 100:.0f}%")

    if rc != 0 or pct >= WARN_THRESHOLD or not args.quiet:
        print()
        print("      breakdown (largest first):")
        for name, size in sizes:
            print(f"        {size:>5}  {name}")

    if rc == 1:
        print(
            f"\n      Action: trim a rule via load_context: extraction "
            f"(see contexts/execution + contexts/authority) until "
            f"utilization drops below {FAIL_THRESHOLD * 100:.0f}%."
        )

    return rc


if __name__ == "__main__":
    sys.exit(main())
