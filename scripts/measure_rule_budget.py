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
import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RULES_DIR = REPO_ROOT / ".agent-src.uncompressed" / "rules"

KERNEL_HARD = 25_000
KERNEL_TARGET = 20_000
PER_RULE_HARD = 1_500
PER_RULE_TARGET = 1_200


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


def aggregate(rules: list[dict[str, object]]) -> dict[str, object]:
    always = [r for r in rules if r["type"] == "always"]
    auto = [r for r in rules if r["type"] == "auto"]
    total_chars = sum(int(r["chars"]) for r in rules)
    return {
        "always_count": len(always),
        "auto_count": len(auto),
        "rule_count": len(rules),
        "always_chars": sum(int(r["chars"]) for r in always),
        "auto_chars": sum(int(r["chars"]) for r in auto),
        "total_chars": total_chars,
        "kernel_hard": KERNEL_HARD,
        "kernel_target": KERNEL_TARGET,
        "per_rule_hard": PER_RULE_HARD,
        "per_rule_target": PER_RULE_TARGET,
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
        f"always-bucket: {agg['always_chars']:>6} chars across {agg['always_count']} rules "
        f"(target ≤ {KERNEL_TARGET}, hard ≤ {KERNEL_HARD})"
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


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--json", action="store_true", help="emit JSON instead of a table")
    args = parser.parse_args(argv)

    rules = collect()
    agg = aggregate(rules)

    if args.json:
        payload = {"rules": sorted(rules, key=lambda r: r["id"]), "summary": agg}
        print(json.dumps(payload, indent=2, sort_keys=True))
    else:
        print(render_table(rules, agg))
    return 0


if __name__ == "__main__":
    sys.exit(main())
