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
import threading
import time
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))

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

# --- Activation (proven mechanism) ---
# agent-config is a GLOBAL Claude Code plugin (enabledPlugins in ~/.claude
# settings), so plain `claude --print` already runs WITH the package. The clean
# control is `--setting-sources project,local`, which excludes the user settings
# where `enabledPlugins` lives → plugin OFF, but auth survives. Measured proof:
# plain --print = ~35.5k input tokens; --setting-sources project,local = ~11.9k
# → the ~24k delta IS the package's always-on footprint. So:
#   without  = `--setting-sources project,local`  (plugin OFF, base model)
#   with     = plain `--print`                     (the real installed plugin = package)
#   with-rdp = plain `--print` + RDP rules injected (RDP not yet in the release plugin)
# (`--bare` is NOT used — it disables auth too.)
RDP_EXTRA_FILES = (
    REPO_ROOT / "src" / "rules" / "notes-first-reasoning.md",
    REPO_ROOT / "src" / "agent-src" / "contexts" / "execution" / "rdp-gate.md",
)


def _concat_rules(paths) -> str:
    parts: list[str] = []
    for p in paths:
        try:
            parts.append(p.read_text(encoding="utf-8"))
        except OSError:
            continue
    return "\n\n---\n\n".join(parts)


def system_prompt_for(variant: str) -> str | None:
    """Extra rules injected on top of the plugin. Only `with-rdp` injects (the RDP
    artifacts aren't in the released plugin yet); `with` uses the real plugin,
    `without` runs plugin-off."""
    if variant == "with-rdp":
        return _concat_rules([p for p in RDP_EXTRA_FILES if p.exists()])
    return None


def setting_sources_for(variant: str) -> str | None:
    """`without` excludes user settings to drop the global plugin (auth survives)."""
    return "project,local" if variant == "without" else None


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
        "bench_ab_clone", REPO_ROOT / "src" / "scripts" / "bench_ab_clone.py"
    )
    if spec is None or spec.loader is None:
        raise RuntimeError("cannot load bench_ab_clone helper")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.clone(variant, refresh=True, quiet=True)  # type: ignore[attr-defined]


def claude_executable() -> str | None:
    """Resolve the claude CLI binary (env override → PATH)."""
    override = os.environ.get("CLAUDE_CLI")
    if override:
        return override
    # Resolve to an absolute path so the subprocess (run with cwd=clone_root)
    # cannot miss it on a PATH/cwd quirk — the failure that showed up as a
    # spurious "claude CLI not found" on a later arm of the first full run.
    return shutil.which("claude")


