#!/usr/bin/env python3
"""Always-rule budget gate (Phases 7.1 + 7.4 of road-to-pr-34-followups,
extended by Phase 0.2 of road-to-structural-optimization).

Enforces the budget contract under **Model (b) literal** — see
`docs/contracts/load-context-budget-model.md`. Effective size of a
`type: "always"` rule is its own char count plus the char count of
every context it loads (transitively, depth ≤ 2).

Caps:
- Warn-at-80% / fail-at-90% global trend gate (Phase 7.1).
- Per-rule cap (≤ 6,000 chars per always-rule, Phase 7.4) — measured
  on extended size, with a transitional `KNOWN_PER_RULE_BREACHES`
  allowlist that Phase 2A retires.
- Top-3 cap (top-3 combined ≤ 50% of TOTAL_CAP, Phase 7.4) — extended.
- Depth-2 nesting cap on `load_context:` chains.

Exit codes: 0 = pass (or warn), 1 = fail (≥ 90% utilization, per-rule
breach above ceiling, top-3 breach, or depth violation), 3 = internal
error.
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
RULES_DIR = REPO_ROOT / ".agent-src" / "rules"
SRC_PREFIX = ".agent-src.uncompressed/"
COMP_PREFIX = ".agent-src/"

TOTAL_CAP = 49_000
WARN_THRESHOLD = 0.80
FAIL_THRESHOLD = 0.90

# Phase 5.2.1 concentration thresholds (non-safety-floor rules only).
# Beyond the total-budget cap, fail CI when any single non-safety-floor
# rule exceeds SINGLE_PCT of used budget OR the top-3 non-safety-floor
# sum exceeds TOP3_PCT of used budget. Prevents post-slim concentration
# regrowth (risk #12 in road-to-structural-optimization).
CONCENTRATION_SINGLE_PCT = 0.12
CONCENTRATION_TOP3_PCT = 0.30

# Q3=A locked safety-floor rules — out of scope for slimming and for the
# concentration check. Their size is intentional (Iron Laws + obligation
# surface), not drift. See road-to-structural-optimization Phase 5.
SAFETY_FLOOR_RULES: frozenset[str] = frozenset({
    "non-destructive-by-default.md",
    "commit-policy.md",
    "scope-control.md",
    "verify-before-complete.md",
})

# Phase 5.3 — per-rule trend log. JSONL, one record per linter run.
# Each line: {"ts": iso8601, "total": int, "rules": {name: ext}}.
TREND_LOG = REPO_ROOT / ".github" / "budget-trend.jsonl"
TREND_LOG_MAX_RECORDS = 500
# Phase 0.2 G3 tolerance band — overshoot ≤ 2 % of cap is accepted by
# the model (b) contract; > 2 % rejects model (b) and escalates. The
# linter treats the [100 %, 100 % + tolerance] window as a hardened
# WARN that documents the transition; Phase 2A drops total below 100 %.
TOLERANCE_BAND = 0.02
PER_RULE_CAP = 6_000
TOP3_CAP = TOTAL_CAP // 2
MAX_DEPTH = 2
# Phase 1.3 Q2 (road-to-context-layer-maturity) — per-rule context count
# cap. Counts top-level `load_context:` + `load_context_eager:` entries
# per rule (not transitive depth). Empirical max in the rule set is 3
# (autonomous-execution); a 4th declared context is the structural
# signal that the rule should split, not load more.
MAX_CONTEXTS_PER_RULE = 3

# Recovery band (AI Council session 2026-05-03T12-02-42Z, verdict A1).
# When enabled, a branch in the 90–100 % gap zone passes as WARN iff its
# extended total is strictly below the last-green main baseline AND every
# per-rule / top-3 / depth cap holds. Resolves the paradox where main at
# 100.6 % passed via TOLERANCE_BAND while a strictly-better branch at
# 96.8 % failed the gap-zone gate. Phase 5 of road-to-structural-
# optimization flips this to False and enforces total < TOTAL_CAP strictly.
RECOVERY_BAND_ENABLED = True
BASELINE_FILE = REPO_ROOT / ".github" / "budget-baseline.txt"

# Transitional allowlist — per-rule extended-size breaches that Phase 2A
# of road-to-structural-optimization is contracted to retire. Each entry
# records the measured ceiling on the day Phase 0.2 was committed; a
# growth above the ceiling fails CI even while the entry remains.
# When Phase 2A retires a rule, drop its entry here AND in
# `tests/test_always_budget.py::KNOWN_PER_RULE_BREACHES`.
#
# Phase 2 of road-to-feedback-consolidation.md added a single-line
# `tier: "safety-floor"` frontmatter key (21 chars) to every safety-floor
# rule. Both ceilings below were re-baselined +21 to absorb that
# frontmatter-only growth without trimming Iron-Law content.
KNOWN_PER_RULE_BREACHES: dict[str, int] = {
    "non-destructive-by-default.md": 7_908,
    "scope-control.md": 8_550,
}


def _load_baseline() -> int | None:
    """Return the last-green main baseline char total, or None if absent.

    Reads `.github/budget-baseline.txt`; the first non-comment, non-blank
    line is parsed as an integer. Missing file or malformed content
    disables the recovery band silently — the linter falls back to the
    pre-band gate.
    """
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


def _is_always(path: Path) -> bool:
    return _frontmatter(path).get("type") == "always"


def _load_context_paths(path: Path) -> list[str]:
    fm = _frontmatter(path)
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
    """Return (set of context files counted, list of depth-violation chains)."""
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
            if not comp.exists():
                continue
            if comp in seen:
                continue
            seen.add(comp)
            stack.append((comp, depth + 1, new_chain))
    return seen, violations


def _always_rules() -> list[Path]:
    return sorted(p for p in RULES_DIR.glob("*.md") if _is_always(p))


def _all_rules() -> list[Path]:
    return sorted(RULES_DIR.glob("*.md"))


def _context_count(rule: Path) -> int:
    fm = _frontmatter(rule)
    lazy = fm.get("load_context") or []
    eager = fm.get("load_context_eager") or []
    return (len(lazy) if isinstance(lazy, list) else 0) + (
        len(eager) if isinstance(eager, list) else 0
    )


def _per_rule_count_breaches() -> list[tuple[str, int]]:
    """Phase 1.3 Q2 — return rules whose declared context count exceeds the cap."""
    out: list[tuple[str, int]] = []
    for rule in _all_rules():
        n = _context_count(rule)
        if n > MAX_CONTEXTS_PER_RULE:
            out.append((rule.name, n))
    return out


def _extended_size(rule: Path) -> tuple[int, list[tuple[str, str]]]:
    raw = rule.stat().st_size
    contexts, violations = _walk_contexts(rule)
    ext = raw + sum(c.stat().st_size for c in contexts)
    return ext, violations


def _concentration_check(
    sizes: list[tuple[str, int, int]],
    total_ext: int,
) -> tuple[list[tuple[str, int, float]], tuple[int, float] | None]:
    """Phase 5.2.1 concentration check (non-safety-floor rules only).

    Returns (single-rule breaches, top-3 breach or None). Q3=A locked
    safety-floor rules are excluded from both numerator and the top-3
    selection — their size is intentional, not drift.
    """
    non_floor = [
        (name, raw, ext) for name, raw, ext in sizes
        if name not in SAFETY_FLOOR_RULES
    ]
    single_cap = total_ext * CONCENTRATION_SINGLE_PCT
    top3_cap = total_ext * CONCENTRATION_TOP3_PCT

    single_breaches = [
        (name, ext, ext / total_ext)
        for name, _, ext in non_floor
        if ext > single_cap
    ]
    top3_sum = sum(ext for _, _, ext in non_floor[:3])
    top3_breach = (
        (top3_sum, top3_sum / total_ext)
        if top3_sum > top3_cap else None
    )
    return single_breaches, top3_breach


def _record_trend(total_ext: int, sizes: list[tuple[str, int, int]]) -> None:
    """Append the current run to the trend log (Phase 5.3)."""
    TREND_LOG.parent.mkdir(parents=True, exist_ok=True)
    record = {
        "ts": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "total": total_ext,
        "rules": {name: ext for name, _, ext in sizes},
    }
    lines: list[str] = []
    if TREND_LOG.exists():
        lines = TREND_LOG.read_text(encoding="utf-8").splitlines()
    lines.append(json.dumps(record, separators=(",", ":")))
    if len(lines) > TREND_LOG_MAX_RECORDS:
        lines = lines[-TREND_LOG_MAX_RECORDS:]
    TREND_LOG.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _last_trend() -> dict | None:
    """Return the most recent trend record, or None if log is empty."""
    if not TREND_LOG.exists():
        return None
    lines = [
        line for line in TREND_LOG.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]
    if not lines:
        return None
    try:
        return json.loads(lines[-1])
    except json.JSONDecodeError:
        return None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="suppress the per-rule breakdown unless threshold is crossed",
    )
    parser.add_argument(
        "--no-trend",
        action="store_true",
        help="skip writing to .github/budget-trend.jsonl (Phase 5.3)",
    )
    args = parser.parse_args()

    if not RULES_DIR.is_dir():
        print(f"❌  rules dir missing: {RULES_DIR}", file=sys.stderr)
        return 3

    rules = _always_rules()
    if not rules:
        print(f"❌  no always-rules found under {RULES_DIR}", file=sys.stderr)
        return 3

    sizes: list[tuple[str, int, int]] = []
    all_violations: list[tuple[str, str]] = []
    for rule in rules:
        ext, violations = _extended_size(rule)
        sizes.append((rule.name, rule.stat().st_size, ext))
        all_violations.extend(violations)

    sizes.sort(key=lambda x: -x[2])
    total_ext = sum(s[2] for s in sizes)
    pct = total_ext / TOTAL_CAP
    top3 = sum(s[2] for s in sizes[:3])
    top3_breach = top3 > TOP3_CAP

    over_per_rule: list[tuple[str, int]] = []
    grew_over_ceiling: list[tuple[str, int, int]] = []
    for name, _, ext in sizes:
        if ext <= PER_RULE_CAP:
            continue
        ceiling = KNOWN_PER_RULE_BREACHES.get(name)
        if ceiling is None:
            over_per_rule.append((name, ext))
        elif ext > ceiling:
            grew_over_ceiling.append((name, ext, ceiling))

    in_tolerance = 1.0 <= pct <= 1.0 + TOLERANCE_BAND
    baseline = _load_baseline() if RECOVERY_BAND_ENABLED else None
    in_recovery_band = (
        baseline is not None
        and FAIL_THRESHOLD <= pct < 1.0
        and total_ext < baseline
    )
    single_breaches, top3_concentration_breach = _concentration_check(
        sizes, total_ext
    )
    count_breaches = _per_rule_count_breaches()
    failing = (
        (
            pct >= FAIL_THRESHOLD
            and not in_tolerance
            and not in_recovery_band
            and pct < 1.0
        )
        or pct > 1.0 + TOLERANCE_BAND
        or over_per_rule
        or grew_over_ceiling
        or top3_breach
        or all_violations
        or single_breaches
        or top3_concentration_breach is not None
        or count_breaches
    )
    if failing:
        status, rc = "❌  FAIL", 1
    elif in_tolerance:
        status, rc = "⚠️  WARN (G3 tolerance band)", 0
    elif in_recovery_band:
        status, rc = (
            f"⚠️  WARN (recovery band, baseline {baseline:,})",
            0,
        )
    elif pct >= WARN_THRESHOLD:
        status, rc = "⚠️  WARN", 0
    else:
        status, rc = "✅  OK", 0

    print(
        f"{status}  always-rule extended budget: {total_ext:,} / "
        f"{TOTAL_CAP:,} chars ({pct * 100:.1f}%) across {len(rules)} rule(s)"
    )
    print(
        f"      thresholds: warn {WARN_THRESHOLD * 100:.0f}% · "
        f"fail {FAIL_THRESHOLD * 100:.0f}% · "
        f"per-rule ≤ {PER_RULE_CAP:,} (ext) · top-3 ≤ {TOP3_CAP:,} (ext) · "
        f"depth ≤ {MAX_DEPTH}"
    )

    if rc != 0 or pct >= WARN_THRESHOLD or not args.quiet:
        print()
        print(f"      breakdown (largest extended first; top-3 sum = {top3:,}):")
        for i, (name, raw, ext) in enumerate(sizes):
            tag = " (top-3)" if i < 3 else ""
            ceiling = KNOWN_PER_RULE_BREACHES.get(name)
            if ceiling is not None:
                marker = f"  ⚠️  allowlisted ≤ {ceiling:,}"
            elif ext > PER_RULE_CAP:
                marker = "  ❌  per-rule breach"
            else:
                marker = ""
            print(
                f"        ext={ext:>5}  raw={raw:>5}  {name}{tag}{marker}"
            )

    if over_per_rule:
        names = ", ".join(f"{n}={s:,}" for n, s in over_per_rule)
        print(
            f"\n      Per-rule cap breach (> {PER_RULE_CAP:,} chars, not allowlisted): "
            f"{names}"
        )

    if grew_over_ceiling:
        details = ", ".join(
            f"{n}={ext:,} > ceiling {ceiling:,}"
            for n, ext, ceiling in grew_over_ceiling
        )
        print(
            f"\n      Allowlisted-breach growth (regression): {details}"
        )

    if top3_breach:
        print(
            f"\n      Top-3 cap breach: {top3:,} > {TOP3_CAP:,} chars "
            f"(top-3 must stay ≤ 50% of {TOTAL_CAP:,} total budget)."
        )

    if all_violations:
        print(
            f"\n      Depth-{MAX_DEPTH} nesting cap violations:"
        )
        for rule_name, chain in all_violations:
            print(f"        {rule_name}: {chain}")

    if single_breaches:
        details = ", ".join(
            f"{n}={ext:,} ({frac * 100:.1f}%)"
            for n, ext, frac in single_breaches
        )
        print(
            f"\n      Concentration breach (single rule > "
            f"{CONCENTRATION_SINGLE_PCT * 100:.0f}% of used budget, "
            f"non-allowlisted): {details}"
        )

    if top3_concentration_breach is not None:
        sum_, frac = top3_concentration_breach
        print(
            f"\n      Concentration breach (top-3 non-allowlisted > "
            f"{CONCENTRATION_TOP3_PCT * 100:.0f}% of used budget): "
            f"{sum_:,} ({frac * 100:.1f}%)"
        )

    if count_breaches:
        details = ", ".join(f"{n}={c}" for n, c in count_breaches)
        print(
            f"\n      Per-rule context-count cap breach "
            f"(> {MAX_CONTEXTS_PER_RULE} declared contexts, Q2 "
            f"road-to-context-layer-maturity Phase 1.3): {details}"
        )

    # Phase 5.3 — per-rule trend delta vs. previous run.
    prev = _last_trend()
    if prev is not None and not args.quiet:
        prev_total = prev.get("total")
        prev_rules = prev.get("rules") or {}
        if isinstance(prev_total, int):
            delta_total = total_ext - prev_total
            sign = "+" if delta_total >= 0 else ""
            print(
                f"\n      Trend vs. previous run "
                f"({prev.get('ts', '?')}): total {sign}{delta_total:,} chars"
            )
            deltas: list[tuple[str, int, int]] = []
            for name, _, ext in sizes:
                old = prev_rules.get(name)
                if isinstance(old, int) and old != ext:
                    deltas.append((name, ext - old, ext))
            if deltas:
                deltas.sort(key=lambda x: -abs(x[1]))
                for name, d, ext in deltas[:5]:
                    s = "+" if d >= 0 else ""
                    print(f"        {name}: {s}{d:,} (now {ext:,})")

    if not args.no_trend:
        _record_trend(total_ext, sizes)

    if rc == 1:
        print(
            f"\n      Action: trim the offending rule(s) via load_context: "
            f"extraction (see contexts/execution + contexts/authority) "
            f"until utilization drops below {FAIL_THRESHOLD * 100:.0f}% "
            f"and all per-rule / top-3 / depth caps hold. See "
            f"docs/contracts/load-context-budget-model.md."
        )

    return rc


if __name__ == "__main__":
    sys.exit(main())
