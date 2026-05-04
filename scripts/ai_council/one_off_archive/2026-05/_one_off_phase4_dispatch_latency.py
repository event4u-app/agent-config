#!/usr/bin/env python3
"""Phase 4.3.1 — council cluster dispatch-latency benchmark.

Measures the wall-clock overhead of the cluster dispatch layer for the
`/council` family. Compares:

  baseline: directly read council-pr.md / council-design.md (atomic shape)
  cluster : read council.md (dispatcher) + parse table + read council-pr.md
            / council-design.md (cluster shape)

The dispatch layer in agent-config is a markdown parse, not a runtime
function, so this benchmarks the file-system + frontmatter + table-row
extraction cost. Threshold per roadmap § 4.3.1: ≤ +100ms wall-clock.
"""
from __future__ import annotations

import re
import statistics
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
COMMANDS = ROOT / ".agent-src/commands"
N_ITER = 1000  # cold + warm; markdown is tiny so we run a lot of iterations

FRONTMATTER_RE = re.compile(r"^---\n(.*?)\n---\n", re.DOTALL)
TABLE_ROW_RE = re.compile(r"\|\s*`/council\s+([a-z-]+)`\s*\|\s*`([^`]+)`")


def _read_atomic(target: str) -> str:
    """Baseline: directly read the routed file (atomic shape)."""
    path = COMMANDS / f"council-{target}.md"
    text = path.read_text(encoding="utf-8")
    m = FRONTMATTER_RE.match(text)
    if not m:
        raise RuntimeError(f"no frontmatter in {path}")
    return text


def _read_cluster(target: str) -> str:
    """Cluster: read dispatcher, parse routing table, then read routed file."""
    dispatcher = (COMMANDS / "council.md").read_text(encoding="utf-8")
    routes = dict(TABLE_ROW_RE.findall(dispatcher))
    routed = routes.get(target)
    if routed is None:
        raise RuntimeError(f"no route for {target!r} in dispatcher")
    text = (COMMANDS / routed).read_text(encoding="utf-8")
    m = FRONTMATTER_RE.match(text)
    if not m:
        raise RuntimeError(f"no frontmatter in {routed}")
    return text


def _bench(fn, target: str, n: int) -> list[float]:
    samples: list[float] = []
    for _ in range(n):
        t0 = time.perf_counter()
        fn(target)
        samples.append((time.perf_counter() - t0) * 1000.0)
    return samples


def _summary(name: str, samples: list[float]) -> None:
    samples = sorted(samples)
    p50 = statistics.median(samples)
    p95 = samples[int(len(samples) * 0.95)]
    p99 = samples[int(len(samples) * 0.99)]
    mean = statistics.mean(samples)
    print(f"  {name:18s}  mean={mean:6.3f}ms  p50={p50:6.3f}ms  p95={p95:6.3f}ms  p99={p99:6.3f}ms")


def main() -> int:
    print(f"Phase 4.3.1 — council cluster dispatch latency  (n={N_ITER} per probe)")
    print()

    overruns = 0
    for target in ("pr", "design"):
        print(f"target = /council {target}")

        # warm cache
        _read_atomic(target)
        _read_cluster(target)

        baseline = _bench(_read_atomic, target, N_ITER)
        cluster = _bench(_read_cluster, target, N_ITER)

        _summary("atomic   (baseline)", baseline)
        _summary("cluster  (dispatcher)", cluster)

        delta_mean = statistics.mean(cluster) - statistics.mean(baseline)
        delta_p95 = sorted(cluster)[int(N_ITER * 0.95)] - sorted(baseline)[int(N_ITER * 0.95)]
        verdict = "PASS" if delta_p95 <= 100.0 else "FAIL"
        marker = "✅" if verdict == "PASS" else "❌"
        print(f"  delta-mean = {delta_mean:+.3f}ms  delta-p95 = {delta_p95:+.3f}ms  threshold = +100ms  {marker} {verdict}")
        print()

        if delta_p95 > 100.0:
            overruns += 1

    if overruns:
        print(f"❌  {overruns} probe(s) exceeded +100ms p95 threshold.")
        return 1
    print("✅  All probes within +100ms p95 threshold.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
