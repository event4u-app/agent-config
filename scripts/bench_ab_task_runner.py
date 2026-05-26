#!/usr/bin/env python3
"""Track B — task runner for the package-impact A/B bench.

Phase 4 Step 2 of `agents/roadmaps/road-to-package-impact-benchmark.md`.

For each task in `internal/bench/corpora/ab-trackb.yaml`, in each variant:

1. Snapshot the variant clone's file tree.
2. Invoke the `claude` CLI with the task prompt — OR dry-run, depending
   on `--mode`.
3. Capture the transcript, tool-call events, wall-time, and (if available)
   token + cost counts.
4. Snapshot the post-run tree.
5. Score the task via scripts/_lib/bench_ab_scoring.py.

Modes:

- `dry-run` (default) — record the would-run shell command, write a stub
  transcript naming the variant, score against the unchanged tree. The
  result is structural-zero for every check that requires a file write,
  but the scoring + reporting pipeline runs end-to-end. This is what the
  bench produces in CI by default — fast, free, repeatable.
- `live` — actually invoke the `claude` CLI with `--print` (one-shot
  mode) and the task prompt. Reads `CLAUDE_CLI` from env if set, falls
  back to `claude` on PATH. Captures stdout as the transcript. Honors
  `--samples N` for repeated runs.

The runner ALWAYS resets the clone to a clean state before each task and
ALWAYS records the mode in the report header so a reader can never mistake
a dry-run report for a real measurement.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import shutil
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from _lib import bench_ab_cache  # type: ignore[import-not-found]  # noqa: E402
from _lib import bench_ab_scoring  # type: ignore[import-not-found]  # noqa: E402

try:
    import yaml
except ImportError:
    sys.stderr.write("bench_ab_task_runner: PyYAML required (pip install pyyaml)\n")
    raise SystemExit(2)

CORPUS_PATH = REPO_ROOT / "internal" / "bench" / "corpora" / "ab-trackb.yaml"
CLONES_DIR = REPO_ROOT / "internal" / "bench" / "ab" / "clones"
REPORTS_DIR = REPO_ROOT / "internal" / "bench" / "reports" / "ab"

# How far we descend into a clone when snapshotting. The fixture is shallow.
SNAPSHOT_MAX_DEPTH = 6


def utc_stamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")


def snapshot_clone(clone_root: Path, *, max_depth: int = SNAPSHOT_MAX_DEPTH) -> dict[str, str]:
    """Return {relpath: sha256-short} for every fixture file under the clone.

    Skips the agent-config surface (.claude, .augment, AGENTS.md, CLAUDE.md, manifest)
    because that's the variant axis, not the task surface.
    """
    skip_roots = {".claude", ".augment"}
    skip_files = {"AGENTS.md", "CLAUDE.md", ".bench-ab-manifest.json"}
    out: dict[str, str] = {}
    for path in sorted(clone_root.rglob("*")):
        if not path.is_file():
            continue
        rel = path.relative_to(clone_root)
        parts = rel.parts
        if parts and parts[0] in skip_roots:
            continue
        if rel.as_posix() in skip_files:
            continue
        if len(parts) > max_depth:
            continue
        h = hashlib.sha256()
        try:
            h.update(path.read_bytes())
        except OSError:
            continue
        out[rel.as_posix()] = h.hexdigest()[:16]
    return out


def reset_clone(variant: str) -> Path:
    """Rebuild the clone so each task starts from the same state."""
    import importlib.util

    spec = importlib.util.spec_from_file_location(
        "bench_ab_clone", REPO_ROOT / "scripts" / "bench_ab_clone.py"
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load bench_ab_clone helper")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.clone(variant, refresh=True)  # type: ignore[attr-defined]


def claude_executable() -> str | None:
    """Resolve the claude CLI binary (env override → PATH)."""
    override = os.environ.get("CLAUDE_CLI")
    if override:
        return override
    if shutil.which("claude") is not None:
        return "claude"
    return None


def run_live(task: dict, clone_root: Path, *, timeout_s: int) -> dict:
    """Invoke claude in print/one-shot mode against the task prompt."""
    binary = claude_executable()
    if binary is None:
        return {
            "mode": "live-skipped",
            "reason": "claude CLI not found; set CLAUDE_CLI or install it",
            "transcript": "",
            "exit_code": None,
            "wall_time_seconds": 0.0,
        }
    prompt = task.get("prompt", "")
    cmd = [binary, "--print", "--", prompt]
    started = time.monotonic()
    try:
        proc = subprocess.run(
            cmd,
            cwd=clone_root,
            capture_output=True,
            text=True,
            timeout=timeout_s,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        return {
            "mode": "live",
            "reason": f"timeout after {timeout_s}s",
            "transcript": (exc.stdout or "") + "\n[TIMEOUT]",
            "exit_code": -1,
            "wall_time_seconds": round(time.monotonic() - started, 3),
        }
    duration = time.monotonic() - started
    return {
        "mode": "live",
        "reason": "ok",
        "transcript": proc.stdout + "\n" + proc.stderr,
        "exit_code": proc.returncode,
        "wall_time_seconds": round(duration, 3),
    }


def run_dry(task: dict, clone_root: Path, variant: str) -> dict:
    """Record what would have run; produce a deterministic stub transcript.

    The stub deliberately does NOT echo the user prompt: doing so would let
    transcript-keyword criteria spuriously match against the prompt text
    instead of the agent's response. The stub is therefore inert for every
    `transcript_contains_*` criterion, which is the honest dry-run signal.
    """
    stub_transcript = (
        "[bench_ab_task_runner dry-run]\n"
        f"variant={variant}\n"
        f"clone={clone_root}\n"
        f"task_id={task.get('id')}\n"
        "[no claude invocation; --mode live to execute for real]\n"
    )
    return {
        "mode": "dry-run",
        "reason": "ok",
        "transcript": stub_transcript,
        "exit_code": 0,
        "wall_time_seconds": 0.0,
    }


def count_ask_events(transcript: str) -> dict[str, int]:
    """Crude ask-vs-act heuristic over the transcript."""
    if not transcript:
        return {"asked": 0, "acted_with_commit": 0, "ratio": 0}
    lt = transcript.lower()
    ask_markers = ["should i", "do you want", "shall i", "soll ich", "möchtest du"]
    asked = sum(lt.count(m) for m in ask_markers)
    commit_markers = ["git commit", "git push", "gh pr create", "gh pr merge"]
    acted = sum(lt.count(m) for m in commit_markers)
    total = asked + acted
    ratio = round(asked / total, 3) if total else 0
    return {"asked": asked, "acted_with_commit": acted, "ratio": ratio}


def per_category_aggregate(per_task: list[dict]) -> dict[str, dict]:
    by_cat: dict[str, list[dict]] = {}
    for entry in per_task:
        by_cat.setdefault(entry.get("category", "unknown"), []).append(entry)
    out: dict[str, dict] = {}
    for cat, entries in by_cat.items():
        passed = sum(1 for e in entries if e.get("score", {}).get("passed"))
        total = len(entries)
        out[cat] = {
            "passed": passed,
            "total": total,
            "completion_rate": round(passed / total, 4) if total else 0,
            "mean_wall_time": round(
                sum(e.get("wall_time_seconds", 0) for e in entries) / total, 3
            )
            if total
            else 0,
        }
    return out


def write_report(
    variant: str,
    *,
    mode: str,
    per_task: list[dict],
    duration: float,
) -> Path:
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    cache_key = bench_ab_cache.CacheKey(
        corpus_hash=bench_ab_cache.hash_file(CORPUS_PATH),
        claude_cli_version=bench_ab_cache.claude_cli_version(),
        target_shape_hash=bench_ab_cache.target_shape_hash(),
    )
    total = len(per_task)
    passed = sum(1 for e in per_task if e.get("score", {}).get("passed"))
    results = {
        "mode": mode,
        "completion_rate": round(passed / total, 4) if total else 0,
        "passed": passed,
        "total": total,
        "per_category": per_category_aggregate(per_task),
        "mean_wall_time": round(
            sum(e.get("wall_time_seconds", 0) for e in per_task) / total, 3
        )
        if total
        else 0,
        "ask_vs_act_ratio": round(
            sum(e.get("ask_events", {}).get("ratio", 0) for e in per_task) / total, 3
        )
        if total
        else 0,
        "per_task": per_task,
    }
    stamp = utc_stamp()
    payload = {
        "schema": "ab-bench/0.1",
        "stamp": stamp,
        "variant": variant,
        "corpus": "ab-trackb",
        "cache_key": cache_key.to_dict(),
        "duration_seconds": round(duration, 3),
        "results": results,
    }
    path = REPORTS_DIR / f"{stamp}-ab-trackb-{variant}.json"
    path.write_text(json.dumps(payload, indent=2) + "\n")
    md = path.with_suffix(".md")
    md.write_text(
        f"# Track B · {variant} · {mode}\n\n"
        f"- Stamp: `{stamp}`\n"
        f"- Completion rate: **{results['completion_rate'] * 100:.1f}%**"
        f" ({passed}/{total})\n"
        f"- Mean wall-time: {results['mean_wall_time']}s\n"
        f"- Ask vs. act ratio: {results['ask_vs_act_ratio']}\n"
        f"\n## Per-category\n\n"
        + "\n".join(
            f"- `{cat}` — {info['passed']}/{info['total']} "
            f"({info['completion_rate'] * 100:.1f}%)"
            for cat, info in results["per_category"].items()
        )
        + "\n"
    )
    return path


def run_variant(variant: str, tasks: list[dict], *, mode: str, timeout_s: int) -> dict:
    started = time.monotonic()
    per_task: list[dict] = []
    for task in tasks:
        clone_root = reset_clone(variant)
        pre = snapshot_clone(clone_root)
        if mode == "live":
            run_result = run_live(task, clone_root, timeout_s=timeout_s)
        else:
            run_result = run_dry(task, clone_root, variant)
        post = snapshot_clone(clone_root)
        score = bench_ab_scoring.score_task(
            task,
            pre_snapshot=pre,
            post_snapshot=post,
            clone_root=clone_root,
            transcript=run_result.get("transcript", ""),
        )
        per_task.append(
            {
                "id": task.get("id"),
                "category": task.get("category"),
                "score": score,
                "wall_time_seconds": run_result.get("wall_time_seconds", 0.0),
                "exit_code": run_result.get("exit_code"),
                "mode": run_result.get("mode", mode),
                "reason": run_result.get("reason", ""),
                "ask_events": count_ask_events(run_result.get("transcript", "")),
            }
        )
    duration = time.monotonic() - started
    path = write_report(variant, mode=mode, per_task=per_task, duration=duration)
    sys.stdout.write(
        f"bench_ab_task_runner: {variant} ({mode}) → "
        f"{sum(1 for e in per_task if e['score']['passed'])}/{len(per_task)} "
        f"passed — {path.relative_to(REPO_ROOT)}\n"
    )
    return {"path": path, "per_task": per_task, "duration": duration}


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Track B tasks per variant.")
    parser.add_argument(
        "--variant",
        choices=("with", "without", "both"),
        default="both",
        help="Which variant to run (default: both).",
    )
    parser.add_argument(
        "--mode",
        choices=("dry-run", "live"),
        default="dry-run",
        help=(
            "dry-run: stub transcript, no CLI invocation (fast, free). "
            "live: invoke `claude --print` per task (cost-bearing)."
        ),
    )
    parser.add_argument(
        "--timeout",
        type=int,
        default=120,
        help="Live mode: per-task timeout in seconds (default 120).",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])
    if not CORPUS_PATH.exists():
        sys.stderr.write(f"bench_ab_task_runner: corpus missing at {CORPUS_PATH}\n")
        return 1
    data = yaml.safe_load(CORPUS_PATH.read_text())
    tasks = data.get("tasks") or []
    if not tasks:
        sys.stderr.write("bench_ab_task_runner: corpus has no tasks\n")
        return 1
    variants = ("with", "without") if args.variant == "both" else (args.variant,)
    for variant in variants:
        run_variant(variant, tasks, mode=args.mode, timeout_s=args.timeout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
