#!/usr/bin/env python3
"""Generate ``CAPABILITIES.yaml`` — the package's capability-coverage index.

Road-to-capability-discoverability Phase 2. The "what this package already
covers" surface: capability area → coverage band → backing skills/commands →
named gaps. **Generated, never hand-maintained** — drift-checked in CI via
``--check`` like ``generate_capability_matrix.py`` / ``generate_ownership_matrix.py``.

Why it exists: external-LLM reviews kept re-proposing surfaces the package
already ships because coverage was invisible. This index is the single
machine-readable answer to "does agent-config do X?" — an LLM (or human) reads
it before proposing a gap.

Derivation (all source-of-truth, stable across ``task sync``):
  - Capability areas  = ``src/config/discovery/packs.yml`` (in-use packs only:
    a pack carrying a ``domain`` key is in use per the packs.yml contract;
    reserved vocabulary ids without ``domain`` are skipped).
  - Backing skills    = ``src/skills/*/SKILL.md`` frontmatter ``packs:``.
  - Backing commands  = ``iter_commands()`` frontmatter ``pack:`` (owner) +
    ``packs:`` (discovery tags).

Coverage band (mechanical, from backing-artefact count):
  none (0) · thin (1-2) · moderate (3-6) · strong (7+).
A "gap" is an in-use capability area with band ``none``.

Kill-switches (roadmap Phase 2):
  - Generation > 5 s  → abort non-zero (blocks CI; the index must stay cheap).
  - Output  > 50 KB   → abort non-zero (defeats discoverability — split/summarize).

Output is deterministic (sorted, no timestamp) so ``--check`` is stable.

Usage:
    python3 src/scripts/generate_capabilities_index.py
    python3 src/scripts/generate_capabilities_index.py --check   # fail if stale
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import agent_src  # noqa: E402
from validate_frontmatter import parse_frontmatter  # noqa: E402

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "CAPABILITIES.yaml"
PACKS_YML = ROOT / "src" / "config" / "discovery" / "packs.yml"
SKILLS_DIR = ROOT / "src" / "skills"

TIME_BUDGET_S = 5.0
SIZE_BUDGET_BYTES = 50 * 1024


def _coverage_band(count: int) -> str:
    if count == 0:
        return "none"
    if count <= 2:
        return "thin"
    if count <= 6:
        return "moderate"
    return "strong"


def _load_packs() -> list[dict]:
    """In-use capability packs (those carrying a ``domain`` key), as dicts."""
    raw = yaml.safe_load(PACKS_YML.read_text(encoding="utf-8")) or []
    return [p for p in raw if isinstance(p, dict) and p.get("domain")]


def _skill_packs() -> dict[str, list[str]]:
    """pack id → sorted skill names backing it."""
    by_pack: dict[str, list[str]] = {}
    for skill_md in sorted(SKILLS_DIR.glob("*/SKILL.md")):
        fm, _ = parse_frontmatter(skill_md.read_text(encoding="utf-8"))
        if not fm:
            continue
        name = fm.get("name") or skill_md.parent.name
        for pid in fm.get("packs") or []:
            by_pack.setdefault(pid, []).append(name)
    return {k: sorted(set(v)) for k, v in by_pack.items()}


def _command_packs() -> dict[str, list[str]]:
    """pack id → sorted command names backing it (owner ``pack:`` + ``packs:``)."""
    by_pack: dict[str, list[str]] = {}
    for cmd_md in agent_src.iter_commands():
        fm, _ = parse_frontmatter(cmd_md.read_text(encoding="utf-8"))
        if not fm:
            continue
        name = fm.get("name") or cmd_md.parent.name
        pids = set(fm.get("packs") or [])
        if fm.get("pack"):
            pids.add(fm["pack"])
        for pid in pids:
            by_pack.setdefault(pid, []).append(name)
    return {k: sorted(set(v)) for k, v in by_pack.items()}


def _scalar(value: str) -> str:
    """JSON-encode a string scalar — valid YAML, no quoting/escaping bugs."""
    return json.dumps(value, ensure_ascii=False)


def _flow_list(items: list[str]) -> str:
    if not items:
        return "[]"
    return "[" + ", ".join(_scalar(i) for i in items) + "]"


def build() -> str:
    packs = _load_packs()
    skill_map = _skill_packs()
    cmd_map = _command_packs()

    skills_total = len({s for names in skill_map.values() for s in names})
    commands_total = len({c for names in cmd_map.values() for c in names})

    # domain → list of area records (sorted by pack id within domain).
    by_domain: dict[str, list[dict]] = {}
    gaps: list[dict] = []
    for pack in packs:
        pid = pack["id"]
        skills = skill_map.get(pid, [])
        commands = cmd_map.get(pid, [])
        band = _coverage_band(len(skills) + len(commands))
        domain = pack["domain"]
        record = {
            "id": pid,
            "label": pack.get("label", pid),
            "description": pack.get("description", ""),
            "size_class": pack.get("size_class", ""),
            "coverage": band,
            "skills": skills,
            "commands": commands,
        }
        by_domain.setdefault(domain, []).append(record)
        if band == "none":
            gaps.append({"id": pid, "label": record["label"], "domain": domain})

    lines: list[str] = []
    lines.append("# CAPABILITIES.yaml — what agent-config already covers")
    lines.append("#")
    lines.append("# GENERATED by src/scripts/generate_capabilities_index.py — do NOT hand-edit.")
    lines.append("# Drift-checked in CI (`--check`). Regenerate after adding/removing a")
    lines.append("# skill, command, or capability pack.")
    lines.append("#")
    lines.append("# Read this BEFORE proposing a new capability: an area listed below with")
    lines.append("# `coverage: moderate|strong` is already shipped. `gaps:` names the in-use")
    lines.append("# areas with zero backing skills/commands.")
    lines.append("")
    lines.append("meta:")
    lines.append("  generated_by: src/scripts/generate_capabilities_index.py")
    lines.append(
        "  purpose: " + _scalar(
            "Machine-readable coverage index so external reviews stop "
            "re-proposing what already ships."
        )
    )
    lines.append(f"  skills_total: {skills_total}")
    lines.append(f"  commands_total: {commands_total}")
    lines.append(f"  capability_areas: {len(packs)}")
    lines.append(f"  gaps: {len(gaps)}")
    lines.append("  coverage_bands: " + _scalar("none(0) thin(1-2) moderate(3-6) strong(7+)"))
    lines.append("")
    lines.append("capability_areas:")
    for domain in sorted(by_domain):
        lines.append(f"  {domain}:")
        for rec in sorted(by_domain[domain], key=lambda r: r["id"]):
            lines.append(f"    - id: {rec['id']}")
            lines.append(f"      label: {_scalar(rec['label'])}")
            lines.append(f"      description: {_scalar(rec['description'])}")
            lines.append(f"      size_class: {_scalar(rec['size_class'])}")
            lines.append(f"      coverage: {rec['coverage']}")
            lines.append(f"      skill_count: {len(rec['skills'])}")
            lines.append(f"      command_count: {len(rec['commands'])}")
            lines.append(f"      skills: {_flow_list(rec['skills'])}")
            lines.append(f"      commands: {_flow_list(rec['commands'])}")
    lines.append("")
    lines.append("gaps:")
    if gaps:
        for gap in sorted(gaps, key=lambda g: g["id"]):
            lines.append(f"  - id: {gap['id']}")
            lines.append(f"    label: {_scalar(gap['label'])}")
            lines.append(f"    domain: {gap['domain']}")
            lines.append(
                "    reason: " + _scalar(
                    "in-use capability area with 0 backing skills or commands"
                )
            )
    else:
        lines.append("  []  # every in-use capability area has at least one backing artefact")
    return "\n".join(lines) + "\n"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--check",
        action="store_true",
        help="exit non-zero if CAPABILITIES.yaml is out of date (CI mode)",
    )
    args = parser.parse_args()

    start = time.monotonic()
    content = build()
    elapsed = time.monotonic() - start

    # Kill-switch: generation latency.
    if elapsed > TIME_BUDGET_S:
        print(
            f"❌  capabilities index generation took {elapsed:.1f}s "
            f"(> {TIME_BUDGET_S:.0f}s budget) — investigate before it blocks CI.",
            file=sys.stderr,
        )
        return 1

    # Kill-switch: output size.
    size = len(content.encode("utf-8"))
    if size > SIZE_BUDGET_BYTES:
        print(
            f"❌  CAPABILITIES.yaml is {size // 1024} KB "
            f"(> {SIZE_BUDGET_BYTES // 1024} KB budget) — split or summarize; "
            "an oversized index defeats discoverability.",
            file=sys.stderr,
        )
        return 1

    if args.check:
        on_disk = OUT.read_text(encoding="utf-8") if OUT.exists() else ""
        if on_disk != content:
            print(
                "❌  CAPABILITIES.yaml is stale — run "
                "`python3 src/scripts/generate_capabilities_index.py`",
                file=sys.stderr,
            )
            return 1
        print(f"✅  CAPABILITIES.yaml up to date ({size // 1024} KB, {elapsed * 1000:.0f}ms).")
        return 0

    OUT.write_text(content, encoding="utf-8")
    print(
        f"✅  Wrote CAPABILITIES.yaml — {size // 1024} KB, {elapsed * 1000:.0f}ms · "
        f"{len(_load_packs())} areas."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
