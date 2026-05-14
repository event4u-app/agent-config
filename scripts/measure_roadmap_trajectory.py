#!/usr/bin/env python3
"""Phase 5.1 — Roadmap commitment-history measurement.

Walks `agents/roadmaps/archive/` and computes per-roadmap checkbox
completion ratio at archival time. Output: one-line trajectory metric
per roadmap, plus an aggregate `agents/reports/roadmap-trajectory.json`.

Checkbox grammar (mirrors `scripts/roadmap_progress_check.py`):
- `[ ]` — open
- `[x]` — done
- `[~]` — in-progress
- `[-]` — cancelled / dropped (counts neither toward open nor closed)

Trajectory metric = closed / (open + closed + in-progress); cancelled
items are excluded from the denominator so a cleanly archived "we
decided not to do this" doesn't dilute the score.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ARCHIVE = ROOT / "agents" / "roadmaps" / "archive"
REPORT = ROOT / "agents" / "reports" / "roadmap-trajectory.json"

CHECKBOX = re.compile(r"^\s*[-*]\s*\[(?P<state>[ x~\-])\]", re.MULTILINE)


def measure(path: Path) -> dict:
    text = path.read_text(encoding="utf-8", errors="replace")
    counts = {"open": 0, "done": 0, "wip": 0, "cancelled": 0}
    for m in CHECKBOX.finditer(text):
        state = m.group("state")
        if state == " ":
            counts["open"] += 1
        elif state == "x":
            counts["done"] += 1
        elif state == "~":
            counts["wip"] += 1
        elif state == "-":
            counts["cancelled"] += 1
    denom = counts["open"] + counts["done"] + counts["wip"]
    ratio = (counts["done"] / denom) if denom else None
    return {
        "file": str(path.relative_to(ROOT)),
        "counts": counts,
        "completion_ratio": ratio,
        "total_actionable": denom,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--archive", default=str(ARCHIVE))
    ap.add_argument("--report", default=str(REPORT))
    ap.add_argument("--print-table", action="store_true")
    args = ap.parse_args()

    archive = Path(args.archive)
    if not archive.exists():
        print(f"❌  archive not found: {archive}", file=sys.stderr)
        return 2

    rows = [measure(p) for p in sorted(archive.glob("*.md"))]

    # Aggregate: mean, median, count above 80%, count zero-completion
    ratios = [r["completion_ratio"] for r in rows if r["completion_ratio"] is not None]
    aggregate = {
        "roadmaps": len(rows),
        "scored": len(ratios),
        "mean": (sum(ratios) / len(ratios)) if ratios else None,
        "median": sorted(ratios)[len(ratios) // 2] if ratios else None,
        "above_80pct": sum(1 for r in ratios if r >= 0.80),
        "below_50pct": sum(1 for r in ratios if r < 0.50),
        "zero_completion": sum(1 for r in ratios if r == 0.0),
    }

    out = Path(args.report)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(
        json.dumps({"aggregate": aggregate, "rows": rows}, indent=2) + "\n",
        encoding="utf-8",
    )

    print(f"✅  Wrote {out.relative_to(ROOT)}")
    print(f"   roadmaps={aggregate['roadmaps']} scored={aggregate['scored']}")
    if aggregate["mean"] is not None:
        print(
            f"   mean={aggregate['mean']:.1%}  median={aggregate['median']:.1%}  "
            f"above_80%={aggregate['above_80pct']}  below_50%={aggregate['below_50pct']}  "
            f"zero={aggregate['zero_completion']}"
        )
    if args.print_table:
        print()
        print(f"   {'file':70s} {'ratio':>7s} {'done':>5s} {'open':>5s} {'wip':>5s} {'cx':>5s}")
        for r in sorted(rows, key=lambda x: (x["completion_ratio"] is None, -(x["completion_ratio"] or 0))):
            ratio = "—" if r["completion_ratio"] is None else f"{r['completion_ratio']:.1%}"
            print(
                f"   {Path(r['file']).name:70s} {ratio:>7s} "
                f"{r['counts']['done']:>5d} {r['counts']['open']:>5d} "
                f"{r['counts']['wip']:>5d} {r['counts']['cancelled']:>5d}"
            )
    return 0


if __name__ == "__main__":
    sys.exit(main())
