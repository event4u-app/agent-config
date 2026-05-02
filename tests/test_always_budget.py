"""F1.5 CI guard — total `type: "always"` rule chars must stay ≤ 49k.

Hard cap from `road-to-governance-cleanup.md` Finding 1: Augmentcode considers
~49,000 chars across all always-active rules a safety budget. Breach risks
context-window pressure on every reply. The cap, the per-rule cap, and the
top-5 cap are enforced here so a future PR cannot reintroduce the breach.
"""

from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
RULES_DIR = REPO_ROOT / ".agent-src" / "rules"

TOTAL_CAP = 49_000
PER_RULE_CAP = 8_000
TOP5_CAP = 28_000


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


def test_top5_always_rules_under_cap() -> None:
    sizes = sorted((f.stat().st_size for f in _always_rules()), reverse=True)
    top5 = sum(sizes[:5])
    assert top5 <= TOP5_CAP, (
        f"top-5 always-rule cap breach: {top5} > {TOP5_CAP} chars."
    )