def run_live(
    task: dict,
    clone_root: Path,
    *,
    timeout_s: int,
    sysprompt_file: "Path | None" = None,
    setting_sources: "str | None" = None,
    max_budget: "float | None" = None,
    model: "str | None" = None,
) -> dict:
    """Invoke claude in print/one-shot mode against the task prompt.

    `setting_sources` (e.g. "project,local") drops the global plugin for the
    `without` arm while keeping auth. `sysprompt_file` injects extra rules
    (the `with-rdp` arm). `with` passes neither → the real installed plugin.
    """
    binary = claude_executable()
    if binary is None:
        return {
            "mode": "live-skipped",
            "reason": "claude CLI not found; set CLAUDE_CLI or install it",
            "transcript": "",
            "exit_code": None,
            "wall_time_seconds": 0.0,
            "tokens": 0,
            "tokens_breakdown": {},
            "errored": True,
        }
    prompt = task.get("prompt", "")
    # --output-format json yields a `usage` block for token counts. The global
    # plugin is dropped per-arm via --setting-sources (NOT --bare, which kills auth).
    # bypassPermissions on EVERY arm: the clone is a throwaway fixture, and this
    # equalizes file-edit capability across arms (else `without`, which excludes
    # user settings, would lack edit perms and fail tasks for the wrong reason).
    cmd = [binary, "--print", "--output-format", "json", "--permission-mode", "bypassPermissions"]
    if model:
        # Pin ONE model across every arm. The session default here is Opus-4.8-1M,
        # whose ~$1.78 first-turn cache-creation trips any sane budget cap instantly
        # and makes a full corpus run blow the account quota. Holding the model
        # constant is also a validity requirement: the bench measures the package
        # LIFT on a fixed host, not model-vs-model.
        cmd += ["--model", model]
    if max_budget:
        # Caps per-task API spend so one runaway agentic loop can't exhaust the
        # account quota (the failure mode that starved later arms on the first run).
        cmd += ["--max-budget-usd", str(max_budget)]
    if setting_sources:
        cmd += ["--setting-sources", setting_sources]
    if sysprompt_file is not None:
        cmd += ["--append-system-prompt-file", str(sysprompt_file)]
    cmd += ["--", prompt]
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
            "tokens": 0,
            "tokens_breakdown": {},
            "errored": True,
        }
    duration = time.monotonic() - started
    # Parse the JSON envelope: `result` is the model text; `usage` holds tokens.
    transcript = proc.stdout
    tokens = 0
    is_error = False
    err_reason = "ok"
    breakdown = {
        "input_tokens": 0,
        "output_tokens": 0,
        "cache_read_input_tokens": 0,
        "cache_creation_input_tokens": 0,
    }
    try:
        obj = json.loads(proc.stdout)
        is_error = bool(obj.get("is_error"))
        transcript = obj.get("result") or obj.get("text") or proc.stdout
        usage = obj.get("usage") or {}
        breakdown = {
            k: int(usage.get(k, 0) or 0)
            for k in (
                "input_tokens",
                "output_tokens",
                "cache_read_input_tokens",
                "cache_creation_input_tokens",
            )
        }
        tokens = sum(breakdown.values())
        # The top-level `usage` block is zeroed on a budget-capped / errored run
        # (and unreliable even on some completions). `modelUsage` carries the
        # authoritative per-model counts — sum it as the fallback so token deltas
        # survive even when a task hits its cap mid-flight.
        if tokens == 0:
            mu = obj.get("modelUsage") or {}
            agg = {
                "input_tokens": 0,
                "output_tokens": 0,
                "cache_read_input_tokens": 0,
                "cache_creation_input_tokens": 0,
            }
            for stats in mu.values():
                agg["input_tokens"] += int(stats.get("inputTokens", 0) or 0)
                agg["output_tokens"] += int(stats.get("outputTokens", 0) or 0)
                agg["cache_read_input_tokens"] += int(
                    stats.get("cacheReadInputTokens", 0) or 0
                )
                agg["cache_creation_input_tokens"] += int(
                    stats.get("cacheCreationInputTokens", 0) or 0
                )
            mu_total = sum(agg.values())
            if mu_total > 0:
                breakdown = agg
                tokens = mu_total
        # Surface WHY a task errored (budget cap vs. other) without leaking $.
        if is_error:
            err_reason = obj.get("subtype") or "error"
    except (json.JSONDecodeError, AttributeError, ValueError):
        transcript = proc.stdout
    return {
        "mode": "live",
        "reason": err_reason if is_error else ("ok" if proc.returncode == 0 else f"exit {proc.returncode}"),
        "transcript": str(transcript) + "\n" + proc.stderr,
        "exit_code": proc.returncode,
        "wall_time_seconds": round(duration, 3),
        "tokens": tokens,
        "tokens_breakdown": breakdown,
        "errored": is_error or proc.returncode != 0,
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


PROGRESS_PATH = REPORTS_DIR / ".progress.json"


def _write_progress(state: dict) -> None:
    """Mirror live state to .progress.json for `task bench:ab:watch` (best-effort)."""
    try:
        REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        PROGRESS_PATH.write_text(json.dumps(state, indent=2) + "\n")
    except OSError:
        pass


class Progress:
    """Live per-task progress. stdlib-only, TTY-aware, log-safe.

    style: auto (bar if stderr is a TTY, else one plain line per task) | bar |
    plain | none. Mirrors state to .progress.json regardless of style.
    """

    BAR_WIDTH = 24

    def __init__(self, total: int, *, mode: str, style: str = "auto", stream=sys.stderr) -> None:
        self.total = max(total, 1)
        self.mode = mode
        self.stream = stream
        self.done = 0
        self.started = time.monotonic()
        if style in ("bar", "plain", "none"):
            self.kind = style
        else:  # auto
            self.kind = "bar" if getattr(stream, "isatty", lambda: False)() else "plain"
        self._cur = ""
        self._task_started = 0.0
        self._hb_stop: "threading.Event | None" = None
        self._hb_thread: "threading.Thread | None" = None

    def _elapsed(self, since: float) -> str:
        s = int(time.monotonic() - since)
        return f"{s // 60}m{s % 60:02d}s" if s >= 60 else f"{s}s"

    def _bar(self) -> str:
        filled = int(self.BAR_WIDTH * self.done / self.total)
        return "█" * filled + "░" * (self.BAR_WIDTH - filled)

    def _render_bar(self, suffix: str = "") -> None:
        line = f"\r[{self._bar()}] {self.done}/{self.total} · {self._cur} · {self._elapsed(self.started)}{suffix}"
        self.stream.write(line.ljust(90)[:160])
        self.stream.flush()

    def _start_heartbeat(self) -> None:
        if self.kind != "bar" or self.mode != "live":
            return
        self._hb_stop = threading.Event()

        def _tick() -> None:
            assert self._hb_stop is not None
            while not self._hb_stop.wait(1.0):
                self._render_bar(suffix=f" · {self._elapsed(self._task_started)}…")

        self._hb_thread = threading.Thread(target=_tick, daemon=True)
        self._hb_thread.start()

    def _stop_heartbeat(self) -> None:
        if self._hb_stop is not None:
            self._hb_stop.set()
        if self._hb_thread is not None:
            self._hb_thread.join(timeout=2.0)
        self._hb_stop = self._hb_thread = None

    def start_task(self, variant: str, idx: int, count: int, task_id: str) -> None:
        self._cur = f"{variant} {idx}/{count} · {task_id}"
        self._task_started = time.monotonic()
        _write_progress({
            "mode": self.mode, "variant": variant, "task_idx": idx, "task_count": count,
            "total_done": self.done, "total": self.total, "current_id": task_id,
            "started_at": utc_stamp(), "last_result": None,
        })
        if self.kind == "none":
            return
        if self.kind == "bar":
            self._render_bar(suffix=" · running…" if self.mode == "live" else "")
            self._start_heartbeat()
        elif self.mode == "live":  # plain: a start marker so a long task isn't mistaken for a hang
            self.stream.write(f"[{self.done + 1}/{self.total}] ▶ {self._cur}\n")
            self.stream.flush()

    def end_task(self, *, passed: bool, wall: float, variant: str, task_id: str) -> None:
        self._stop_heartbeat()
        self.done += 1
        mark = "✓" if passed else "✗"
        _write_progress({
            "mode": self.mode, "variant": variant, "total_done": self.done,
            "total": self.total, "current_id": task_id, "updated_at": utc_stamp(),
            "last_result": "pass" if passed else "fail",
        })
        if self.kind == "none":
            return
        if self.kind == "bar":
            self._render_bar(suffix=f" · {mark}")
        else:
            self.stream.write(f"[{self.done}/{self.total}] {mark} {variant} · {task_id} · {wall:.1f}s\n")
            self.stream.flush()

    def variant_done(self, line: str) -> None:
        """Print a per-variant summary line without corrupting an active bar."""
        if self.kind == "bar":
            self.stream.write("\n")
        self.stream.write(line if line.endswith("\n") else line + "\n")
        self.stream.flush()

    def finish(self) -> None:
        if self.kind == "bar":
            self.stream.write("\n")
        if self.kind != "none":
            self.stream.write(
                f"bench progress: {self.done}/{self.total} tasks · total {self._elapsed(self.started)}\n"
            )
            self.stream.flush()


def per_category_aggregate(per_task: list[dict]) -> dict[str, dict]:
    by_cat: dict[str, list[dict]] = {}
    for entry in per_task:
        by_cat.setdefault(entry.get("category", "unknown"), []).append(entry)
    out: dict[str, dict] = {}
    for cat, entries in by_cat.items():
        done = [e for e in entries if not e.get("errored")]
        passed = sum(1 for e in done if e.get("score", {}).get("passed"))
        total = len(entries)
        completed = len(done)
        out[cat] = {
            "passed": passed,
            "total": total,
            "completed": completed,
            "errored": total - completed,
            "completion_rate": round(passed / completed, 4) if completed else 0,
            "mean_wall_time": round(
                sum(e.get("wall_time_seconds", 0) for e in done) / completed, 3
            )
            if completed
            else 0,
            "mean_tokens": round(sum(e.get("tokens", 0) for e in done) / completed)
            if completed
            else 0,
        }
    return out


def per_cell_aggregate(per_task: list[dict]) -> dict[str, dict]:
    """Aggregate by the 2×2 (duration × cognitive) cell — the value-benchmark axis.

    Compared across conditions this answers "are short tasks more expensive?"
    (cell `short/mechanical`) and "do long tasks get cheaper / better?"
    (cell `long/reasoning-heavy`). Cell key is `"<duration>/<cognitive>"`.
    """
    by_cell: dict[str, list[dict]] = {}
    for entry in per_task:
        cell = f"{entry.get('duration', 'untagged')}/{entry.get('cognitive', 'untagged')}"
        by_cell.setdefault(cell, []).append(entry)
    out: dict[str, dict] = {}
    for cell, entries in by_cell.items():
        done = [e for e in entries if not e.get("errored")]
        passed = sum(1 for e in done if e.get("score", {}).get("passed"))
        total = len(entries)
        completed = len(done)
        out[cell] = {
            "passed": passed,
            "total": total,
            "completed": completed,
            "errored": total - completed,
            "completion_rate": round(passed / completed, 4) if completed else 0,
            "mean_wall_time": round(
                sum(e.get("wall_time_seconds", 0) for e in done) / completed, 3
            )
            if completed
            else 0,
            "mean_tokens": round(sum(e.get("tokens", 0) for e in done) / completed)
            if completed
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
    done = [e for e in per_task if not e.get("errored")]
    completed = len(done)
    errored = total - completed
    passed = sum(1 for e in done if e.get("score", {}).get("passed"))
    results = {
        "mode": mode,
        # Hit-rate is over COMPLETED tasks only — errored (rate-limit / budget /
        # timeout / CLI-fail) tasks are excluded so a transient quota trip does
        # not read as a content failure of the package.
        "completion_rate": round(passed / completed, 4) if completed else 0,
        "passed": passed,
        "completed": completed,
        "errored": errored,
        "total": total,
        "per_category": per_category_aggregate(per_task),
        "per_cell": per_cell_aggregate(per_task),
        "mean_wall_time": round(
            sum(e.get("wall_time_seconds", 0) for e in done) / completed, 3
        )
        if completed
        else 0,
        "total_tokens": sum(e.get("tokens", 0) for e in done),
        "mean_tokens": round(sum(e.get("tokens", 0) for e in done) / completed)
        if completed
        else 0,
        "ask_vs_act_ratio": round(
            sum(e.get("ask_events", {}).get("ratio", 0) for e in done) / completed, 3
        )
        if completed
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
        f" ({passed}/{completed} completed; {errored} errored of {total})\n"
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


def run_variant(
    variant: str,
    tasks: list[dict],
    *,
    mode: str,
    timeout_s: int,
    max_budget: "float | None" = None,
    model: "str | None" = None,
    progress: "Progress | None" = None,
) -> dict:
    started = time.monotonic()
    # Build the injected rule corpus once per variant (live only).
    sp_file: "Path | None" = None
    if mode == "live":
        sp_text = system_prompt_for(variant)
        if sp_text:
            REPORTS_DIR.mkdir(parents=True, exist_ok=True)
            sp_file = REPORTS_DIR / f".sysprompt-{variant}.txt"
            sp_file.write_text(sp_text, encoding="utf-8")
    per_task: list[dict] = []
    for i, task in enumerate(tasks):
        if progress is not None:
            progress.start_task(variant, i + 1, len(tasks), str(task.get("id")))
        # Fixture-only working dir, identical for every arm — the package is NOT
        # in the clone files; activation is the injected system prompt (sp_file).
        clone_root = reset_clone("without")
        pre = snapshot_clone(clone_root)
        if mode == "live":
            run_result = run_live(
                task,
                clone_root,
                timeout_s=timeout_s,
                sysprompt_file=sp_file,
                setting_sources=setting_sources_for(variant),
                max_budget=max_budget,
                model=model,
            )
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
                "duration": task.get("duration"),
                "cognitive": task.get("cognitive"),
                "score": score,
                # `errored` = the run did not complete on merit (rate-limit,
                # budget-cap, timeout, CLI failure). Distinct from a content
                # fail (`score.passed == False`). Errored tasks are excluded
                # from the hit-rate so a transient quota trip can't masquerade
                # as the package "not working".
                "errored": bool(run_result.get("errored", False)),
                "wall_time_seconds": run_result.get("wall_time_seconds", 0.0),
                "tokens": run_result.get("tokens", 0),
                "tokens_breakdown": run_result.get("tokens_breakdown", {}),
                "exit_code": run_result.get("exit_code"),
                "mode": run_result.get("mode", mode),
                "reason": run_result.get("reason", ""),
                "ask_events": count_ask_events(run_result.get("transcript", "")),
            }
        )
        if progress is not None:
            progress.end_task(
                passed=bool(score.get("passed")),
                wall=float(run_result.get("wall_time_seconds", 0.0) or 0.0),
                variant=variant,
                task_id=str(task.get("id")),
            )
    duration = time.monotonic() - started
    path = write_report(variant, mode=mode, per_task=per_task, duration=duration)
    summary = (
        f"bench_ab_task_runner: {variant} ({mode}) → "
        f"{sum(1 for e in per_task if e['score']['passed'])}/{len(per_task)} "
        f"passed — {path.relative_to(REPO_ROOT)}"
    )
    if progress is not None:
        progress.variant_done(summary)
    else:
        sys.stdout.write(summary + "\n")
    return {"path": path, "per_task": per_task, "duration": duration}


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Track B tasks per variant.")
    parser.add_argument(
        "--variant",
        choices=("with", "without", "with-rdp", "both", "all"),
        default="both",
        help="with | without | with-rdp | both (=with+without, back-compat "
        "default) | all (=the 3-condition value-benchmark set).",
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
    parser.add_argument(
        "--progress",
        choices=("auto", "bar", "plain", "none"),
        default="auto",
        help="Live display: auto (TTY→bar, else plain line-per-task) | bar | plain | none.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Run only the first N tasks per variant (0 = all). For cheap smoke tests.",
    )
    parser.add_argument(
        "--tasks",
        default="",
        help=(
            "Comma-separated task IDs to run (e.g. trackb-bugfix-01,trackb-refactor-01). "
            "Overrides --limit. Use to span the 2×2 cells in a bounded run instead of "
            "taking the first-N in file order."
        ),
    )
    parser.add_argument(
        "--model",
        default="claude-sonnet-4-6",
        help=(
            "Pin ONE model across all arms (live mode). Default claude-sonnet-4-6 — "
            "capable enough to complete the coding tasks, ~2.3x cheaper per turn than "
            "the Opus-4.8-1M session default whose cache-creation blows the quota. "
            "Empty string = inherit the session default (expensive)."
        ),
    )
    parser.add_argument(
        "--budget",
        type=float,
        default=2.0,
        help=(
            "Live mode: per-task API spend cap in USD (passed to "
            "`claude --max-budget-usd`). Stops a runaway agentic loop from "
            "exhausting the account quota and starving later arms. 0 = uncapped. "
            "Default 2.0."
        ),
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
    if args.tasks.strip():
        wanted = [s.strip() for s in args.tasks.split(",") if s.strip()]
        by_id = {t.get("id"): t for t in tasks}
        missing = [w for w in wanted if w not in by_id]
        if missing:
            sys.stderr.write(
                f"bench_ab_task_runner: unknown task id(s): {', '.join(missing)}\n"
            )
            return 1
        tasks = [by_id[w] for w in wanted]
    elif args.limit and args.limit > 0:
        tasks = tasks[: args.limit]
    if args.variant == "both":
        variants = ("with", "without")
    elif args.variant == "all":
        variants = ("with", "without", "with-rdp")
    else:
        variants = (args.variant,)
    max_budget = args.budget if args.budget and args.budget > 0 else None
    model = args.model or None
    progress = Progress(len(variants) * len(tasks), mode=args.mode, style=args.progress)
    for variant in variants:
        run_variant(
            variant,
            tasks,
            mode=args.mode,
            timeout_s=args.timeout,
            max_budget=max_budget,
            model=model,
            progress=progress,
        )
    progress.finish()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
