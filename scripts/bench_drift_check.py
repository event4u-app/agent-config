#!/usr/bin/env python3
"""Drift detector for the bench corpus — step-4 Phase 3 Step 2.

Compares the latest `bench/reports/<stamp>-<corpus>.json` against the
previous N reports (default 5) for the same corpus. Drift defined as:

    - selection-accuracy: latest is more than `accuracy_drop_pp` below
      the rolling mean (default 5 pp)
    - cost: latest USD total is more than `cost_increase_pct` above the
      rolling mean (default 20 %); skipped when source != "captured"
    - quality: latest quality_score is more than `quality_drop_pp`
      below the rolling mean (default 10 pp); skipped when source ==
      "not_collected"

Exit codes:
    0 — no drift detected (or no baseline yet — warn-only)
    1 — argument / read error
    2 — drift detected (CI surface; not a merge gate per roadmap)

CLI:
    python3 scripts/bench_drift_check.py --corpus dev
    python3 scripts/bench_drift_check.py --corpus dev --window 5 --json
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from _lib import script_output  # type: ignore[import-not-found]  # noqa: E402


def _load_reports(reports_dir: Path, corpus: str) -> list[tuple[Path, dict[str, Any]]]:
    out: list[tuple[Path, dict[str, Any]]] = []
    for p in sorted(reports_dir.glob(f"*-{corpus}.json")):
        try:
            out.append((p, json.loads(p.read_text(encoding="utf-8"))))
        except (OSError, json.JSONDecodeError) as exc:
            script_output.warn(f"  ⚠️  skip unreadable report {p.name}: {exc}")
    return out


def _mean(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _check(latest: dict[str, Any], baseline: list[dict[str, Any]],
           thresholds: dict[str, float]) -> list[dict[str, Any]]:
    findings: list[dict[str, Any]] = []

    sel_latest = float(latest["selection"]["selection_accuracy"])
    sel_baseline = _mean([float(r["selection"]["selection_accuracy"]) for r in baseline])
    sel_drop_pp = (sel_baseline - sel_latest) * 100.0
    if sel_drop_pp > thresholds["accuracy_drop_pp"]:
        findings.append({
            "axis": "selection_accuracy",
            "latest": sel_latest, "baseline_mean": sel_baseline,
            "delta_pp": -sel_drop_pp, "threshold_pp": -thresholds["accuracy_drop_pp"],
        })

    captured = [r for r in baseline + [latest] if r["cost"].get("source") == "captured"]
    if len(captured) >= 2 and latest["cost"].get("source") == "captured":
        cost_latest = float(latest["cost"]["totals"]["cost_usd"])
        baseline_costs = [float(r["cost"]["totals"]["cost_usd"])
                          for r in baseline if r["cost"].get("source") == "captured"]
        if baseline_costs:
            cost_baseline = _mean(baseline_costs)
            if cost_baseline > 0:
                pct = (cost_latest - cost_baseline) / cost_baseline * 100.0
                if pct > thresholds["cost_increase_pct"]:
                    findings.append({
                        "axis": "cost_usd",
                        "latest": cost_latest, "baseline_mean": cost_baseline,
                        "delta_pct": pct, "threshold_pct": thresholds["cost_increase_pct"],
                    })

    if latest["quality"].get("source") != "not_collected":
        q_latest = float(latest["quality"]["quality_score"])
        q_baseline = _mean([float(r["quality"]["quality_score"])
                            for r in baseline
                            if r["quality"].get("source") != "not_collected"])
        if q_baseline:
            q_drop_pp = (q_baseline - q_latest) * 100.0
            if q_drop_pp > thresholds["quality_drop_pp"]:
                findings.append({
                    "axis": "quality_score",
                    "latest": q_latest, "baseline_mean": q_baseline,
                    "delta_pp": -q_drop_pp, "threshold_pp": -thresholds["quality_drop_pp"],
                })

    return findings


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--corpus", default="dev")
    ap.add_argument("--reports-dir", default="bench/reports")
    ap.add_argument("--window", type=int, default=5, help="rolling window size (default 5)")
    ap.add_argument("--accuracy-drop-pp", type=float, default=5.0)
    ap.add_argument("--cost-increase-pct", type=float, default=20.0)
    ap.add_argument("--quality-drop-pp", type=float, default=10.0)
    ap.add_argument("--json", action="store_true", help="emit JSON instead of Markdown")
    args = ap.parse_args(argv)

    reports = _load_reports(REPO_ROOT / args.reports_dir, args.corpus)
    if len(reports) < 2:
        msg = (f"  ℹ️  bench-drift · corpus={args.corpus} · "
               f"{len(reports)} report(s) — need ≥ 2 to compare; no drift gate yet.")
        if args.json:
            print(json.dumps({"status": "warmup", "reports": len(reports)}))
        else:
            print(msg)
        return 0

    latest_path, latest = reports[-1]
    baseline = [r for _, r in reports[-(args.window + 1):-1]]
    thresholds = {
        "accuracy_drop_pp": args.accuracy_drop_pp,
        "cost_increase_pct": args.cost_increase_pct,
        "quality_drop_pp": args.quality_drop_pp,
    }
    findings = _check(latest, baseline, thresholds)

    payload = {
        "status": "drift" if findings else "ok",
        "corpus": args.corpus,
        "latest_report": latest_path.name,
        "baseline_window": len(baseline),
        "thresholds": thresholds,
        "findings": findings,
    }
    if args.json:
        print(json.dumps(payload, indent=2))
    else:
        emoji = "⚠️" if findings else "✅"
        print(f"  {emoji}  bench-drift · corpus={args.corpus} · "
              f"latest={latest_path.name} · window={len(baseline)} · "
              f"findings={len(findings)}")
        for f in findings:
            print(f"     · {f['axis']}: latest={f['latest']:.4f} "
                  f"baseline_mean={f['baseline_mean']:.4f}")
    return 2 if findings else 0


if __name__ == "__main__":
    sys.exit(main())
