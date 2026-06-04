#!/usr/bin/env python3
"""Cache-aware dispatch for `task bench:ab` arms.

Phase 5 supporting helper. Wraps the Phase 2 cache lookup so the Taskfile
entries can stay readable. Given a corpus name (`tracka` / `trackb`),
checks whether the cached `without` report is fresh; if so, runs only the
`with` arm of the corresponding runner. Otherwise runs both.

Cost-saving math: a daily `task bench:ab` re-runs only the `with` arm
when the corpus, claude CLI version, and target shape haven't changed.
That halves the wall-time + cost of the daily run.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))

from _lib import bench_ab_cache  # type: ignore[import-not-found]  # noqa: E402

RUNNER_FOR = {
    "tracka": (REPO_ROOT / "src" / "scripts" / "bench_ab_tracka_run.py", "ab-tracka.yaml"),
    "trackb": (REPO_ROOT / "src" / "scripts" / "bench_ab_task_runner.py", "ab-trackb.yaml"),
}


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Cache-aware dispatch.")
    parser.add_argument("corpus", choices=tuple(RUNNER_FOR))
    parser.add_argument(
        "extra",
        nargs=argparse.REMAINDER,
        help="Extra args forwarded to the underlying runner.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])
    runner, corpus_name = RUNNER_FOR[args.corpus]
    corpus_path = REPO_ROOT / "internal" / "bench" / "corpora" / corpus_name
    if not corpus_path.exists():
        sys.stderr.write(f"bench_ab_cache_dispatch: corpus missing at {corpus_path}\n")
        return 1
    lookup = bench_ab_cache.lookup(corpus_path)
    if lookup.fresh and lookup.report_path is not None:
        sys.stdout.write(
            f"bench_ab_cache_dispatch ({args.corpus}): reusing fresh without baseline "
            f"({lookup.report_path.name}) — running with-arm only\n"
        )
        variants = ("with",)
    else:
        sys.stdout.write(
            f"bench_ab_cache_dispatch ({args.corpus}): cache {lookup.reason} — running both arms\n"
        )
        variants = ("with", "without")
    cmd = [sys.executable, str(runner), "--variant", variants[0]] + list(args.extra)
    if len(variants) == 2:
        cmd = [sys.executable, str(runner), "--variant", "both"] + list(args.extra)
    return subprocess.run(cmd, check=False).returncode


if __name__ == "__main__":
    raise SystemExit(main())
