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
import sys
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
RULES_DIR = REPO_ROOT / ".agent-src" / "rules"
SRC_PREFIX = ".agent-src.uncompressed/"
COMP_PREFIX = ".agent-src/"

TOTAL_CAP = 49_000
WARN_THRESHOLD = 0.80
FAIL_THRESHOLD = 0.90
# Phase 0.2 G3 tolerance band — overshoot ≤ 2 % of cap is accepted by
# the model (b) contract; > 2 % rejects model (b) and escalates. The
# linter treats the [100 %, 100 % + tolerance] window as a hardened
# WARN that documents the transition; Phase 2A drops total below 100 %.
TOLERANCE_BAND = 0.02
PER_RULE_CAP = 6_000
TOP3_CAP = TOTAL_CAP // 2
MAX_DEPTH = 2

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
KNOWN_PER_RULE_BREACHES: dict[str, int] = {
    "non-destructive-by-default.md": 7_887,
    "scope-control.md": 8_529,
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


def _extended_size(rule: Path) -> tuple[int, list[tuple[str, str]]]:
    raw = rule.stat().st_size
    contexts, violations = _walk_contexts(rule)
    ext = raw + sum(c.stat().st_size for c in contexts)
    return ext, violations


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
