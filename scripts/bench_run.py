#!/usr/bin/env python3
"""Bench orchestrator — step-4 measurement-and-benchmark Phase 2.

Wraps the selection-accuracy baseline collector (`scripts/bench_runner.py`),
captures token / cost data from `agents/cost-tracking/sessions.jsonl` if
present (per ruflo pattern, external-findings § 2), runs structural
quality assertions per prompt, and emits a versioned JSON + Markdown
report under `bench/reports/` per
`docs/contracts/benchmark-report-schema.md`.

Usage:
    python3 scripts/bench_run.py --corpus dev
    python3 scripts/bench_run.py --corpus dev --top-k 3 --quiet
    python3 scripts/bench_run.py --corpus dev --agent-output outputs.json
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from _lib import script_output  # type: ignore[import-not-found]  # noqa: E402
from _lib.bench_cost import aggregate_sessions  # noqa: E402
from _lib.bench_quality import score_corpus  # noqa: E402
from _lib.bench_report import (  # noqa: E402
    report_paths,
    render_markdown,
    utc_now_filename_stamp,
    utc_now_iso,
    write_json,
    write_markdown,
)
from bench_runner import run_corpus  # noqa: E402

try:
    import yaml
except ImportError:
    script_output.error("error: PyYAML required (pip install pyyaml)")
    sys.exit(2)

BENCH_RUN_VERSION = "0.1.0"
PRICING_PATH = REPO_ROOT / "bench" / "pricing.yaml"
SESSIONS_JSONL = REPO_ROOT / "agents" / "cost-tracking" / "sessions.jsonl"
REPORTS_DIR = REPO_ROOT / "bench" / "reports"
CORPUS_DIR = REPO_ROOT / "tests" / "eval"
BASELINE_COLLECTOR = REPO_ROOT / "scripts" / "bench_runner.py"


def _baseline_sha_or_mtime() -> str:
    try:
        return f"mtime:{int(BASELINE_COLLECTOR.stat().st_mtime)}"
    except OSError:
        return "unavailable"


def _verdict(selection: dict, quality: dict) -> dict[str, str]:
    sel = "pass" if selection["passed"] else "fail"
    if quality["source"] == "not_collected":
        qual = "not_collected"
        overall = "partial"
    else:
        qual = "pass" if quality["quality_score"] >= 0.60 else "fail"
        overall = "pass" if (sel == "pass" and qual == "pass") else "fail"
    return {"selection": sel, "quality": qual, "overall": overall}


def build_report(
    corpus_path: Path,
    top_k: int,
    agent_output: Path | None,
) -> dict:
    selection = run_corpus(corpus_path, top_k)
    corpus_yaml = yaml.safe_load(corpus_path.read_text(encoding="utf-8"))
    prompts = corpus_yaml.get("prompts", [])
    cost = aggregate_sessions(SESSIONS_JSONL, PRICING_PATH)
    quality = score_corpus(prompts, agent_output)
    verdict = _verdict(selection, quality)
    return {
        "schema_version": 1,
        "generated_at": utc_now_iso(),
        "corpus": {
            "id": selection["corpus_id"],
            "path": str(corpus_path.relative_to(REPO_ROOT)),
            "prompt_count": len(prompts),
        },
        "runner": {
            "bench_run_version": BENCH_RUN_VERSION,
            "baseline_collector": str(BASELINE_COLLECTOR.relative_to(REPO_ROOT)),
            "baseline_collector_sha": _baseline_sha_or_mtime(),
        },
        "selection": selection,
        "cost": cost,
        "quality": quality,
        "verdict": verdict,
    }


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--corpus", default="dev", help="corpus id (default: dev)")
    ap.add_argument("--top-k", type=int, default=3)
    ap.add_argument("--agent-output", type=Path, default=None,
                    help="Path to JSON {id: output_text} for quality scoring (Phase 3)")
    ap.add_argument("--quiet", action="store_true",
                    help="Print only the report path + headline")
    ap.add_argument("--stamp", default=None,
                    help="Override timestamp (test hook); defaults to UTC now")
    ap.add_argument("--no-write", action="store_true",
                    help="Compute the report but do not write files (dry run)")
    args = ap.parse_args(argv)

    corpus_path = CORPUS_DIR / f"corpus-{args.corpus}.yaml"
    if not corpus_path.is_file():
        script_output.error(f"error: corpus not found: {corpus_path}")
        return 2

    report = build_report(corpus_path, args.top_k, args.agent_output)
    stamp = args.stamp or utc_now_filename_stamp()
    json_path, md_path = report_paths(REPORTS_DIR, report["corpus"]["id"], stamp)

    if not args.no_write:
        write_json(json_path, report)
        write_markdown(md_path, report)

    verdict = report["verdict"]
    sel = report["selection"]
    qual = report["quality"]
    cost = report["cost"]
    headline = (
        f"bench {report['corpus']['id']} · "
        f"selection {sel['selection_accuracy']:.2%} ({verdict['selection']}) · "
        f"cost ${cost['totals']['total_cost_usd']:.6f} ({cost.get('source', 'n/a')}) · "
        f"quality {qual['quality_score']:.2%} ({verdict['quality']}) · "
        f"overall {verdict['overall']}"
    )

    if args.quiet:
        print(headline)
        if not args.no_write:
            print(f"report: {md_path.relative_to(REPO_ROOT)}")
    else:
        print(render_markdown(report))
        if not args.no_write:
            print(f"\n→ json:     {json_path.relative_to(REPO_ROOT)}")
            print(f"→ markdown: {md_path.relative_to(REPO_ROOT)}")

    # Exit zero on overall pass OR partial (partial = quality_not_collected by design).
    return 0 if verdict["overall"] in ("pass", "partial") else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
