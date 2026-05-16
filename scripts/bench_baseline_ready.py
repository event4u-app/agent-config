#!/usr/bin/env python3
"""Baseline-closure check — step-4 Phase 3 Step 4.

Returns exit 0 iff the 60-day clock has elapsed since
`bench/baseline-start.txt` AND `bench/reports/` contains at least
`--min-reports` complete runs for the named corpus (default 30).

Read by P2 enforcement roadmaps as their precondition (G1 gate in
step-99). This is the single arbiter of "are we allowed to flip
defaults yet" — no other timer is authoritative.

Exit codes:
    0 — baseline ready (clock elapsed AND report count met)
    1 — argument / file error
    2 — baseline not ready (clock OR reports insufficient)

CLI:
    python3 scripts/bench_baseline_ready.py
    python3 scripts/bench_baseline_ready.py --corpus dev --min-days 60 --min-reports 30
    python3 scripts/bench_baseline_ready.py --json
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date, datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent


def _read_baseline_start(path: Path) -> date | None:
    if not path.exists():
        return None
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        try:
            return datetime.strptime(stripped, "%Y-%m-%d").date()
        except ValueError:
            continue
    return None


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("--corpus", default="dev")
    ap.add_argument("--reports-dir", default="bench/reports")
    ap.add_argument("--baseline-file", default="bench/baseline-start.txt")
    ap.add_argument("--min-days", type=int, default=60)
    ap.add_argument("--min-reports", type=int, default=30)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)

    baseline_path = REPO_ROOT / args.baseline_file
    start = _read_baseline_start(baseline_path)
    if start is None:
        msg = f"baseline-start file missing or unreadable: {baseline_path}"
        if args.json:
            print(json.dumps({"status": "error", "reason": msg}))
        else:
            print(f"  ❌  {msg}", file=sys.stderr)
        return 1

    today = datetime.now(timezone.utc).date()
    days_elapsed = (today - start).days
    days_ok = days_elapsed >= args.min_days

    reports_dir = REPO_ROOT / args.reports_dir
    report_count = (
        len(list(reports_dir.glob(f"*-{args.corpus}.json")))
        if reports_dir.exists() else 0
    )
    reports_ok = report_count >= args.min_reports

    ready = days_ok and reports_ok
    payload = {
        "status": "ready" if ready else "warmup",
        "corpus": args.corpus,
        "baseline_start": start.isoformat(),
        "today": today.isoformat(),
        "days_elapsed": days_elapsed,
        "min_days": args.min_days,
        "days_ok": days_ok,
        "report_count": report_count,
        "min_reports": args.min_reports,
        "reports_ok": reports_ok,
    }
    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        emoji = "✅" if ready else "⏳"
        verdict = "READY" if ready else "WARMUP"
        print(
            f"  {emoji}  bench-baseline · corpus={args.corpus} · "
            f"{verdict} · days={days_elapsed}/{args.min_days} · "
            f"reports={report_count}/{args.min_reports}"
        )
    return 0 if ready else 2


if __name__ == "__main__":
    sys.exit(main())
