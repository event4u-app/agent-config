#!/usr/bin/env python3
"""Skill-count reduction measurement — step-12 Phase 3 L74 deliverable.

Computes the skill-count reduction achieved by filtering on
`recommended_for_user_types` frontmatter tags. Each non-developer
user-type that lands ≥40% under the default-loaded skill count
satisfies the Phase 3 acceptance criterion.

The runtime filter (loaded vs. registered) ships with step-9; this
script measures the data already in place, so the box can close on
the basis of the underlying tagging being correct.

Usage:
    python3 scripts/measure_skill_reduction.py
    python3 scripts/measure_skill_reduction.py --json
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

try:
    import yaml
except ImportError:
    sys.stderr.write("error: PyYAML required\n")
    sys.exit(2)

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = REPO_ROOT / ".agent-src.uncondensed" / "skills"
TARGET_REDUCTION = 0.40
PHASE_3_USER_TYPES = ("consultant", "creator")


def load_tags() -> tuple[int, dict[str, int]]:
    total = 0
    per_type: dict[str, int] = {}
    for skill_dir in sorted(SKILLS_DIR.iterdir()):
        skill_md = skill_dir / "SKILL.md"
        if not skill_md.is_file():
            continue
        text = skill_md.read_text(encoding="utf-8")
        if not text.startswith("---"):
            continue
        try:
            fm = yaml.safe_load(text.split("---", 2)[1]) or {}
        except yaml.YAMLError:
            continue
        total += 1
        for t in fm.get("recommended_for_user_types") or []:
            per_type[t] = per_type.get(t, 0) + 1
    return total, per_type


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)

    total, per_type = load_tags()
    if total == 0:
        sys.stderr.write("error: no skills found\n")
        return 2

    report = {
        "total_skills": total,
        "target_reduction": TARGET_REDUCTION,
        "per_user_type": {},
        "phase_3_user_types": list(PHASE_3_USER_TYPES),
        "phase_3_passed": True,
    }
    for ut in sorted(per_type):
        loaded = per_type[ut]
        reduction = 1 - (loaded / total)
        report["per_user_type"][ut] = {
            "loaded_skills": loaded,
            "reduction_pct": round(reduction, 4),
            "passes_target": reduction >= TARGET_REDUCTION,
        }
    for ut in PHASE_3_USER_TYPES:
        entry = report["per_user_type"].get(ut)
        if not entry or not entry["passes_target"]:
            report["phase_3_passed"] = False

    if args.json:
        print(json.dumps(report, indent=2))
    else:
        print(f"total_skills: {total}  target_reduction: ≥{TARGET_REDUCTION:.0%}")
        for ut, e in report["per_user_type"].items():
            mark = "✓" if e["passes_target"] else "✗"
            star = " *" if ut in PHASE_3_USER_TYPES else ""
            print(f"  {mark} {ut:12s} loaded={e['loaded_skills']:3d} "
                  f"reduction={e['reduction_pct']:.1%}{star}")
        print(f"verdict: {'PASS' if report['phase_3_passed'] else 'FAIL'}")
        print("(* = step-12 Phase 3 L74 anchor user-types)")
    return 0 if report["phase_3_passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
