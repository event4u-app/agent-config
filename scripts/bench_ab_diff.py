#!/usr/bin/env python3
"""Diff two A/B reports (one per variant) into a comparison artefact.

Phase 2 Step 4 of `agents/roadmaps/road-to-package-impact-benchmark.md`.

Inputs: two report JSON paths. Output: a JSON artefact under
`internal/bench/reports/ab/diff/{stamp}-{corpus}-diff.json` plus a matching
`.md`. Phase 5's renderer consumes this artefact to populate `docs/benchmark.md`.

The diff content depends on the corpus:

- `ab-tracka` — trigger-accuracy %, false-positive count, per-rule lift.
- `ab-trackb` — completion-rate per category, wall-time, tokens, cost,
  ask-vs-act ratio, tool-call count.

Phase 2 only writes the structural skeleton (delta object with `with`,
`without`, `delta` keys); Phases 3 and 4 plug their real metrics into
the `results` blocks the runners emit, and the diff is computed in
`compute_track_a_diff` / `compute_track_b_diff` here.
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
REPORTS_DIR = REPO_ROOT / "internal" / "bench" / "reports" / "ab"
DIFF_DIR = REPORTS_DIR / "diff"


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")


def load_report(path: Path) -> dict:
    return json.loads(path.read_text())


def compute_track_a_diff(with_results: dict, without_results: dict) -> dict:
    """Track A: trigger accuracy + per-rule lift.

    Phase 3 populates `triggers`, `per_rule_accuracy`, `false_positives` in the
    `results` block. This helper computes the delta. While Phase 3 is not yet
    landed, we surface what we have and zero what we don't — never invent
    numbers.
    """
    def take(d: dict, key: str, default: float = 0.0) -> float:
        value = d.get(key, default)
        try:
            return float(value)
        except (TypeError, ValueError):
            return default

    with_acc = take(with_results, "trigger_accuracy")
    without_acc = take(without_results, "trigger_accuracy")
    return {
        "trigger_accuracy": {
            "with": with_acc,
            "without": without_acc,
            "delta_pct_points": round(with_acc - without_acc, 3),
        },
        "false_positives": {
            "with": with_results.get("false_positives", 0),
            "without": without_results.get("false_positives", 0),
        },
        "per_rule": {
            "with": with_results.get("per_rule_accuracy", {}),
            "without": without_results.get("per_rule_accuracy", {}),
        },
    }


def compute_track_b_diff(with_results: dict, without_results: dict) -> dict:
    """Track B: completion rate per category + wall-time + tokens + cost + ask-vs-act."""
    def mean(d: dict, key: str) -> float:
        try:
            return float(d.get(key, 0.0))
        except (TypeError, ValueError):
            return 0.0

    with_cats = with_results.get("per_category", {})
    without_cats = without_results.get("per_category", {})
    categories = sorted(set(with_cats) | set(without_cats))
    per_category = {}
    for cat in categories:
        per_category[cat] = {
            "with": with_cats.get(cat, {}),
            "without": without_cats.get(cat, {}),
        }

    return {
        "per_category": per_category,
        "wall_time_seconds": {
            "with": mean(with_results, "mean_wall_time"),
            "without": mean(without_results, "mean_wall_time"),
            "delta": round(
                mean(with_results, "mean_wall_time")
                - mean(without_results, "mean_wall_time"),
                3,
            ),
        },
        "tokens": {
            "with": mean(with_results, "mean_tokens"),
            "without": mean(without_results, "mean_tokens"),
            "delta": round(
                mean(with_results, "mean_tokens")
                - mean(without_results, "mean_tokens"),
                3,
            ),
        },
        "cost_usd": {
            "with": mean(with_results, "mean_cost_usd"),
            "without": mean(without_results, "mean_cost_usd"),
            "delta": round(
                mean(with_results, "mean_cost_usd")
                - mean(without_results, "mean_cost_usd"),
                4,
            ),
        },
        "ask_vs_act_ratio": {
            "with": mean(with_results, "ask_vs_act_ratio"),
            "without": mean(without_results, "ask_vs_act_ratio"),
        },
        "tool_calls_per_task": {
            "with": mean(with_results, "mean_tool_calls"),
            "without": mean(without_results, "mean_tool_calls"),
        },
    }


def render_markdown(diff: dict) -> str:
    lines = [
        f"# A/B Bench Diff — {diff['corpus']}",
        "",
        f"- Stamp: `{diff['stamp']}`",
        f"- With:    `{diff['with_report']}`",
        f"- Without: `{diff['without_report']}`",
        "",
        "## Delta",
        "",
        "```json",
        json.dumps(diff.get("delta", {}), indent=2),
        "```",
        "",
    ]
    return "\n".join(lines)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Diff two A/B bench reports (one per variant)."
    )
    parser.add_argument("with_report", type=Path, help="Report JSON for variant=with")
    parser.add_argument("without_report", type=Path, help="Report JSON for variant=without")
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=DIFF_DIR,
        help="Where to write the diff artefact (default: internal/bench/reports/ab/diff/)",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])
    if not args.with_report.exists():
        sys.stderr.write(f"bench_ab_diff: missing {args.with_report}\n")
        return 1
    if not args.without_report.exists():
        sys.stderr.write(f"bench_ab_diff: missing {args.without_report}\n")
        return 1
    with_rep = load_report(args.with_report)
    without_rep = load_report(args.without_report)
    if with_rep.get("variant") != "with":
        sys.stderr.write(
            f"bench_ab_diff: {args.with_report} variant is "
            f"{with_rep.get('variant')!r}, expected 'with'\n"
        )
        return 1
    if without_rep.get("variant") != "without":
        sys.stderr.write(
            f"bench_ab_diff: {args.without_report} variant is "
            f"{without_rep.get('variant')!r}, expected 'without'\n"
        )
        return 1
    if with_rep.get("corpus") != without_rep.get("corpus"):
        sys.stderr.write(
            f"bench_ab_diff: corpus mismatch — with={with_rep.get('corpus')} "
            f"without={without_rep.get('corpus')}\n"
        )
        return 1
    corpus = with_rep.get("corpus") or "unknown"
    with_results = with_rep.get("results", {})
    without_results = without_rep.get("results", {})
    if corpus == "ab-tracka":
        delta = compute_track_a_diff(with_results, without_results)
    elif corpus == "ab-trackb":
        delta = compute_track_b_diff(with_results, without_results)
    else:
        delta = {
            "note": f"no diff strategy registered for corpus {corpus!r}",
            "with_results": with_results,
            "without_results": without_results,
        }
    stamp = utc_stamp()
    diff = {
        "schema": "ab-bench-diff/0.1",
        "stamp": stamp,
        "corpus": corpus,
        "with_report": str(args.with_report.resolve().relative_to(REPO_ROOT)),
        "without_report": str(args.without_report.resolve().relative_to(REPO_ROOT)),
        "delta": delta,
    }
    args.out_dir.mkdir(parents=True, exist_ok=True)
    json_path = args.out_dir / f"{stamp}-{corpus}-diff.json"
    md_path = json_path.with_suffix(".md")
    json_path.write_text(json.dumps(diff, indent=2) + "\n")
    md_path.write_text(render_markdown(diff))
    sys.stdout.write(f"bench_ab_diff: wrote {json_path.relative_to(REPO_ROOT)}\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
