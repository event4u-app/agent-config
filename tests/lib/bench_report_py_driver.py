#!/usr/bin/env python3
"""Differential-test driver for the bench_report TS port (ADR-088).

Reads a JSON spec from stdin and prints the selected reference artifact
to stdout so the vitest twin can assert byte-identical output against the
TypeScript implementation.

Spec shape (stdin JSON):
  {"mode": "render_markdown", "report": {...}}        # full report dict
  {"mode": "json", "report": {...}}                   # write_json body
  {"mode": "report_paths", "reports_dir": "x", "corpus_id": "y", "stamp": "z"}
"""
from __future__ import annotations

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src" / "scripts"))
sys.path.insert(0, str(ROOT / "src"))

from scripts._lib import bench_report as br  # noqa: E402


def main() -> int:
    spec = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    mode = spec["mode"]

    if mode == "render_markdown":
        sys.stdout.buffer.write(br.render_markdown(spec["report"]).encode("utf-8"))
        return 0

    if mode == "json":
        # Mirror write_json body: json.dumps(indent=2) + trailing newline.
        sys.stdout.buffer.write((json.dumps(spec["report"], indent=2) + "\n").encode("utf-8"))
        return 0

    if mode == "report_paths":
        j, m = br.report_paths(
            pathlib.Path(spec["reports_dir"]), spec["corpus_id"], spec["stamp"]
        )
        sys.stdout.write(json.dumps([str(j), str(m)]))
        return 0

    raise SystemExit(f"unknown mode: {mode}")


if __name__ == "__main__":
    raise SystemExit(main())
