"""F1.5 CI guard — `type: "always"` rule budget under model (b) literal.

Hard cap from `road-to-governance-cleanup.md` Finding 1: Augmentcode
considers ~49,000 chars across all always-active rules a safety budget.
Phase 0.2 of `road-to-structural-optimization` switched the metric from
**raw** rule size to **extended** size (rule + every transitively
loaded context file, depth ≤ 2) — see
`docs/contracts/load-context-budget-model.md`.

The numbers must match the `Budget contracts` table in
`docs/contracts/STABILITY.md`. The G3 tolerance band (≤ 2 % overshoot
of the total cap) is enforced here as a soft pass; growth beyond the
band fails. Per-rule cap uses the transitional `KNOWN_PER_RULE_BREACHES`
allowlist that Phase 2A retires.
"""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
RULES_DIR = REPO_ROOT / ".agent-src" / "rules"
SRC_PREFIX = ".agent-src.uncompressed/"
COMP_PREFIX = ".agent-src/"

TOTAL_CAP = 49_000
TOLERANCE_BAND = 0.02  # G3 — overshoot ≤ 2 % accepted while Phase 2A pending
FAIL_THRESHOLD = 0.90
PER_RULE_CAP = 6_000
TOP3_CAP = TOTAL_CAP // 2

# Recovery band — mirrors `scripts/check_always_budget.py`. AI Council
# session 2026-05-03T12-02-42Z, verdict A1: a branch in the 90–100 %
# gap zone passes iff its extended total is strictly below the
# last-green main baseline AND every per-rule / top-3 / depth cap holds.
RECOVERY_BAND_ENABLED = True
BASELINE_FILE = REPO_ROOT / ".github" / "budget-baseline.txt"


def _load_baseline() -> int | None:
    if not BASELINE_FILE.exists():
        return None
    for line in BASELINE_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        try:
            return int(line)
        except ValueError:
            return None
    return None
# Phase 0b.1 (F13) — top-5 baseline ceiling. Originally locked at 33,510
# chars on the `feat/better-basement` shipping branch (post-`no-cheap-
# questions` trim). Phase 0b.2 (F10) trim of `language-and-tone` dropped
# the rule from rank 3 to rank 8 (5,832 → 3,969 chars), pulling the top-5
# sum down to 32,874 with `ask-when-uncertain` (5,196) entering rank 5.
# Failure mode pinned: the top-5 always-rule extended sum grows beyond this
# ceiling without an accompanying trim, signalling that Phase 0b.2 budget
# headroom is regressing. Trims that push the ceiling DOWN must update this
# constant in the same commit.
TOP5_CEILING = 32_874
MAX_DEPTH = 2

# Mirrors `scripts/check_always_budget.py::KNOWN_PER_RULE_BREACHES`.
# Phase 2A retires entries; growth above the recorded ceiling fails CI.
KNOWN_PER_RULE_BREACHES: dict[str, int] = {
    "non-destructive-by-default.md": 7_887,
    "scope-control.md": 8_529,
}


