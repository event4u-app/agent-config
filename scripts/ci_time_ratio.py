#!/usr/bin/env python3
"""CI-time / local-edit-time ratio (council file 07, Phase 2.3).

Samples the last N commits on a branch, classifies each by touched
paths (doc / skill / test / meta / mixed), and computes:

    ratio = ci_time / local_time

where:
- `local_time` = delta between author-date of the *previous* commit and
  author-date of the current commit, capped at 60 min to filter breaks.
- `ci_time`  = sum of GitHub Actions workflow durations for that commit
  sha (via `gh run list --commit <sha>`).

Threshold rule (Round-3 Sonnet protocol):
- Median ratio > 5× for any frequent class → that class needs a cheaper tier
- Median ratio < 3× across all classes      → structural overhead acceptable

Output: human-readable table on stdout + JSON to
`agents/runtime/reports/ci-time-ratio.json`.

Usage:
    python3 scripts/ci_time_ratio.py --limit 30
    python3 scripts/ci_time_ratio.py --branch main --limit 30 --out path.json
"""

from __future__ import annotations

import argparse
import json
import statistics
import subprocess
import sys
from collections import defaultdict
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_OUT = REPO_ROOT / "agents" / "reports" / "ci-time-ratio.json"

LOCAL_TIME_CAP_S = 60 * 60          # cap a single edit window at 60 min
THRESHOLD_FAIL = 5.0
THRESHOLD_PASS = 3.0


def run(cmd: list[str]) -> str:
    return subprocess.check_output(cmd, cwd=REPO_ROOT, text=True)


def list_commits(branch: str, limit: int) -> list[dict]:
    out = run(["git", "log", branch, f"-n{limit + 1}",
               "--format=%H\t%at\t%s"]).strip().splitlines()
    rows = []
    for line in out:
        sha, ts, subject = line.split("\t", 2)
        rows.append({"sha": sha, "timestamp": int(ts), "subject": subject})
    return rows


def classify(sha: str) -> str:
    files = run(["git", "show", "--name-only", "--format=", sha]).strip().splitlines()
    files = [f for f in files if f]
    if not files:
        return "empty"
    doc = sum(1 for f in files if f.startswith("docs/") or f.endswith(".md"))
    skill = sum(1 for f in files if "/skills/" in f or f.startswith(".agent-src.uncondensed/skills/"))
    test = sum(1 for f in files if f.startswith("tests/") or "/tests/" in f)
    meta = sum(1 for f in files if f.startswith(("Taskfile", "scripts/", ".github/", "pyproject", "package")))
    total = len(files)
    # Single-class dominance: 70% of touched files in one bucket
    for label, n in [("skill", skill), ("test", test), ("doc", doc), ("meta", meta)]:
        if n >= max(1, int(total * 0.7)):
            return label
    return "mixed"


def ci_duration_for(sha: str) -> int | None:
    """Total wall-clock seconds for all completed runs of this commit."""
    try:
        out = run(["gh", "run", "list", "--commit", sha, "--limit", "20",
                   "--json", "createdAt,updatedAt,status,conclusion"])
    except subprocess.CalledProcessError:
        return None
    runs = json.loads(out)
    if not runs:
        return None
    durations = []
    for r in runs:
        if r.get("status") != "completed":
            continue
        from datetime import datetime
        c = datetime.fromisoformat(r["createdAt"].replace("Z", "+00:00"))
        u = datetime.fromisoformat(r["updatedAt"].replace("Z", "+00:00"))
        durations.append((u - c).total_seconds())
    if not durations:
        return None
    # Workflows run in parallel — wall-clock is the max, not the sum.
    return int(max(durations))


def collect(branch: str, limit: int) -> list[dict]:
    commits = list_commits(branch, limit)
    if len(commits) < 2:
        return []
    rows = []
    for i in range(len(commits) - 1):
        cur, prev = commits[i], commits[i + 1]
        local_s = min(cur["timestamp"] - prev["timestamp"], LOCAL_TIME_CAP_S)
        if local_s < 30:
            continue
        ci_s = ci_duration_for(cur["sha"])
        if ci_s is None:
            continue
        cls = classify(cur["sha"])
        rows.append({
            "sha": cur["sha"][:10], "class": cls,
            "local_s": local_s, "ci_s": ci_s,
            "ratio": round(ci_s / local_s, 2) if local_s else None,
            "subject": cur["subject"][:80],
        })
    return rows


def summarise(rows: list[dict]) -> dict:
    by_class: dict[str, list[float]] = defaultdict(list)
    for r in rows:
        if r["ratio"] is not None:
            by_class[r["class"]].append(r["ratio"])
    summary = {}
    for cls, ratios in sorted(by_class.items()):
        m = statistics.median(ratios)
        if m > THRESHOLD_FAIL:
            verdict = "optimise"
        elif m < THRESHOLD_PASS:
            verdict = "acceptable"
        else:
            verdict = "watch"
        summary[cls] = {"n": len(ratios), "median": round(m, 2),
                        "min": round(min(ratios), 2), "max": round(max(ratios), 2),
                        "verdict": verdict}
    all_ratios = [r["ratio"] for r in rows if r["ratio"] is not None]
    overall = {"n": len(all_ratios),
               "median": round(statistics.median(all_ratios), 2) if all_ratios else None,
               "verdict": ("acceptable" if all_ratios and statistics.median(all_ratios) < THRESHOLD_PASS
                          else "needs-review" if all_ratios else "no-data")}
    return {"overall": overall, "by_class": summary}


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--branch", default="HEAD")
    p.add_argument("--limit", type=int, default=30)
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = p.parse_args()
    rows = collect(args.branch, args.limit)
    report = summarise(rows)
    report["sample"] = rows
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2) + "\n")
    print(f"✅  Wrote {args.out.relative_to(REPO_ROOT)}  (n={report['overall']['n']})")
    ov = report["overall"]
    print(f"   overall median ratio: {ov['median']}×  →  {ov['verdict']}")
    for cls, s in report["by_class"].items():
        print(f"   {cls:7}  n={s['n']:2}  median={s['median']:.2f}×  range=[{s['min']}–{s['max']}]  {s['verdict']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
