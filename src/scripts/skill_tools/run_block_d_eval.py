#!/usr/bin/env python3
"""Block D · D5 — eval gate runner.

Runs D2 (`score_skill_relevance`), D3 (`audit_persona_coverage`), and
D4 (`suggest_skill_for_task`) against the corpora in
`agents/evidence/eval-corpora/block-d/` and emits a pass/fail summary per the
council verdict targets:

  - **D2**: ≥ 85 % of corpus tasks have an `expected_top3` skill in
    the actual top-3 ranking.
  - **D3**: ≥ 2 personas flagged as `under-cited`.
  - **D4**: ≥ 3 / 5 blind tasks where suggestion #1 matches the
    human-curated top-1.

Pilot pass = ≥ 2 / 3 tools pass. Anything less → kill switch.

Stdlib-only. Embedded `_SAMPLE` for self-demo.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Dict, List

from skill_tools.audit_persona_coverage import audit  # type: ignore
from skill_tools.score_skill_relevance import (  # type: ignore
    DEFAULT_SKILLS_DIR,
    rank,
)
from skill_tools.suggest_skill_for_task import suggest  # type: ignore

ROOT = Path(__file__).resolve().parents[3]
CORPUS_DIR = ROOT / "agents" / "eval-corpora" / "block-d"
PERSONAS_DIR = ROOT / ".agent-src.uncondensed" / "personas"


def _eval_d2(corpus: Path, skills_dir: Path) -> Dict[str, object]:
    data = json.loads(corpus.read_text(encoding="utf-8"))
    tasks = data["tasks"]
    hits, misses = 0, []
    for t in tasks:
        ranked = rank(t["task"], skills_dir)[:3]
        names = [n for n, _, _ in ranked]
        if any(e in names for e in t["expected_top3"]):
            hits += 1
        else:
            misses.append({"id": t["id"], "expected": t["expected_top3"],
                           "got": names})
    pct = hits / len(tasks) if tasks else 0.0
    return {"hits": hits, "total": len(tasks), "pct": round(pct, 3),
            "passed": pct >= 0.85, "misses": misses}


def _eval_d3(skills_dir: Path, personas_dir: Path) -> Dict[str, object]:
    rows = audit(skills_dir, personas_dir)
    flagged = [r["persona"] for r in rows if r["status"] == "under-cited"]
    return {"flagged": flagged, "count": len(flagged),
            "passed": len(flagged) >= 2}


def _eval_d4(corpus: Path, skills_dir: Path,
             personas_dir: Path) -> Dict[str, object]:
    data = json.loads(corpus.read_text(encoding="utf-8"))
    tasks = data["tasks"]
    hits, misses = 0, []
    for t in tasks:
        out = suggest(t["task"], skills_dir, personas_dir, top=1)
        got = out[0]["skill"] if out else None
        if got == t["expected_top1"]:
            hits += 1
        else:
            misses.append({"id": t["id"], "expected": t["expected_top1"],
                           "got": got})
    return {"hits": hits, "total": len(tasks),
            "passed": hits >= 3, "misses": misses}


def run_all(skills_dir: Path, personas_dir: Path,
            corpus_dir: Path) -> Dict[str, object]:
    d2 = _eval_d2(corpus_dir / "d2-tasks.json", skills_dir)
    d3 = _eval_d3(skills_dir, personas_dir)
    d4 = _eval_d4(corpus_dir / "d4-tasks.json", skills_dir, personas_dir)
    passes = sum(1 for r in (d2, d3, d4) if r["passed"])
    return {"D2": d2, "D3": d3, "D4": d4,
            "tools_passed": passes,
            "pilot_passed": passes >= 2}


def _print_human(report: Dict[str, object]) -> None:
    icons = {True: "✅", False: "❌"}
    for key in ("D2", "D3", "D4"):
        r: Dict[str, object] = report[key]  # type: ignore[assignment]
        print(f"  {icons[bool(r['passed'])]}  {key}: {_summary(key, r)}")
    overall = bool(report["pilot_passed"])
    print(f"\n  pilot: {report['tools_passed']}/3 tools passed → "
          f"{'PASS' if overall else 'FAIL'}")


def _summary(key: str, r: Dict[str, object]) -> str:
    if key == "D2":
        return f"{r['hits']}/{r['total']} ({float(r['pct']) * 100:.0f}%) ≥ 85% target"
    if key == "D3":
        return f"{r['count']} under-cited personas (≥ 2 target)"
    return f"{r['hits']}/{r['total']} top-1 hits (≥ 3/5 target)"


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--skills-dir", default=str(DEFAULT_SKILLS_DIR))
    parser.add_argument("--personas-dir", default=str(PERSONAS_DIR))
    parser.add_argument("--corpus-dir", default=str(CORPUS_DIR))
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args(argv)
    report = run_all(Path(args.skills_dir), Path(args.personas_dir),
                     Path(args.corpus_dir))
    if args.json:
        json.dump(report, sys.stdout, indent=2)
        sys.stdout.write("\n")
    else:
        _print_human(report)
    return 0 if report["pilot_passed"] else 1


_SAMPLE = {"corpus_dir": str(CORPUS_DIR)}

if __name__ == "__main__":
    raise SystemExit(main())
