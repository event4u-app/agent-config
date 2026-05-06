#!/usr/bin/env python3
"""Measure rule-bucket char counts (kernel + auto) for the rule-kernel roadmap.

Source of truth: `.agent-src.uncompressed/rules/*.md`. Frontmatter (YAML
between two `---` lines at file start) is stripped before counting; only
the rule body counts toward the bucket.

Buckets follow the existing frontmatter `type:` field:
- `always` rules → always-bucket (today's kernel proxy).
- `auto` rules → auto-bucket.

Output:
- Default: stdout table (per-rule rows, top-5 oversize, totals).
- `--json`: deterministic JSON (sorted keys, sorted lists).

Acceptance per `road-to-kernel-and-router.md` P1.1: re-runnable,
deterministic, stdlib-only, no network.
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RULES_DIR = REPO_ROOT / ".agent-src.uncompressed" / "rules"
OVERRIDES_FILE = REPO_ROOT / "docs" / "contracts" / "iron-law-overrides.txt"
TREND_FILE = REPO_ROOT / "agents" / ".rule-budget-history.jsonl"

# Council R2 amendments (2026-05-06) — see docs/contracts/kernel-membership.md § 5.1.
# Per-rule cap raised 1.5k → 2.5k; warning band raised 1.2k → 2.0k.
# ADR-002 (2026-05-06) — KERNEL_HARD raised 25k → 26k after empirical r_actual=0.795
# vs r_projected=0.712; see docs/decisions/ADR-002-kernel-bucket-overrides.md.
KERNEL_HARD = 26_000
KERNEL_TARGET = 20_000
PER_RULE_HARD = 2_500
PER_RULE_TARGET = 2_000
PER_RULE_OVERRIDE_CEILING = 4_000  # Iron-Law-override ADR ceiling.

# Locked kernel set — docs/contracts/kernel-membership.md § 4.
# This is the *kernel* (P1.3 lock), not "every always-rule". After P4 the
# `type:` frontmatter no longer maps 1:1 to kernel; the kernel is this set.
KERNEL_RULES: frozenset[str] = frozenset(
    {
        "agent-authority",
        "ask-when-uncertain",
        "commit-policy",
        "direct-answers",
        "language-and-tone",
        "no-cheap-questions",
        "non-destructive-by-default",
        "scope-control",
        "verify-before-complete",
    }
)


def strip_frontmatter(text: str) -> tuple[str, dict[str, str]]:
    """Strip leading YAML frontmatter and return (body, fields).

    Minimal parser — handles `key: "value"` / `key: value` only. No nested
    structures, no lists. Sufficient for the rule frontmatter contract.
    """
    if not text.startswith("---\n"):
        return text, {}
    end = text.find("\n---\n", 4)
    if end == -1:
        return text, {}
    raw = text[4:end]
    body = text[end + 5 :]
    fields: dict[str, str] = {}
    for line in raw.splitlines():
        if ":" not in line or line.startswith("#"):
            continue
        key, _, val = line.partition(":")
        fields[key.strip()] = val.strip().strip('"').strip("'")
    return body, fields


def measure_rule(path: Path) -> dict[str, object]:
    text = path.read_text(encoding="utf-8")
    body, fields = strip_frontmatter(text)
    return {
        "id": path.stem,
        "type": fields.get("type", "auto"),
        "tier": fields.get("tier", ""),
        "chars": len(body),
        "lines": body.count("\n"),
    }


def collect() -> list[dict[str, object]]:
    rules = [measure_rule(p) for p in sorted(RULES_DIR.glob("*.md"))]
    return rules


def load_overrides() -> set[str]:
    """Read iron-law-override allowlist (one rule-id per line, '#' comments)."""
    if not OVERRIDES_FILE.exists():
        return set()
    out: set[str] = set()
    for line in OVERRIDES_FILE.read_text(encoding="utf-8").splitlines():
        s = line.split("#", 1)[0].strip()
        if s:
            out.add(s)
    return out


def aggregate(rules: list[dict[str, object]]) -> dict[str, object]:
    always = [r for r in rules if r["type"] == "always"]
    auto = [r for r in rules if r["type"] == "auto"]
    kernel = [r for r in rules if r["id"] in KERNEL_RULES]
    total_chars = sum(int(r["chars"]) for r in rules)
    return {
        "always_count": len(always),
        "auto_count": len(auto),
        "kernel_count": len(kernel),
        "rule_count": len(rules),
        "always_chars": sum(int(r["chars"]) for r in always),
        "auto_chars": sum(int(r["chars"]) for r in auto),
        "kernel_chars": sum(int(r["chars"]) for r in kernel),
        "total_chars": total_chars,
        "kernel_hard": KERNEL_HARD,
        "kernel_target": KERNEL_TARGET,
        "per_rule_hard": PER_RULE_HARD,
        "per_rule_target": PER_RULE_TARGET,
        "per_rule_override_ceiling": PER_RULE_OVERRIDE_CEILING,
        "oversize_rules": sorted(
            (r for r in rules if int(r["chars"]) > PER_RULE_HARD),
            key=lambda r: (-int(r["chars"]), r["id"]),
        ),
        "top5_largest": sorted(rules, key=lambda r: (-int(r["chars"]), r["id"]))[:5],
    }


def render_table(rules: list[dict[str, object]], agg: dict[str, object]) -> str:
    lines: list[str] = []
    lines.append("Rule budget — source: .agent-src.uncompressed/rules/")
    lines.append("")
    lines.append(f"{'id':<40} {'type':<7} {'tier':<5} {'chars':>7}")
    lines.append("-" * 62)
    for r in sorted(rules, key=lambda r: r["id"]):
        flag = "!" if int(r["chars"]) > PER_RULE_HARD else (
            "~" if int(r["chars"]) > PER_RULE_TARGET else " "
        )
        lines.append(
            f"{r['id']:<40} {r['type']:<7} {str(r['tier']):<5} {r['chars']:>6}{flag}"
        )
    lines.append("")
    lines.append(
        f"kernel-bucket: {agg['kernel_chars']:>6} chars across {agg['kernel_count']} rules "
        f"(target ≤ {KERNEL_TARGET}, hard ≤ {KERNEL_HARD})"
    )
    lines.append(
        f"always-bucket: {agg['always_chars']:>6} chars across {agg['always_count']} rules "
        f"(legacy frontmatter `type: always`)"
    )
    lines.append(
        f"  auto-bucket: {agg['auto_chars']:>6} chars across {agg['auto_count']} rules"
    )
    lines.append(f"        total: {agg['total_chars']:>6} chars across {agg['rule_count']} rules")
    lines.append("")
    lines.append(f"top-5 largest:")
    for r in agg["top5_largest"]:  # type: ignore[index]
        lines.append(f"  {r['chars']:>5}  {r['id']}  ({r['type']})")
    over = agg["oversize_rules"]  # type: ignore[index]
    if over:
        lines.append("")
        lines.append(f"OVER per-rule hard cap ({PER_RULE_HARD} chars): {len(over)} rule(s)")
    return "\n".join(lines)


def kernel_budget_check(
    rules: list[dict[str, object]], agg: dict[str, object], overrides: set[str]
) -> tuple[int, list[str]]:
    """Enforce kernel budget per Council R2 amendments.

    Returns (exit_code, report_lines). Exit 0 = pass, 1 = breach.

    Checks:
    - Kernel-bucket sum ≤ KERNEL_HARD (25k).
    - Each kernel rule ≤ PER_RULE_HARD (2.5k), unless listed in
      `iron-law-overrides.txt` (then ≤ PER_RULE_OVERRIDE_CEILING = 4k).
    - Missing kernel rules (rule-id in KERNEL_RULES but no file) → fail.
    """
    out: list[str] = []
    fails: list[str] = []

    kernel_rules = [r for r in rules if r["id"] in KERNEL_RULES]
    found_ids = {str(r["id"]) for r in kernel_rules}
    missing = sorted(KERNEL_RULES - found_ids)
    for mid in missing:
        fails.append(f"missing kernel rule: {mid} (declared in KERNEL_RULES, no file found)")

    bucket = int(agg["kernel_chars"])
    out.append(
        f"kernel-bucket: {bucket} / {KERNEL_HARD} chars "
        f"({agg['kernel_count']} rules)"
    )
    if bucket > KERNEL_HARD:
        fails.append(f"kernel-bucket {bucket} > hard cap {KERNEL_HARD}")

    out.append(
        f"per-rule cap: {PER_RULE_HARD} (override ceiling {PER_RULE_OVERRIDE_CEILING} "
        f"with ADR; allowlist {OVERRIDES_FILE.relative_to(REPO_ROOT)})"
    )
    out.append("")
    out.append(f"{'id':<28} {'chars':>6} {'cap':>6} {'status':<24}")
    out.append("-" * 68)
    for r in sorted(kernel_rules, key=lambda r: r["id"]):
        rid = str(r["id"])
        chars = int(r["chars"])
        if rid in overrides:
            cap = PER_RULE_OVERRIDE_CEILING
            label = "OK (override)"
            if chars > cap:
                label = f"FAIL (>{cap} ceiling)"
                fails.append(f"{rid} {chars} > override ceiling {cap}")
        else:
            cap = PER_RULE_HARD
            if chars > cap:
                label = "FAIL (needs override ADR)"
                fails.append(f"{rid} {chars} > per-rule hard cap {cap} (no override)")
            elif chars > PER_RULE_TARGET:
                label = "warn (> target)"
            else:
                label = "OK"
        out.append(f"{rid:<28} {chars:>6} {cap:>6} {label:<24}")

    out.append("")
    if fails:
        out.append(f"❌  kernel budget check: {len(fails)} breach(es)")
        for f in fails:
            out.append(f"  - {f}")
        return 1, out
    out.append(f"✅  kernel budget check: pass")
    return 0, out


def trend_append(agg: dict[str, object]) -> tuple[int, str]:
    """Append a daily snapshot to agents/.rule-budget-history.jsonl.

    Idempotent per UTC day: if today's date already has a row, the file
    is not modified. Snapshot fields: date, kernel_chars, auto_chars,
    rule_count, total_chars. Read by `roadmap:progress` for the Kernel
    track per `road-to-kernel-and-router.md` P5.3.
    """
    today = _dt.datetime.now(_dt.timezone.utc).date().isoformat()
    snapshot = {
        "date": today,
        "kernel_chars": int(agg["kernel_chars"]),
        "auto_chars": int(agg["auto_chars"]),
        "rule_count": int(agg["rule_count"]),
        "total_chars": int(agg["total_chars"]),
    }
    TREND_FILE.parent.mkdir(parents=True, exist_ok=True)
    if TREND_FILE.exists():
        for line in TREND_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                row = json.loads(line)
            except json.JSONDecodeError:
                continue
            if row.get("date") == today:
                return 0, f"trend: {today} already recorded — no-op"
    with TREND_FILE.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps(snapshot, sort_keys=True) + "\n")
    return 0, f"trend: appended {today} → {TREND_FILE.relative_to(REPO_ROOT)}"


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--json", action="store_true", help="emit JSON instead of a table")
    parser.add_argument(
        "--kernel-budget-check",
        action="store_true",
        help="enforce Council R2 kernel-bucket + per-rule caps; exit 1 on breach",
    )
    parser.add_argument(
        "--trend-append",
        action="store_true",
        help="append today's snapshot to agents/.rule-budget-history.jsonl (idempotent per UTC day)",
    )
    args = parser.parse_args(argv)

    rules = collect()
    agg = aggregate(rules)

    if args.kernel_budget_check:
        overrides = load_overrides()
        code, report = kernel_budget_check(rules, agg, overrides)
        print("\n".join(report))
        return code

    if args.trend_append:
        code, msg = trend_append(agg)
        print(msg)
        return code

    if args.json:
        payload = {"rules": sorted(rules, key=lambda r: r["id"]), "summary": agg}
        print(json.dumps(payload, indent=2, sort_keys=True))
    else:
        print(render_table(rules, agg))
    return 0


if __name__ == "__main__":
    sys.exit(main())
