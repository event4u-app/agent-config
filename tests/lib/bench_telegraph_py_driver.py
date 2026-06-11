#!/usr/bin/env python3
"""Differential-test driver for the telegraph bench TS port (ADR-088).

Reads a JSON spec from stdin describing synthetic per-prompt / per-arm
bench results, builds the Python `PromptResult` objects, and prints the
selected reference artifact to stdout so the vitest twin can assert
byte-identical output against the TypeScript implementation.

Spec shape (stdin JSON):
  {
    "mode": "telegraph_md" | "telegraph_json" | "aggregate" | "carve_out" | "compute_cost",
    "results": [
      {"id": "...", "category": "...", "expected_carve_out_pct": 0.0,
       "arms": {"condensed": {"text": "...", "input_tokens": 0,
                              "output_tokens": 0, "latency_ms": 0,
                              "error": null}, ...}}
    ],
    "meta": {"corpus_path_rel": "...", "generated_at": "...",
             "bench_run_version": "...", "model": "...", "transport": "...",
             "pricing_rates": {"input": 3.0, "output": 15.0},
             "pricing_sourced_on": "..."},
    "texts": ["..."],            # for mode == "carve_out"
    "pricing": {"input": 3.0}    # for mode == "compute_cost"
  }
"""
from __future__ import annotations

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src" / "scripts"))
sys.path.insert(0, str(ROOT / "src"))

from scripts._lib import bench_telegraph as bt  # noqa: E402
from scripts._lib import bench_telegraph_report as btr  # noqa: E402


def _build_results(specs: list[dict]) -> list[bt.PromptResult]:
    results: list[bt.PromptResult] = []
    for spec in specs:
        pr = bt.PromptResult(
            id=str(spec["id"]),
            category=str(spec.get("category", "unknown")),
            expected_carve_out_pct=float(spec.get("expected_carve_out_pct", 0.0)),
        )
        for arm, a in (spec.get("arms") or {}).items():
            text = a.get("text", "")
            pr.arms[arm] = bt.ArmResult(
                arm=arm,
                text=text,
                input_tokens=int(a.get("input_tokens", 0)),
                output_tokens=int(a.get("output_tokens", 0)),
                latency_ms=int(a.get("latency_ms", 0)),
                output_chars=len(text),
                carve_out_chars=bt.carve_out_chars(text),
                error=a.get("error"),
            )
        results.append(pr)
    return results


def main() -> int:
    spec = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    mode = spec["mode"]

    if mode == "carve_out":
        out = [bt.carve_out_chars(t) for t in spec["texts"]]
        sys.stdout.write(json.dumps(out))
        return 0

    results = _build_results(spec.get("results", []))

    if mode == "aggregate":
        sys.stdout.write(json.dumps(bt.aggregate_results(results)))
        return 0

    if mode == "compute_cost":
        sys.stdout.write(json.dumps(bt.compute_cost(results, spec["pricing"])))
        return 0

    meta = spec["meta"]
    report = btr.build_telegraph_report(
        results=results,
        corpus_path_rel=meta["corpus_path_rel"],
        generated_at=meta["generated_at"],
        bench_run_version=meta["bench_run_version"],
        model=meta["model"],
        transport=meta["transport"],
        pricing_rates=meta["pricing_rates"],
        pricing_sourced_on=meta.get("pricing_sourced_on"),
    )

    if mode == "telegraph_md":
        sys.stdout.buffer.write(btr.render_telegraph_markdown(report).encode("utf-8"))
        return 0

    if mode == "telegraph_json":
        # Mirror bench-report JSON emission: indent=2 + trailing newline.
        sys.stdout.buffer.write((json.dumps(report, indent=2) + "\n").encode("utf-8"))
        return 0

    raise SystemExit(f"unknown mode: {mode}")


if __name__ == "__main__":
    raise SystemExit(main())
