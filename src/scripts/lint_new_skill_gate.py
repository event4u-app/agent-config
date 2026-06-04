#!/usr/bin/env python3
"""Forward gate for NEW skills (6.0.0-C Phase 4 Step 8b).

A newly added skill must clear two gates before it joins the surface:

  1. **Triggers stub** — `evals/triggers.json` with >= MIN_TRIGGER should-trigger
     AND >= MIN_TRIGGER should-not-trigger queries (per `skill-writing`).
  2. **Dedupe** — its body must not exceed DEDUPE_THRESHOLD content overlap with
     any EXISTING same-domain skill (shared `packs:`). A near-duplicate blocks
     the add and routes to the merge decision instead of growing the catalogue.

FORWARD-ONLY: only SKILL.md files **added** since `--baseline` (default `main`)
are gated. The back catalogue is grandfathered — Step 8's overlap report
(`audit_skill_overlap.py`) handles existing redundancy. Skill-side analogue of
the command budget + routing-eval gates.

Exit codes: 0 = clean, 1 = violations, 3 = internal error.

Usage:
    python3 scripts/lint_new_skill_gate.py
    python3 scripts/lint_new_skill_gate.py --baseline origin/main
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "src" / "scripts"))
from audit_skill_overlap import _parse, _cosine, collect, Skill  # noqa: E402

MIN_TRIGGER = 5
DEDUPE_THRESHOLD = 0.7


def _git(args: list[str]) -> str:
    try:
        r = subprocess.run(["git", *args], capture_output=True, text=True,
                           cwd=ROOT, timeout=15)
    except (FileNotFoundError, subprocess.TimeoutExpired) as exc:
        print(f"❌  git {' '.join(args)} failed: {exc}", file=sys.stderr)
        sys.exit(3)
    if r.returncode != 0:
        print(f"❌  git {' '.join(args)} exit {r.returncode}: {r.stderr}",
              file=sys.stderr)
        sys.exit(3)
    return r.stdout


def added_skill_files(baseline: str) -> list[str]:
    out: set[str] = set()
    for p in _git(["diff", "--name-only", "--diff-filter=A",
                   f"{baseline}...HEAD"]).splitlines():
        if p.strip().endswith("/SKILL.md"):
            out.add(p.strip())
    for line in _git(["status", "--porcelain", "-uall"]).splitlines():
        st, path = line[:2].strip(), line[3:].strip().split(" -> ")[-1]
        if path.endswith("/SKILL.md") and st in ("A", "??", "AM"):
            out.add(path)
    return sorted(out)


def check_triggers(skill_dir: Path) -> str | None:
    tj = skill_dir / "evals" / "triggers.json"
    if not tj.exists():
        return (f"missing `{tj.relative_to(ROOT)}` — a new skill needs a "
                f"triggers stub ({MIN_TRIGGER} should-trigger + {MIN_TRIGGER} "
                f"should-not-trigger queries; see skill-writing § 1c)")
    try:
        data = json.loads(tj.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        return f"triggers.json is invalid JSON: {exc}"
    queries = data.get("queries")
    if not isinstance(queries, list):
        return "triggers.json has no `queries` list"
    pos = sum(1 for q in queries if isinstance(q, dict) and q.get("trigger") is True)
    neg = sum(1 for q in queries if isinstance(q, dict) and q.get("trigger") is False)
    if pos < MIN_TRIGGER or neg < MIN_TRIGGER:
        return (f"triggers.json has {pos} should-trigger / {neg} "
                f"should-not-trigger — need >= {MIN_TRIGGER} of each")
    return None


def check_dedupe(new: Skill, existing: list[Skill]) -> str | None:
    for other in existing:
        if other.relpath == new.relpath:
            continue
        if not (new.packs & other.packs):
            continue  # different domain — not a dedupe target
        sim = _cosine(new.vector, other.vector)
        if sim >= DEDUPE_THRESHOLD:
            return (f"{sim:.0%} content overlap with existing same-domain skill "
                    f"`{other.name}` ({other.relpath}) — exceeds "
                    f"{DEDUPE_THRESHOLD:.0%}. Merge into it or extend it instead "
                    f"of adding a near-duplicate (evidence-based-pruning.md)")
    return None


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--baseline", default="main")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    added = added_skill_files(args.baseline)
    if not added:
        if not args.quiet:
            print(f"✅  No new skills added (baseline: {args.baseline}).")
        return 0

    added_set = set(added)
    all_skills = collect()
    existing = [s for s in all_skills if s.relpath not in added_set]

    violations: list[str] = []
    for relpath in added:
        skill_dir = (ROOT / relpath).parent
        if not skill_dir.exists():
            continue
        new = _parse(ROOT / relpath)
        if (msg := check_triggers(skill_dir)) is not None:
            violations.append(f"{relpath} — {msg}")
        if (msg := check_dedupe(new, existing)) is not None:
            violations.append(f"{relpath} — {msg}")

    if violations:
        print(f"❌  {len(violations)} new-skill gate violation(s):")
        for v in violations:
            print(f"  • {v}")
        print("\nSee docs/contracts/evidence-based-pruning.md and "
              "skill-writing § 1c.")
        return 1
    if not args.quiet:
        print(f"✅  {len(added)} new skill(s) cleared the triggers + dedupe gate "
              f"(baseline: {args.baseline}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
