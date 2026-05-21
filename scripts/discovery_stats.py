#!/usr/bin/env python3
"""Pretty-print the ``stats`` block from the committed discovery manifest.

Cheap sanity surface for developers: counts by category, lifecycle, and
trust level — answers "how many skills are professional vs core?" in
one terminal line. Reads only the committed manifest; no scan, no
generation. See ADR-015.

CLI:
  python scripts/discovery_stats.py [--manifest PATH]

Exit codes:
  0  printed
  1  manifest missing or malformed
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_MANIFEST = ROOT / "dist" / "discovery" / "discovery-manifest.json"


def _fmt_row(label: str, counts: dict[str, int]) -> str:
    parts = [f"{k}={v}" for k, v in counts.items()]
    return f"  {label:<14} " + "  ".join(parts)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    args = parser.parse_args(argv)

    if not args.manifest.exists():
        print(
            f"error: manifest not found at {args.manifest} "
            "— run `task build-discovery` first.",
            file=sys.stderr,
        )
        return 1

    try:
        manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print(f"error: invalid JSON: {exc}", file=sys.stderr)
        return 1

    stats = manifest.get("stats")
    if not isinstance(stats, dict):
        print("error: manifest has no `stats` block (regenerate)", file=sys.stderr)
        return 1

    rel = args.manifest.relative_to(ROOT) if args.manifest.is_absolute() else args.manifest
    print(f"Discovery stats — {rel}")
    print(f"  total          {stats.get('total_artefacts', 0)}")
    print(_fmt_row("by category", stats.get("by_category", {})))
    print(_fmt_row("by lifecycle", stats.get("by_lifecycle", {})))
    print(_fmt_row("by trust", stats.get("by_trust_level", {})))
    if stats.get("unassigned_count"):
        print(f"  unassigned     {stats['unassigned_count']}")
    if stats.get("documented_unassigned_count"):
        print(f"  documented     {stats['documented_unassigned_count']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
