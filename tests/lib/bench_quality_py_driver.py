#!/usr/bin/env python3
"""Differential-test driver for the bench_quality TS port (ADR-088).

Reads a JSON spec from stdin, runs `score_corpus`, and prints the result
block as JSON so the vitest twin can assert structural + value parity.

Spec shape (stdin JSON):
  {"prompts": [...], "agent_output_path": "x" | null}
"""
from __future__ import annotations

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "src" / "scripts"))
sys.path.insert(0, str(ROOT / "src"))

from scripts._lib import bench_quality as bq  # noqa: E402


def main() -> int:
    spec = json.loads(sys.stdin.buffer.read().decode("utf-8"))
    prompts = spec["prompts"]
    aop = spec.get("agent_output_path")
    path = pathlib.Path(aop) if aop is not None else None
    block = bq.score_corpus(prompts, path)
    sys.stdout.write(json.dumps(block))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
