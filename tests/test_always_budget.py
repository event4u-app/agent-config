"""F1.5 CI guard — total `type: "always"` rule chars must stay ≤ 49k.

Hard cap from `road-to-governance-cleanup.md` Finding 1: Augmentcode considers
~49,000 chars across all always-active rules a safety budget. Breach risks
context-window pressure on every reply. The cap, the per-rule cap, and the
top-3 cap are enforced here so a future PR cannot reintroduce the breach.

Phase 7.4 of `road-to-pr-34-followups` tightened the per-rule cap from
8,000 → 6,000 chars and replaced the top-5 (≤ 28,000) cap with a
top-3 (≤ 50% of total budget) cap. Numbers must match the
`Budget contracts` table in `docs/contracts/STABILITY.md`.
"""

from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
RULES_DIR = REPO_ROOT / ".agent-src" / "rules"

TOTAL_CAP = 49_000
PER_RULE_CAP = 6_000
TOP3_CAP = TOTAL_CAP // 2  # 24,500 chars — top-3 combined ≤ 50% of total


def _always_rules() -> list[Path]:
    return sorted(
        f for f in RULES_DIR.glob("*.md")
        if f.read_text(encoding="utf-8").splitlines()[1:2] == ['type: "always"']
    )


def test_always_rules_total_chars_under_cap() -> None:
    rules = _always_rules()
    sizes = [(f.name, f.stat().st_size) for f in rules]
    total = sum(s for _, s in sizes)
    assert total <= TOTAL_CAP, (
        f"always-rule budget breach: {total} > {TOTAL_CAP} chars across "
        f"{len(rules)} rules.\n"
        + "\n".join(f"  {n}: {s}" for n, s in sorted(sizes, key=lambda x: -x[1]))
    )


def test_no_single_always_rule_over_per_rule_cap() -> None:
    over = [
        (f.name, f.stat().st_size)
        for f in _always_rules()
        if f.stat().st_size > PER_RULE_CAP
    ]
    assert not over, (
        f"per-rule cap breach (> {PER_RULE_CAP} chars): "
        + ", ".join(f"{n}={s}" for n, s in over)
    )


def test_top3_always_rules_under_cap() -> None:
    sizes = sorted((f.stat().st_size for f in _always_rules()), reverse=True)
    top3 = sum(sizes[:3])
    assert top3 <= TOP3_CAP, (
        f"top-3 always-rule cap breach: {top3} > {TOP3_CAP} chars "
        f"(top-3 must stay ≤ 50% of {TOTAL_CAP} total budget)."
    )
