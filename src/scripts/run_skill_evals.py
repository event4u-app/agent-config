#!/usr/bin/env python3
"""Quantitative skill-eval orchestrator (skill-writing § 7).

Scaffolds, aggregates, and reports sub-agent eval runs for a skill.

Sub-agent SPAWNING is per-environment (Claude Code, Augment Code,
council) and is left as a stub `_spawn_subagent(...)` that authors
implement once for their environment. The rest of the loop —
scaffold / aggregate / report — works out of the box and reads /
writes JSON files in `runs/`.

Layout per skill:

    .agent-src.uncondensed/skills/{name}/evals/
        evals.json
        runs/                              # gitignored
            {timestamp}-baseline/{scenario_id}/output.txt
            {timestamp}-baseline/{scenario_id}/grade.json
            {timestamp}-with-skill/{scenario_id}/output.txt
            {timestamp}-with-skill/{scenario_id}/grade.json
            {timestamp}-benchmark.json
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SKILLS_ROOT = REPO_ROOT / ".agent-src.uncondensed" / "skills"


def _skill_dir(skill: str) -> Path:
    p = SKILLS_ROOT / skill
    if not p.is_dir():
        sys.exit(f"error: skill {skill!r} not found at {p}")
    return p


def _evals_dir(skill: str) -> Path:
    return _skill_dir(skill) / "evals"


def _load_evals(skill: str) -> dict[str, Any]:
    f = _evals_dir(skill) / "evals.json"
    if not f.exists():
        sys.exit(f"error: {f} not found — create it before scaffolding")
    return json.loads(f.read_text(encoding="utf-8"))


def _timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _spawn_subagent(prompt: str, *, load_skill: str | None) -> dict[str, Any]:
    """STUB — implement per environment.

    Must return {"output": str, "elapsed_s": float, "tokens_in": int,
    "tokens_out": int}. When load_skill is None, run baseline; when
    set, load that skill into the sub-agent's context.
    """
    raise NotImplementedError(
        "implement _spawn_subagent for this environment (Claude Code, "
        "Augment, council, ...) — see docstring contract"
    )


def _grade_assertions(output: str, run_dir: Path, assertions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for a in assertions:
        kind = a.get("kind")
        if kind == "contains":
            ok = a["value"] in output
            results.append({"kind": kind, "value": a["value"], "pass": ok})
        elif kind == "file_exists":
            ok = (run_dir / a["path"]).exists() or Path(a["path"]).exists()
            results.append({"kind": kind, "path": a["path"], "pass": ok})
        elif kind == "rubric":
            results.append({"kind": kind, "criterion": a["criterion"], "pass": None,
                            "note": "rubric grading requires sub-agent — fill in manually or via grader"})
        else:
            results.append({"kind": kind, "pass": False, "note": f"unknown assertion kind {kind!r}"})
    return results


def cmd_scaffold(skill: str) -> int:
    spec = _load_evals(skill)
    scenarios = spec.get("scenarios", [])
    if not scenarios:
        sys.exit("error: evals.json has no scenarios")
    ts = _timestamp()
    runs = _evals_dir(skill) / "runs"
    for arm in ("baseline", "with-skill"):
        for sc in scenarios:
            d = runs / f"{ts}-{arm}" / sc["id"]
            d.mkdir(parents=True, exist_ok=True)
            (d / "meta.json").write_text(json.dumps({
                "skill": skill, "arm": arm, "scenario_id": sc["id"],
                "prompt": sc["prompt"], "assertions": sc.get("assertions", []),
                "timestamp": ts,
            }, indent=2) + "\n", encoding="utf-8")
    print(f"scaffolded {len(scenarios)} scenarios × 2 arms at runs/{ts}-{{baseline,with-skill}}/")
    print(f"timestamp: {ts}")
    return 0


def cmd_aggregate(skill: str, run: str) -> int:
    runs = _evals_dir(skill) / "runs"
    spec = _load_evals(skill)
    bench: dict[str, Any] = {"skill": skill, "run": run, "generated_at": _timestamp(), "scenarios": []}
    totals = {"baseline_pass": 0, "with_skill_pass": 0, "scenarios": 0}
    for sc in spec.get("scenarios", []):
        row: dict[str, Any] = {"id": sc["id"], "arms": {}}
        for arm in ("baseline", "with-skill"):
            run_dir = runs / f"{run}-{arm}" / sc["id"]
            grade_f = run_dir / "grade.json"
            if not grade_f.exists():
                row["arms"][arm] = {"status": "missing", "pass_count": 0, "total": 0}
                continue
            g = json.loads(grade_f.read_text(encoding="utf-8"))
            results = g.get("results", [])
            passed = sum(1 for r in results if r.get("pass") is True)
            row["arms"][arm] = {"status": "graded", "pass_count": passed, "total": len(results),
                                 "elapsed_s": g.get("elapsed_s"), "tokens_in": g.get("tokens_in"),
                                 "tokens_out": g.get("tokens_out")}
            if arm == "baseline" and passed == len(results) and results:
                totals["baseline_pass"] += 1
            if arm == "with-skill" and passed == len(results) and results:
                totals["with_skill_pass"] += 1
        bench["scenarios"].append(row)
        totals["scenarios"] += 1
    bench["totals"] = totals
    out = runs / f"{run}-benchmark.json"
    out.write_text(json.dumps(bench, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out.relative_to(REPO_ROOT)}")
    print(f"  baseline pass: {totals['baseline_pass']}/{totals['scenarios']}")
    print(f"  with-skill pass: {totals['with_skill_pass']}/{totals['scenarios']}")
    return 0


def cmd_report(skill: str, run: str) -> int:
    bench_f = _evals_dir(skill) / "runs" / f"{run}-benchmark.json"
    if not bench_f.exists():
        sys.exit(f"error: {bench_f} not found — run aggregate first")
    bench = json.loads(bench_f.read_text(encoding="utf-8"))
    print(f"# Skill eval report — {skill} @ {run}\n")
    print("| Scenario | Baseline | With skill | Δ tokens_out | Δ elapsed_s |")
    print("|---|---|---|---|---|")
    for sc in bench["scenarios"]:
        b = sc["arms"].get("baseline", {})
        w = sc["arms"].get("with-skill", {})
        bp = f"{b.get('pass_count', 0)}/{b.get('total', 0)}"
        wp = f"{w.get('pass_count', 0)}/{w.get('total', 0)}"
        dt = (w.get("tokens_out") or 0) - (b.get("tokens_out") or 0)
        de = (w.get("elapsed_s") or 0) - (b.get("elapsed_s") or 0)
        print(f"| {sc['id']} | {bp} | {wp} | {dt:+d} | {de:+.2f} |")
    t = bench["totals"]
    print(f"\n**Totals:** baseline {t['baseline_pass']}/{t['scenarios']} · with-skill {t['with_skill_pass']}/{t['scenarios']}")
    return 0


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = p.add_subparsers(dest="cmd", required=True)
    for name in ("scaffold", "aggregate", "report"):
        sp = sub.add_parser(name)
        sp.add_argument("skill")
        if name != "scaffold":
            sp.add_argument("--run", required=True, help="run timestamp (from scaffold output)")
    args = p.parse_args()
    if args.cmd == "scaffold":
        return cmd_scaffold(args.skill)
    if args.cmd == "aggregate":
        return cmd_aggregate(args.skill, args.run)
    if args.cmd == "report":
        return cmd_report(args.skill, args.run)
    return 1


if __name__ == "__main__":
    sys.exit(main())
