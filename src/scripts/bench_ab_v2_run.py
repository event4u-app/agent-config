#!/usr/bin/env python3
"""bench:ab v2 — discipline-axis runner (Phases 2-4).

Runs the discipline-headroom corpus (ab-trackb-v2.yaml) across FOUR arms on a
fixed host model, scores each on the dual axis (capability + discipline) plus
trajectory metrics, and emits a PAIRED per-instance report (the same task × seed
seen under every arm) so the lift is computed paired, not as independent rates.

Arms (council L2/L5):
- vanilla       : plugin OFF (--setting-sources project,local), no injection.
- package       : the REAL installed plugin (plain --print).
- package-rdp   : real plugin + RDP rules injected (--append-system-prompt-file).
- placebo       : plugin OFF + an equal-length INERT prose block — controls for
                  "does any long prompt prime caution?" so a measured lift can't
                  be dismissed as prompt-length priming.

Reuses the v1 harness primitives (run_live, claude_executable, count_ask_events,
RDP sysprompt) — refactor-in-place per the v2 inventory; only corpus + scorer +
metrics + arms are new.

Cost controls inherited: --model pin (sonnet), --max-budget-usd cap. Cheap-by-
construction: the v2 fixtures are tiny, so per-run tokens are far below the v1
big-repo tasks.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent / "_lib"))
import bench_ab_scoring_v2 as scoring  # noqa: E402

# Import v1 primitives (skeleton reuse).
sys.path.insert(0, str(Path(__file__).resolve().parent))
import bench_ab_task_runner as v1  # noqa: E402

import tempfile  # noqa: E402

REPO_ROOT = v1.REPO_ROOT
CORPUS_PATH = REPO_ROOT / "internal" / "bench" / "corpora" / "ab-trackb-v2.yaml"
FIXTURES_ROOT = REPO_ROOT / "internal" / "bench" / "ab"
REPORTS_DIR = REPO_ROOT / "internal" / "bench" / "reports" / "ab-v2"
# CRITICAL (2026-06-15): clones MUST live OUTSIDE the agent-config repo. A clone
# under the repo lets Claude discover the repo's own project surface (CLAUDE.md /
# AGENTS.md / .claude/rules+skills) walking up from the cwd — so the `vanilla`
# arm (--setting-sources project,local) silently inherited ~126k tokens of the
# package via PROJECT scope (measured: 150k in-repo vs 24k in /tmp). That made
# vanilla ≈ package and invalidated every prior null. A /tmp clone has no
# agent-config ancestor → vanilla is truly plain; `package` still activates via
# the USER-scope global plugin regardless of cwd.
WORK_ROOT = Path(tempfile.gettempdir()) / "agent-config-bench-v2-clones"

# Arm -> (setting_sources, inject) where inject ∈ {None, "rdp", "placebo"}.
ARMS = {
    "vanilla": ("project,local", None),
    "package": (None, None),
    "package-rdp": (None, "rdp"),
    "placebo": ("project,local", "placebo"),
}


def placebo_prose(target_chars: int) -> str:
    """Deterministic inert prose of ~target_chars — no rules, no discipline cues.

    Sized to the package's injected footprint so the placebo arm is a genuine
    length control. Content is neutral filler that must NOT prime careful
    behaviour (no 'verify', 'minimal', 'careful', 'ask' vocabulary)."""
    sentence = (
        "The following note is background context with no bearing on the task. "
        "It describes a fictional inventory of office supplies across several "
        "storage rooms, listing quantities of paper, folders, and assorted "
        "stationery without any instruction or guidance of any kind. "
    )
    out = []
    n = 0
    i = 0
    while n < target_chars:
        line = f"Section {i}: " + sentence
        out.append(line)
        n += len(line)
        i += 1
    return "".join(out)[:target_chars]


def injected_text(inject: str | None, placebo_chars: int) -> str | None:
    if inject == "rdp":
        return v1.system_prompt_for("with-rdp")
    if inject == "placebo":
        return placebo_prose(placebo_chars)
    return None


def reset_fixture(task: dict) -> Path:
    """Copy the task's pristine fixture into a throwaway working clone."""
    fixture = FIXTURES_ROOT / task["fixture"]
    dest = WORK_ROOT / task["id"]
    if dest.exists():
        shutil.rmtree(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(fixture, dest)
    return dest, fixture


def status_bucket(run: dict) -> str:
    """Map a run outcome to an AgentBench-style trajectory bucket."""
    if not run.get("errored"):
        return "completed"
    sub = (run.get("subtype") or "").lower()
    if "budget" in sub:
        return "budget_limit"
    if "timeout" in (run.get("reason") or "").lower() or run.get("exit_code") == -1:
        return "task_limit"
    if "max_turns" in sub or "turn" in sub:
        return "task_limit"
    return "validation_failed"


def trajectory_metrics(run: dict, score: dict) -> dict:
    asks = v1.count_ask_events(run.get("transcript", ""))
    return {
        "status_bucket": status_bucket(run),
        "num_turns": run.get("num_turns", 0),
        "files_changed": len(score.get("files_changed", [])),
        "ask_vs_act_ratio": asks.get("ratio", 0),
        "ask_events": asks.get("asks", 0) if isinstance(asks, dict) else 0,
        "wall_time_seconds": run.get("wall_time_seconds", 0.0),
        "tokens": run.get("tokens", 0),
    }


def run_one(task: dict, arm: str, *, model, max_budget, timeout, placebo_chars,
            sp_dir: Path) -> dict:
    setting_sources, inject = ARMS[arm]
    clone, fixture = reset_fixture(task)
    sp_text = injected_text(inject, placebo_chars)
    sp_file = None
    if sp_text:
        sp_file = sp_dir / f".sp-{arm}.txt"
        sp_file.write_text(sp_text, encoding="utf-8")
    run = v1.run_live(
        task, clone,
        timeout_s=timeout,
        sysprompt_file=sp_file,
        setting_sources=setting_sources,
        max_budget=max_budget,
        model=model,
    )
    score = scoring.score_task_v2(
        task, fixture_root=fixture, clone_root=clone,
        transcript=run.get("transcript", ""),
    )
    return {
        "errored": bool(run.get("errored")),
        "reason": run.get("reason"),
        "capability_pass": score["capability_pass"],
        "discipline_score": score["discipline_score"],
        "discipline_pass": score["discipline_pass"],
        "metrics": trajectory_metrics(run, score),
        "injected_chars": len(sp_text) if sp_text else 0,
    }


def main(argv: "list[str] | None" = None) -> int:
    ap = argparse.ArgumentParser(description="bench:ab v2 discipline-axis runner.")
    ap.add_argument("--arms", default="vanilla,package,package-rdp,placebo")
    ap.add_argument("--seeds", type=int, default=3, help="reps per arm (stochastic seeds).")
    ap.add_argument("--tasks", default="", help="comma-separated task ids (default: all).")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--model", default="claude-sonnet-4-6")
    ap.add_argument("--budget", type=float, default=1.0, help="per-run --max-budget-usd (0=off).")
    ap.add_argument("--timeout", type=int, default=180)
    ap.add_argument("--mode", choices=("live", "dry-run"), default="live")
    args = ap.parse_args(argv if argv is not None else sys.argv[1:])

    corpus = yaml.safe_load(CORPUS_PATH.read_text())
    tasks = corpus.get("tasks") or []
    if args.tasks.strip():
        want = {s.strip() for s in args.tasks.split(",") if s.strip()}
        tasks = [t for t in tasks if t["id"] in want]
    elif args.limit:
        tasks = tasks[: args.limit]
    arms = [a.strip() for a in args.arms.split(",") if a.strip()]
    for a in arms:
        if a not in ARMS:
            sys.stderr.write(f"unknown arm: {a}\n")
            return 1

    if args.mode == "dry-run":
        sys.stdout.write(
            f"bench_ab_v2: DRY — {len(tasks)} tasks × {len(arms)} arms × "
            f"{args.seeds} seeds = {len(tasks) * len(arms) * args.seeds} runs "
            f"(model={args.model}, budget={args.budget}). No spend.\n"
        )
        return 0

    if v1.claude_executable() is None:
        sys.stderr.write("claude CLI not found\n")
        return 1

    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    sp_dir = REPORTS_DIR
    max_budget = args.budget if args.budget and args.budget > 0 else None
    # Size the placebo to the RDP injection so package-rdp vs placebo is length-matched.
    rdp_text = v1.system_prompt_for("with-rdp") or ""
    placebo_chars = max(len(rdp_text), 2000)

    total = len(tasks) * len(arms) * args.seeds
    done = 0
    records: list[dict] = []
    for task in tasks:
        per_arm: dict[str, list[dict]] = {}
        for arm in arms:
            seed_runs = []
            for seed in range(args.seeds):
                done += 1
                sys.stderr.write(
                    f"[{done}/{total}] {task['id']} · {arm} · seed {seed}\n")
                sys.stderr.flush()
                r = run_one(
                    task, arm, model=args.model, max_budget=max_budget,
                    timeout=args.timeout, placebo_chars=placebo_chars, sp_dir=sp_dir)
                r["seed"] = seed
                seed_runs.append(r)
            per_arm[arm] = seed_runs
        records.append({
            "id": task["id"],
            "archetype": task["archetype"],
            "rule": task["rule"],
            "arms": per_arm,
        })

    stamp = v1.utc_stamp()
    payload = {
        "schema": "ab-bench-v2/0.1",
        "stamp": stamp,
        "model": args.model,
        "seeds": args.seeds,
        "arms": arms,
        "budget_usd_per_run": args.budget,
        "placebo_chars": placebo_chars,
        "corpus": "ab-trackb-v2",
        "records": records,
    }
    out = REPORTS_DIR / f"{stamp}-ab-v2-paired.json"
    out.write_text(json.dumps(payload, indent=2) + "\n")
    sys.stdout.write(f"bench_ab_v2: wrote {out.relative_to(REPO_ROOT)} "
                     f"({len(records)} tasks, {total} runs)\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
