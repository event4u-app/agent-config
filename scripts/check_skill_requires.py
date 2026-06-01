#!/usr/bin/env python3
"""Skill-composition graph gate (roadmap 3.4).

Validates the `requires_skills:` frontmatter field (the skill→skill
composition graph) against two invariants:

1. **Referential integrity** — every `requires_skills` target names a real
   skill in the suite.
2. **Co-availability** — whenever a parent skill ships, every sub-skill its
   body assumes must ship too. A sub-skill is co-available under a parent's
   pack `P` iff one of the sub-skill's packs is in `{P}` ∪ the transitive
   `requires_hint` closure of `P` (from `config/discovery/packs.yml`), or
   the sub-skill is always-on (no pack). A parent with no pack (always-on)
   may only require always-on sub-skills.

This is distinct from the ADR-015 artefact→pack `requires` field; this gate
operates on `requires_skills` (skill→skill) only.

Exit 0 = clean · 1 = at least one violation.
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent / "_lib"))

import yaml  # noqa: E402

from _lib.agent_src import ROOT, iter_artefacts  # noqa: E402
from validate_frontmatter import parse_frontmatter  # noqa: E402

PACKS_YML = ROOT / "config" / "discovery" / "packs.yml"


def _load_pack_closure() -> dict[str, set[str]]:
    """pack_id → transitive set of {self} ∪ requires_hint closure."""
    raw = yaml.safe_load(PACKS_YML.read_text(encoding="utf-8")) or []
    direct: dict[str, set[str]] = {}
    for entry in raw:
        pid = entry["id"]
        direct[pid] = set(entry.get("requires_hint") or [])

    closure: dict[str, set[str]] = {}

    def resolve(pid: str, seen: set[str]) -> set[str]:
        if pid in closure:
            return closure[pid]
        acc = {pid}
        for dep in direct.get(pid, set()):
            if dep in seen:
                continue
            acc |= resolve(dep, seen | {pid})
        closure[pid] = acc
        return acc

    for pid in direct:
        resolve(pid, set())
    return closure


def _collect_skills() -> dict[str, dict]:
    """skill_id (directory name) → {packs: set[str], requires_skills: list[str], path}."""
    skills: dict[str, dict] = {}
    for path in iter_artefacts("SKILL.md"):
        # logical id = the skill's directory name
        skill_id = path.parent.name
        fm, _ = parse_frontmatter(path.read_text(encoding="utf-8"))
        if fm is None:
            continue
        skills[skill_id] = {
            "packs": set(fm.get("packs") or []),
            "requires_skills": list(fm.get("requires_skills") or []),
            "path": path.relative_to(ROOT).as_posix(),
        }
    return skills


def main() -> int:
    closure = _load_pack_closure()
    skills = _collect_skills()
    errors: list[str] = []

    for skill_id, info in sorted(skills.items()):
        reqs = info["requires_skills"]
        if not reqs:
            continue
        parent_packs: set[str] = info["packs"]
        for req in reqs:
            target = skills.get(req)
            # (1) referential integrity
            if target is None:
                errors.append(
                    f"{info['path']}: requires_skills → unknown skill '{req}' "
                    f"(no skills/{req}/SKILL.md in the suite)."
                )
                continue
            # (2) co-availability
            req_packs: set[str] = target["packs"]
            if not req_packs:
                # always-on sub-skill is reachable from anywhere
                continue
            if not parent_packs:
                # always-on parent may only require an always-on sub-skill
                errors.append(
                    f"{info['path']}: always-on skill '{skill_id}' requires "
                    f"'{req}' which is pack-gated ({sorted(req_packs)}); a base "
                    f"install would ship '{skill_id}' without '{req}'."
                )
                continue
            for p in sorted(parent_packs):
                reachable = closure.get(p, {p})
                if req_packs & reachable:
                    continue
                hint = sorted(req_packs - reachable)
                errors.append(
                    f"{info['path']}: skill '{skill_id}' (pack '{p}') requires "
                    f"'{req}' (pack {sorted(req_packs)}), but '{p}' does not reach "
                    f"it. Add requires_hint: {hint} to pack '{p}' in "
                    f"config/discovery/packs.yml, or move '{req}' into a reachable pack."
                )

    if errors:
        print("❌  check_skill_requires: skill-composition graph has unmet edges:")
        for e in errors:
            print(f"  🔴 {e}")
        print(
            "\nEvery sub-skill a parent's body invokes must ship wherever the "
            "parent ships. Declare the missing pack dependency or co-locate the skill."
        )
        return 1

    n_edges = sum(len(i["requires_skills"]) for i in skills.values())
    print(
        f"✅  check_skill_requires: {n_edges} composition edge(s) across "
        f"{sum(1 for i in skills.values() if i['requires_skills'])} skill(s) — all sub-skills co-available."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
