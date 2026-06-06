#!/usr/bin/env python3
"""Command → flow coverage lint (road-to-6.1.0 Step 9 — the Flows primary view).

Asserts that ``src/flows/surface-map.yaml`` classifies EVERY command in the
source-of-truth command tree (``src/domains/<pack>/**/command.md``) into exactly
one flow / platform-surface bucket — the lintable command→flow edge that makes
``Profile → Pack → Flow → Command → Skill → Rule`` real rather than prose.

Checks (all hard — exit 1 on any violation):

1. **No orphan** — every real ``src/domains`` command appears in the map.
2. **No phantom** — every ref in the map backs a real ``src/domains`` command.
3. **No duplicate** — no command is classified into two buckets.
4. **Allowed buckets** — every bucket key is in ``user_work_flows`` ∪
   ``platform_surfaces``; the four user-work flows are exactly the closed set
   ``lint_flows.py`` enforces (``agent-admin`` is deliberately NOT a flow).

Companion to ``lint_flows.py`` (which validates the rich
``src/flows/<flow>.yaml`` definitions). This lint validates the COMPLETE flat
classification; the two together close the flow layer.

Exit codes: 0 = clean · 1 = violations · 3 = internal error.

Usage:
    python3 scripts/lint_command_flow_coverage.py
    python3 scripts/lint_command_flow_coverage.py --quiet
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

import yaml  # type: ignore

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib.agent_src import _iter_domains_commands  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
SURFACE_MAP = ROOT / "src" / "flows" / "surface-map.yaml"

# The closed user-work flow set — must match lint_flows.CLOSED_FLOWS and
# flow.schema.json. agent-admin is the platform surface, NOT a flow (feedback-6).
CLOSED_FLOWS = {"discovery", "implementation", "review", "delivery"}


def _domains_command_refs() -> set[str]:
    """Logical refs (``feature/plan``, ``commit/in-chunks``) for every command."""
    return {
        logical[len("commands/") : -len(".md")]
        for _, logical in _iter_domains_commands()
    }


def _load_map() -> dict:
    if not SURFACE_MAP.is_file():
        raise FileNotFoundError(f"missing {SURFACE_MAP.relative_to(ROOT)}")
    return yaml.safe_load(SURFACE_MAP.read_text(encoding="utf-8")) or {}


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--quiet", action="store_true", help="only print on failure")
    args = ap.parse_args()

    try:
        data = _load_map()
        real = _domains_command_refs()
    except Exception as exc:  # noqa: BLE001
        print(f"lint_command_flow_coverage: internal error — {exc}", file=sys.stderr)
        return 3

    user_flows = set(data.get("user_work_flows") or [])
    surfaces = set(data.get("platform_surfaces") or [])
    allowed = user_flows | surfaces
    buckets = data.get("commands") or {}

    violations: list[str] = []

    # Check 4 — declared user-work flows match the closed set.
    if user_flows != CLOSED_FLOWS:
        violations.append(
            f"user_work_flows {sorted(user_flows)} != closed set {sorted(CLOSED_FLOWS)} "
            "(a new user-work flow is an ADR-gated governance decision)"
        )

    # Build the flat ref→bucket index; catch duplicates and bad buckets.
    seen: dict[str, str] = {}
    for bucket, refs in buckets.items():
        if bucket not in allowed:
            violations.append(
                f"bucket '{bucket}' is not in user_work_flows ∪ platform_surfaces"
            )
        for ref in refs or []:
            if ref in seen:
                violations.append(
                    f"command '{ref}' classified twice: '{seen[ref]}' and '{bucket}'"
                )
            else:
                seen[ref] = bucket

    mapped = set(seen)

    # Check 1 — no orphan (real command missing from the map).
    for ref in sorted(real - mapped):
        violations.append(f"orphan: command '{ref}' has no flow/surface in surface-map.yaml")

    # Check 2 — no phantom (map ref with no backing command).
    for ref in sorted(mapped - real):
        violations.append(f"phantom: surface-map ref '{ref}' backs no src/domains command")

    if violations:
        print(
            f"lint_command_flow_coverage: {len(violations)} violation(s) "
            f"({len(real)} commands, {len(mapped)} mapped)",
            file=sys.stderr,
        )
        for v in violations:
            print(f"  ✗ {v}", file=sys.stderr)
        return 1

    if not args.quiet:
        per = {b: len(r or []) for b, r in buckets.items()}
        print(
            f"lint_command_flow_coverage: OK — {len(real)} commands fully classified "
            f"across {len(buckets)} buckets {per}"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
