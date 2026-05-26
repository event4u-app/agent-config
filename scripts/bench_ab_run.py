#!/usr/bin/env python3
"""Top-level orchestrator for the package-impact A/B bench.

Phase 2 Step 1 of `agents/roadmaps/road-to-package-impact-benchmark.md`.

A thin wrapper around the per-track runners (Track A behavioural eval,
Track B task corpus). Owns:

- the `--variant {with,without}` axis,
- the cache lookup that decides whether the `without` arm runs at all,
- the report-header convention (cache key, variant, corpus, timestamp),
- the report-path convention `internal/bench/reports/ab/{stamp}-{corpus}-{variant}.json`.

Track A's actual runner lands in Phase 3; Track B's in Phase 4. Until then
this script writes stub reports so the cache and diff plumbing can be
exercised end-to-end.
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from _lib import bench_ab_cache  # type: ignore[import-not-found]  # noqa: E402

REPORTS_DIR = REPO_ROOT / "internal" / "bench" / "reports" / "ab"
CORPUS_DIR = REPO_ROOT / "internal" / "bench" / "corpora"
CLONES_DIR = REPO_ROOT / "internal" / "bench" / "ab" / "clones"

# Supported corpora (created in Phases 3 + 4).
KNOWN_CORPORA = ("ab-tracka", "ab-trackb")

REPORT_SCHEMA_VERSION = "ab-bench/0.1"


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")


def corpus_path(corpus: str) -> Path:
    return CORPUS_DIR / f"{corpus}.yaml"


def report_path(stamp: str, corpus: str, variant: str) -> Path:
    return REPORTS_DIR / f"{stamp}-{corpus}-{variant}.json"


def ensure_clone(variant: str) -> Path:
    """Make sure the clone exists; do NOT --refresh — that's a user-driven choice."""
    target = CLONES_DIR / variant
    if not target.exists():
        # Lazy-import so the dependency stays explicit
        import importlib.util

        spec = importlib.util.spec_from_file_location(
            "bench_ab_clone", REPO_ROOT / "scripts" / "bench_ab_clone.py"
        )
        if spec is None or spec.loader is None:
            raise RuntimeError("cannot load bench_ab_clone helper")
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        module.clone(variant, refresh=False)  # type: ignore[attr-defined]
    return target


def run_track_stub(variant: str, corpus: str, clone_root: Path) -> dict[str, object]:
    """Phase-2 placeholder.

    Returns a minimal results block. Phase 3 + Phase 4 plug their real
    runners into this dispatch.
    """
    return {
        "track": corpus,
        "status": "stub",
        "note": (
            "Phase 2 plumbing only. The real runner lands in Phase 3 (Track A) "
            "or Phase 4 (Track B). See road-to-package-impact-benchmark.md."
        ),
        "clone_root": str(clone_root.relative_to(REPO_ROOT)),
        "variant": variant,
    }


def write_report(
    *,
    variant: str,
    corpus: str,
    stamp: str,
    cache_key: bench_ab_cache.CacheKey,
    results: dict[str, object],
    duration_seconds: float,
) -> Path:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    report = {
        "schema": REPORT_SCHEMA_VERSION,
        "stamp": stamp,
        "variant": variant,
        "corpus": corpus,
        "cache_key": cache_key.to_dict(),
        "duration_seconds": round(duration_seconds, 3),
        "results": results,
    }
    json_path = report_path(stamp, corpus, variant)
    json_path.write_text(json.dumps(report, indent=2) + "\n")
    md_path = json_path.with_suffix(".md")
    md_path.write_text(render_markdown(report))
    return json_path


def render_markdown(report: dict[str, object]) -> str:
    lines = [
        f"# A/B Bench Report — {report['variant']} · {report['corpus']}",
        "",
        f"- Stamp: `{report['stamp']}`",
        f"- Duration: {report['duration_seconds']}s",
        "",
        "## Cache key",
        "",
    ]
    for k, v in (report.get("cache_key") or {}).items():  # type: ignore[union-attr]
        lines.append(f"- `{k}`: `{v}`")
    lines.append("")
    lines.append("## Results")
    lines.append("")
    lines.append("```json")
    lines.append(json.dumps(report.get("results"), indent=2))
    lines.append("```")
    lines.append("")
    return "\n".join(lines)


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run one arm of the package-impact A/B bench."
    )
    parser.add_argument(
        "--variant",
        choices=("with", "without"),
        required=True,
        help="Which target clone to run against.",
    )
    parser.add_argument(
        "--corpus",
        choices=KNOWN_CORPORA,
        required=True,
        help="Which corpus to execute.",
    )
    parser.add_argument(
        "--non-interactive",
        action="store_true",
        help="Never prompt; assume defaults on cache decisions.",
    )
    parser.add_argument(
        "--reuse-cache",
        action="store_true",
        help=(
            "If a fresh cached `without` report exists, skip re-running and "
            "exit 0 without writing a new report. Only meaningful for "
            "--variant without."
        ),
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])

    corpus_file = corpus_path(args.corpus)
    if not corpus_file.exists():
        sys.stdout.write(
            f"bench_ab_run: corpus '{args.corpus}' missing at {corpus_file} — "
            "Phase 3 (track A) or Phase 4 (track B) author it. Writing a "
            "placeholder run with the synthetic corpus hash so cache plumbing "
            "remains exercisable.\n"
        )

    cache_key_value = bench_ab_cache.CacheKey(
        corpus_hash=(
            bench_ab_cache.hash_file(corpus_file)
            if corpus_file.exists()
            else "missing-corpus"
        ),
        claude_cli_version=bench_ab_cache.claude_cli_version(),
        target_shape_hash=bench_ab_cache.target_shape_hash(),
    )

    if args.variant == "without" and args.reuse_cache and corpus_file.exists():
        lookup = bench_ab_cache.lookup(corpus_file)
        if lookup.fresh and lookup.report_path is not None:
            sys.stdout.write(
                f"bench_ab_run: reusing fresh cached `without` report at "
                f"{lookup.report_path.relative_to(REPO_ROOT)}\n"
            )
            return 0
        if lookup.found and not lookup.fresh:
            sys.stdout.write(
                f"bench_ab_run: cached `without` report stale ({lookup.reason})\n"
            )
            if args.non_interactive:
                sys.stdout.write(
                    "bench_ab_run: --non-interactive — reusing stale baseline "
                    "and flagging the run.\n"
                )
                return 0
            sys.stdout.write(
                "bench_ab_run: continuing with a fresh run "
                "(set --reuse-cache off and use --non-interactive to keep the stale baseline)\n"
            )

    clone_root = ensure_clone(args.variant)
    started = time.monotonic()
    results = run_track_stub(args.variant, args.corpus, clone_root)
    duration = time.monotonic() - started
    path = write_report(
        variant=args.variant,
        corpus=args.corpus,
        stamp=utc_stamp(),
        cache_key=cache_key_value,
        results=results,
        duration_seconds=duration,
    )
    sys.stdout.write(
        f"bench_ab_run: wrote {path.relative_to(REPO_ROOT)}\n"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
