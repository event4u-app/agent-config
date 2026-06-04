#!/usr/bin/env python3
"""Wrap ``gh run list`` and assert the required-check set is green.

Phase A Step 6 of ``road-to-adoption-proof-and-ci-green.md``. Sits
between the maintainer and the GitHub UI so a one-line
``task ci:status`` shows whether the required-check floor (as defined
in ``docs/contracts/branch-protection-policy.md`` § Per-PR-shape
required-check matrix) is green on the branch passed via ``--branch``.

Phantom 0-job runs are filtered before the tally — they are listed
under "advisory / phantom" in ``docs/contracts/ci-green-floor.md`` and
must not freeze merges (the ``--strict`` flag honours this).

CLI:

  scripts/ci_status.py [--branch main] [--limit 30] [--strict]
                       [--shape feature|release|docs] [--json]

Exit codes:

  0 — every required check on the most recent run is success
      (or the matching workflow simply has not run yet under
      ``--strict``; the gate distinguishes "missing" from "red").
  1 — at least one required-check workflow is red or in a
      terminal-non-success state.
  2 — invalid arguments / unreachable gh CLI.

The required-check shape vocabulary mirrors
``branch-protection-policy.md`` exactly so a future ruleset edit in
one place stays single-sourced.
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
from dataclasses import dataclass


# Source-of-truth for the per-shape required-check set. Anchored to
# the matrix in docs/contracts/branch-protection-policy.md § Per-PR-shape
# required-check matrix. When that doc changes, this dict changes in
# lockstep — a CI-side linter cross-checks the two surfaces.
REQUIRED_CHECKS_BY_SHAPE: dict[str, set[str]] = {
    "feature": {
        "Consistency",
        "Smoke Contracts",
        "Skill Lint",
        "Tests",
        "Python Version Sweep",
        "Public Install Smoke",
    },
    "release": {
        "Consistency",
        "Smoke Contracts",
        "Release Validation",
    },
    "docs": {
        "Consistency",
        "Smoke Contracts",
    },
}


@dataclass(frozen=True)
class Run:
    name: str
    conclusion: str
    status: str
    jobs: int


def fetch_runs(branch: str, limit: int) -> list[Run]:
    """Call `gh run list` and return parsed Run records."""
    if shutil.which("gh") is None:
        raise SystemExit("error: gh CLI not found in PATH")
    cmd = [
        "gh",
        "run",
        "list",
        "--branch",
        branch,
        "--limit",
        str(limit),
        "--json",
        "databaseId,name,status,conclusion",
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, check=True)
    except subprocess.CalledProcessError as exc:
        raise SystemExit(f"error: gh run list failed — {exc.stderr.strip()}")
    raw = json.loads(proc.stdout or "[]")
    runs: list[Run] = []
    for r in raw:
        # `gh run list` does not surface Jobs count — we need a second
        # call per run id to find phantom 0-job runs. Keep that call to
        # the runs that *would* be counted (non-success terminal) so the
        # cost is bounded by the number of red runs, not the full window.
        runs.append(
            Run(
                name=r.get("name", ""),
                conclusion=r.get("conclusion", ""),
                status=r.get("status", ""),
                jobs=-1,  # unknown — resolved lazily for non-success runs
            )
        )
    return runs


def resolve_jobs_count(run_id: int) -> int:
    """Return the number of jobs for a single run id (for phantom filter)."""
    cmd = [
        "gh",
        "run",
        "view",
        str(run_id),
        "--json",
        "jobs",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        return -1
    data = json.loads(proc.stdout or "{}")
    return len(data.get("jobs", []))


def is_phantom(run: Run) -> bool:
    """True when the run has 0 jobs AND its conclusion is `failure`."""
    if run.conclusion != "failure":
        return False
    if run.jobs == 0:
        return True
    return False


def latest_per_workflow(runs: list[Run]) -> dict[str, Run]:
    """Pick the latest run per workflow name (input order is mtime-desc)."""
    out: dict[str, Run] = {}
    for r in runs:
        if r.name in out:
            continue
        if r.status != "completed":
            # In-progress / queued runs are pending; treat as unknown.
            continue
        out[r.name] = r
    return out


def compute_status(
    runs: list[Run],
    required: set[str],
    resolve_jobs: bool = True,
) -> tuple[list[tuple[str, Run]], list[str], list[tuple[str, Run]]]:
    """Return (greens, missing, reds-after-phantom-filter)."""
    by_name = latest_per_workflow(runs)
    greens: list[tuple[str, Run]] = []
    reds: list[tuple[str, Run]] = []
    missing: list[str] = []
    for name in sorted(required):
        run = by_name.get(name)
        if run is None:
            missing.append(name)
            continue
        if run.conclusion == "success":
            greens.append((name, run))
            continue
        # Non-success — check for phantom 0-job.
        if resolve_jobs and run.jobs < 0:
            # Resolve the jobs count for this single run lazily.
            # We don't have the database id in our Run records (the JSON
            # field is `databaseId` and we dropped it for brevity); refetch
            # the latest red run for this workflow by name.
            run_id = _latest_run_id_for_workflow(name, run)
            jobs_count = resolve_jobs_count(run_id) if run_id else -1
            run = Run(
                name=run.name,
                conclusion=run.conclusion,
                status=run.status,
                jobs=jobs_count,
            )
        if is_phantom(run):
            # Phantom — filter out; treat as success-equivalent for gating.
            greens.append((name, run))
        else:
            reds.append((name, run))
    return greens, missing, reds


# Cache for the lazy run-id lookup; keyed by workflow name + conclusion.
_RUN_ID_CACHE: dict[tuple[str, str], int | None] = {}


def _latest_run_id_for_workflow(name: str, run: Run) -> int | None:
    """Refetch the latest run id for a workflow whose top-of-list run is non-success."""
    key = (name, run.conclusion)
    if key in _RUN_ID_CACHE:
        return _RUN_ID_CACHE[key]
    cmd = [
        "gh",
        "run",
        "list",
        "--workflow",
        name,
        "--limit",
        "1",
        "--json",
        "databaseId",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        _RUN_ID_CACHE[key] = None
        return None
    data = json.loads(proc.stdout or "[]")
    if not data:
        _RUN_ID_CACHE[key] = None
        return None
    rid = int(data[0].get("databaseId", 0)) or None
    _RUN_ID_CACHE[key] = rid
    return rid


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        prog="ci_status",
        description="Assert the required-check set is green on a branch.",
    )
    p.add_argument(
        "--branch",
        default="main",
        help="Branch to check (default: main).",
    )
    p.add_argument(
        "--limit",
        type=int,
        default=30,
        help="Number of recent runs to scan (default: 30).",
    )
    p.add_argument(
        "--shape",
        choices=["feature", "release", "docs"],
        default="feature",
        help="PR shape (default: feature) — picks the required-check set.",
    )
    p.add_argument(
        "--strict",
        action="store_true",
        help="Exit non-zero if any required check is missing (not just red).",
    )
    p.add_argument(
        "--json",
        action="store_true",
        help="Emit JSON instead of human-readable text.",
    )
    p.add_argument(
        "--no-phantom-resolve",
        action="store_true",
        help="Skip the lazy 0-job lookup (faster but lets phantoms through).",
    )
    return p.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    required = REQUIRED_CHECKS_BY_SHAPE[args.shape]
    runs = fetch_runs(args.branch, args.limit)
    greens, missing, reds = compute_status(
        runs,
        required,
        resolve_jobs=not args.no_phantom_resolve,
    )

    if args.json:
        out = {
            "branch": args.branch,
            "shape": args.shape,
            "required": sorted(required),
            "green": [name for name, _ in greens],
            "missing": missing,
            "red": [{"name": name, "conclusion": run.conclusion} for name, run in reds],
        }
        print(json.dumps(out, indent=2))
    else:
        print(f"branch={args.branch} shape={args.shape} required={len(required)}")
        for name, _ in greens:
            print(f"  ✅  {name}")
        for name in missing:
            print(f"  ⚠️   {name} — no run found on this branch (last {args.limit})")
        for name, run in reds:
            print(f"  ❌  {name} — {run.conclusion}")

    if reds:
        return 1
    if args.strict and missing:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