def _frontmatter(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        return {}
    end = text.find("\n---\n", 4)
    if end == -1:
        return {}
    try:
        return yaml.safe_load(text[4:end]) or {}
    except yaml.YAMLError:
        return {}


def _is_always(p: Path) -> bool:
    return _frontmatter(p).get("type") == "always"


def _load_context_paths(p: Path) -> list[str]:
    fm = _frontmatter(p)
    out: list[str] = []
    for key in ("load_context", "load_context_eager"):
        for entry in fm.get(key) or []:
            out.append(str(entry))
    return out


def _src_to_compressed(entry: str) -> Path:
    if entry.startswith(SRC_PREFIX):
        return REPO_ROOT / (COMP_PREFIX + entry[len(SRC_PREFIX):])
    return REPO_ROOT / entry


def _walk_contexts(rule: Path) -> tuple[set[Path], list[tuple[str, str]]]:
    seen: set[Path] = set()
    violations: list[tuple[str, str]] = []
    stack: list[tuple[Path, int, str]] = [(rule, 0, rule.name)]
    while stack:
        node, depth, chain = stack.pop()
        for entry in _load_context_paths(node):
            comp = _src_to_compressed(entry)
            new_chain = f"{chain} → {entry}"
            if depth + 1 > MAX_DEPTH:
                violations.append((rule.name, new_chain))
                continue
            if not comp.exists() or comp in seen:
                continue
            seen.add(comp)
            stack.append((comp, depth + 1, new_chain))
    return seen, violations


def _always_rules() -> list[Path]:
    return sorted(p for p in RULES_DIR.glob("*.md") if _is_always(p))


def _extended_size(rule: Path) -> int:
    contexts, _ = _walk_contexts(rule)
    return rule.stat().st_size + sum(c.stat().st_size for c in contexts)


def test_always_rules_total_extended_within_tolerance() -> None:
    rules = _always_rules()
    sizes = [(r.name, _extended_size(r)) for r in rules]
    total = sum(s for _, s in sizes)
    upper = int(TOTAL_CAP * (1 + TOLERANCE_BAND))
    assert total <= upper, (
        f"always-rule extended budget breach beyond G3 tolerance: "
        f"{total} > {upper} chars (cap {TOTAL_CAP}, tolerance "
        f"{TOLERANCE_BAND * 100:.0f}%) across {len(rules)} rules.\n"
        + "\n".join(
            f"  {n}: {s}" for n, s in sorted(sizes, key=lambda x: -x[1])
        )
    )


def test_recovery_band_invariant() -> None:
    """Mirrors the linter's recovery-band gate.

    When the recovery band is enabled and the current total sits in the
    90–100 % gap zone, it must be strictly below the baseline recorded
    in `.github/budget-baseline.txt`. Failure here means the linter
    would also fail — keeps test and script in lock-step.
    """
    if not RECOVERY_BAND_ENABLED:
        pytest.skip("recovery band disabled; gap-zone is a hard fail")
    total = sum(_extended_size(r) for r in _always_rules())
    pct = total / TOTAL_CAP
    if pct < FAIL_THRESHOLD or pct >= 1.0:
        return
    baseline = _load_baseline()
    assert baseline is not None, (
        "recovery band engaged (90–100 %% gap zone) but no baseline file "
        f"at {BASELINE_FILE} — cannot verify branch is strictly better "
        "than main. Either trim below 90 %% or record a baseline."
    )
    assert total < baseline, (
        f"recovery-band breach: branch total {total:,} ≥ baseline "
        f"{baseline:,}. Branch must be strictly better than the last-"
        "green main to claim the recovery band carve-out."
    )


def test_no_unallowlisted_per_rule_breach() -> None:
    over: list[tuple[str, int]] = []
    for r in _always_rules():
        ext = _extended_size(r)
        if ext <= PER_RULE_CAP:
            continue
        if r.name not in KNOWN_PER_RULE_BREACHES:
            over.append((r.name, ext))
    assert not over, (
        f"per-rule extended cap breach (> {PER_RULE_CAP} chars, "
        f"not allowlisted): "
        + ", ".join(f"{n}={s}" for n, s in over)
    )


def test_allowlisted_breaches_do_not_grow() -> None:
    grew: list[tuple[str, int, int]] = []
    for r in _always_rules():
        ceiling = KNOWN_PER_RULE_BREACHES.get(r.name)
        if ceiling is None:
            continue
        ext = _extended_size(r)
        if ext > ceiling:
            grew.append((r.name, ext, ceiling))
    assert not grew, (
        "allowlisted per-rule breach grew above its recorded ceiling: "
        + ", ".join(
            f"{n}={ext} > {ceiling}" for n, ext, ceiling in grew
        )
    )


def test_top3_extended_under_cap() -> None:
    sizes = sorted(
        (_extended_size(r) for r in _always_rules()), reverse=True
    )
    top3 = sum(sizes[:3])
    assert top3 <= TOP3_CAP, (
        f"top-3 always-rule extended cap breach: {top3} > {TOP3_CAP} "
        f"chars (top-3 must stay ≤ 50% of {TOTAL_CAP} total budget)."
    )


def test_top5_extended_under_ceiling() -> None:
    """Phase 0b.1 (F13) — top-5 sum must not regress past the locked ceiling.

    Failure-mode replay for Phase 0b.2 budget headroom: an unrelated rule
    edit silently grows one of the top-5 rules. The total-budget test still
    passes because the growth fits under the 2 % tolerance, but headroom
    recovery work is being undone. This test fires before that drift ships.
    """
    sizes = sorted(
        (_extended_size(r) for r in _always_rules()), reverse=True
    )
    top5 = sum(sizes[:5])
    assert top5 <= TOP5_CEILING, (
        f"top-5 always-rule extended ceiling breach: {top5} > {TOP5_CEILING} "
        f"chars. Either trim a top-5 rule back under the ceiling, or update "
        f"TOP5_CEILING in tests/test_always_budget.py with a justification "
        f"in the commit message."
    )


def test_load_context_depth_within_cap() -> None:
    violations: list[tuple[str, str]] = []
    for r in _always_rules():
        _, v = _walk_contexts(r)
        violations.extend(v)
    assert not violations, (
        f"load_context: chain exceeds depth-{MAX_DEPTH} cap:\n"
        + "\n".join(f"  {n}: {chain}" for n, chain in violations)
    )
