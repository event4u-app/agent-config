#!/usr/bin/env python3
"""Block D · D3 — audit_persona_coverage.

Build a citation matrix of personas across the SKILL.md corpus and flag
under-cited personas using **tier-aware thresholds** (council iter-1
D-OQ4 verdict):

  - **specialist** persona < 3 citations  → under-cited
  - **core**       persona < 5 citations  → under-cited

Inputs:
  --skills-dir DIR   — directory holding SKILL.md files
  --personas-dir DIR — directory holding persona Markdown files
  --json             — machine-readable output

Output: per-persona citation count + tier + status (ok / under-cited / orphan).
Exit code: 0 always (this is an advisory tool, not a CI gate).

Stdlib-only. ≤ 120 LOC. Embedded `_SAMPLE` for self-demo.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, List

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SKILLS = ROOT / ".agent-src.uncompressed" / "skills"
DEFAULT_PERSONAS = ROOT / ".agent-src.uncompressed" / "personas"
THRESHOLDS = {"core": 5, "specialist": 3}


def _read_block(path: Path) -> str:
    text = path.read_text(encoding="utf-8", errors="replace")
    if not text.startswith("---"):
        return ""
    end = text.find("\n---", 3)
    return text[3:end] if end != -1 else ""


def _frontmatter_value(block: str, key: str) -> str | None:
    m = re.search(rf"^{re.escape(key)}\s*:\s*(.+)$", block, re.MULTILINE)
    if not m:
        return None
    val = m.group(1).strip()
    if val.startswith('"') and val.endswith('"'):
        val = val[1:-1]
    return val


def _frontmatter_list(block: str, key: str) -> List[str]:
    m = re.search(rf"^{re.escape(key)}\s*:\s*$", block, re.MULTILINE)
    if not m:
        return []
    items: List[str] = []
    for line in block[m.end():].splitlines():
        if line.startswith("  - "):
            items.append(line[4:].strip())
        elif line and not line.startswith(" "):
            break
    return items


def _load_personas(personas_dir: Path) -> Dict[str, str]:
    """slug → tier (core | specialist | unknown)."""
    personas: Dict[str, str] = {}
    if not personas_dir.is_dir():
        return personas
    for md in sorted(personas_dir.glob("*.md")):
        if md.name.lower() == "readme.md":
            continue
        block = _read_block(md)
        slug = _frontmatter_value(block, "id") or md.stem
        tier = _frontmatter_value(block, "tier") or "unknown"
        personas[slug] = tier
    return personas


def _count_citations(skills_dir: Path) -> Dict[str, int]:
    counts: Dict[str, int] = {}
    if not skills_dir.is_dir():
        return counts
    for skill_md in skills_dir.glob("*/SKILL.md"):
        block = _read_block(skill_md)
        for slug in _frontmatter_list(block, "personas"):
            counts[slug] = counts.get(slug, 0) + 1
    return counts


def audit(skills_dir: Path, personas_dir: Path) -> List[Dict[str, object]]:
    personas = _load_personas(personas_dir)
    citations = _count_citations(skills_dir)
    rows: List[Dict[str, object]] = []
    for slug, tier in sorted(personas.items()):
        count = citations.get(slug, 0)
        threshold = THRESHOLDS.get(tier, 3)
        status = "under-cited" if count < threshold else "ok"
        rows.append({"persona": slug, "tier": tier, "citations": count,
                     "threshold": threshold, "status": status})
    # Surface citations that point at unknown personas (typos, deletions).
    for slug in sorted(citations.keys()):
        if slug not in personas:
            rows.append({"persona": slug, "tier": "unknown",
                         "citations": citations[slug], "threshold": 0,
                         "status": "orphan"})
    return rows


def _print_human(rows: List[Dict[str, object]]) -> None:
    if not rows:
        print("(no personas found)")
        return
    width = max(len(str(r["persona"])) for r in rows)
    print(f"  {'persona':<{width}}  tier        cites  status")
    print(f"  {'-' * width}  ----------  -----  -----------")
    for r in rows:
        print(f"  {str(r['persona']):<{width}}  {str(r['tier']):<10}  "
              f"{int(r['citations']):>5}  {r['status']}")
    flagged = [r for r in rows if r["status"] != "ok"]
    if flagged:
        print(f"\n  {len(flagged)} persona(s) flagged "
              f"(under-cited or orphan).")


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--skills-dir", default=str(DEFAULT_SKILLS))
    parser.add_argument("--personas-dir", default=str(DEFAULT_PERSONAS))
    parser.add_argument("--json", action="store_true",
                        help="emit JSON instead of text")
    args = parser.parse_args(argv)
    rows = audit(Path(args.skills_dir), Path(args.personas_dir))
    if args.json:
        json.dump({"rows": rows}, sys.stdout, indent=2)
        sys.stdout.write("\n")
    else:
        _print_human(rows)
    return 0


_SAMPLE = {"thresholds": THRESHOLDS}

if __name__ == "__main__":
    raise SystemExit(main())
