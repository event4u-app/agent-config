#!/usr/bin/env python3
"""One-shot memory observability report.

Shows:
  - Backend status (via `memory_status.status()`)
  - Intake counts per entry type and per month
  - Curated file staleness (files with `last_validated` older than
    `review_after_days` for any entry)
  - Supersede-chain totals

Exit code: 0 = report printed (green or otherwise); 2 = PyYAML missing.
`task memory:status` is the expected entry point, but the script is
usable standalone.

Usage:
    python3 scripts/memory_report.py
    python3 scripts/memory_report.py --format json
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
import memory_status  # noqa: E402

MEMORY_ROOT = Path("agents/memory")
INTAKE_ROOT = MEMORY_ROOT / "intake"
CURATED_TYPES = (
    "ownership", "historical-patterns", "domain-invariants",
    "architecture-decisions", "incident-learnings", "product-rules",
)


def _load_yaml(path: Path) -> dict:
    try:
        import yaml
    except ImportError:
        print("error: PyYAML not installed. `pip install pyyaml`.",
              file=sys.stderr)
        sys.exit(2)
    with path.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def _iter_curated_entries() -> list[tuple[Path, str, dict]]:
    """Yield (file, type, entry) across both curated layouts."""
    out: list[tuple[Path, str, dict]] = []
    for mtype in CURATED_TYPES:
        single = MEMORY_ROOT / f"{mtype}.yml"
        if single.is_file():
            data = _load_yaml(single)
            for e in data.get("entries") or []:
                if isinstance(e, dict):
                    out.append((single, mtype, e))
        type_dir = MEMORY_ROOT / mtype
        if type_dir.is_dir():
            for yml in sorted(type_dir.rglob("*.yml")):
                data = _load_yaml(yml) or {}
                entries = data.get("entries")
                if isinstance(entries, list):
                    for e in entries:
                        if isinstance(e, dict):
                            out.append((yml, mtype, e))
                elif isinstance(data, dict) and data.get("id"):
                    out.append((yml, mtype, data))
    return out


def _intake_stats() -> dict:
    total = 0
    by_type: Counter = Counter()
    by_month: Counter = Counter()
    superseded = 0
    if INTAKE_ROOT.is_dir():
        for jsonl in sorted(INTAKE_ROOT.glob("*.jsonl")):
            month = jsonl.stem.replace("signals-", "")
            with jsonl.open(encoding="utf-8") as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                    except ValueError:
                        continue
                    if obj.get("type") == "supersede":
                        superseded += 1
                        continue
                    total += 1
                    t = obj.get("entry_type")
                    if isinstance(t, str):
                        by_type[t] += 1
                    by_month[month] += 1
    return {
        "total_active": total,
        "superseded": superseded,
        "by_type": dict(by_type),
        "by_month": dict(by_month),
    }


def _staleness_report() -> list[dict]:
    today = dt.date.today()
    stale: list[dict] = []
    for path, mtype, entry in _iter_curated_entries():
        lv = entry.get("last_validated")
        review_after = entry.get("review_after_days")
        if not isinstance(lv, (str, dt.date)) \
                or not isinstance(review_after, int):
            continue
        try:
            last = lv if isinstance(lv, dt.date) \
                else dt.date.fromisoformat(str(lv))
        except ValueError:
            continue
        due = last + dt.timedelta(days=review_after)
        if due < today:
            stale.append({
                "file": str(path),
                "type": mtype,
                "id": entry.get("id", "?"),
                "overdue_days": (today - due).days,
            })
    stale.sort(key=lambda r: r["overdue_days"], reverse=True)
    return stale


def build_report() -> dict:
    status = memory_status.status()
    return {
        "backend": {
            "status": status.status,
            "backend": status.backend,
            "reason": status.reason,
            "cli_path": status.cli_path,
        },
        "intake": _intake_stats(),
        "staleness": _staleness_report(),
    }


def _print_text(report: dict) -> None:
    b = report["backend"]
    print(f"Backend:   {b['status']} (backend={b['backend']})")
    if b["reason"]:
        print(f"           reason: {b['reason']}")
    intake = report["intake"]
    print(f"Intake:    {intake['total_active']} active, "
          f"{intake['superseded']} superseded")
    for t, n in sorted(intake["by_type"].items()):
        print(f"  - {t}: {n}")
    stale = report["staleness"]
    if not stale:
        print("Staleness: no curated entries past review_after_days")
    else:
        print(f"Staleness: {len(stale)} entrie(s) overdue")
        for row in stale[:5]:
            print(f"  - {row['id']} ({row['type']})  "
                  f"+{row['overdue_days']}d  {row['file']}")
        if len(stale) > 5:
            print(f"  (+{len(stale) - 5} more)")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--format", choices=["text", "json"], default="text")
    args = ap.parse_args()
    report = build_report()
    if args.format == "json":
        print(json.dumps(report, indent=2, default=str))
    else:
        _print_text(report)
    return 0


if __name__ == "__main__":
    sys.exit(main())
