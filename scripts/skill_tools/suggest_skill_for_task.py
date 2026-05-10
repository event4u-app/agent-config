#!/usr/bin/env python3
"""Block D · D4 — suggest_skill_for_task.

CLI wrapper that combines D2 (`score_skill_relevance`) with the persona
matrix from D3 (`audit_persona_coverage`) and emits the top-3 skill +
persona combos with a one-line justification each.

Inputs:
  --task TEXT        — task description (required)
  --skills-dir DIR   — SKILL.md directory
  --personas-dir DIR — persona Markdown directory
  --top N            — emit top-N combos (default: 3)
  --json             — machine-readable output

Output: ranked combos with `skill`, `score`, `personas[]`, and `why`.

Stdlib-only. ≤ 100 LOC. Embedded `_SAMPLE` for self-demo via `--sample`.
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

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_PERSONAS = ROOT / ".agent-src.uncompressed" / "personas"


def _persona_status(rows: List[Dict[str, object]]) -> Dict[str, str]:
    return {str(r["persona"]): str(r["status"]) for r in rows}


def _justify(name: str, score: int, personas: List[str],
             status: Dict[str, str]) -> str:
    if score >= 70:
        head = "high keyword + persona match"
    elif score >= 40:
        head = "strong keyword overlap"
    else:
        head = "partial overlap — confirm with reviewer"
    if personas:
        tier_hits = ", ".join(
            f"{p} ({status.get(p, 'unknown')})" for p in personas
        )
        return f"{head}; lenses: {tier_hits}"
    return f"{head}; no persona declared on `{name}`"


def suggest(task: str, skills_dir: Path, personas_dir: Path,
            top: int = 3) -> List[Dict[str, object]]:
    ranked = rank(task, skills_dir)[:top]
    persona_rows = audit(skills_dir, personas_dir)
    status = _persona_status(persona_rows)
    return [
        {
            "skill": name,
            "score": score,
            "personas": personas,
            "why": _justify(name, score, personas, status),
        }
        for name, score, personas in ranked
    ]


def _print_human(combos: List[Dict[str, object]]) -> None:
    if not combos:
        print("(no skill suggestions for this task)")
        return
    for i, c in enumerate(combos, 1):
        personas = ", ".join(c["personas"]) if c["personas"] else "—"  # type: ignore[arg-type]
        print(f"  {i}. {c['skill']}  ({c['score']}/100)")
        print(f"     personas: {personas}")
        print(f"     why: {c['why']}")


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--task", default="",
                        help="task description (required unless --sample)")
    parser.add_argument("--skills-dir", default=str(DEFAULT_SKILLS_DIR))
    parser.add_argument("--personas-dir", default=str(DEFAULT_PERSONAS))
    parser.add_argument("--top", type=int, default=3)
    parser.add_argument("--json", action="store_true",
                        help="emit JSON instead of text")
    parser.add_argument("--sample", action="store_true",
                        help="run against the embedded sample task")
    args = parser.parse_args(argv)
    task = _SAMPLE["task"] if args.sample else args.task
    if not task:
        parser.error("--task is required (or pass --sample)")
    combos = suggest(task, Path(args.skills_dir),
                     Path(args.personas_dir), args.top)
    if args.json:
        json.dump({"task": task, "suggestions": combos},
                  sys.stdout, indent=2)
        sys.stdout.write("\n")
    else:
        _print_human(combos)
    return 0


_SAMPLE = {"task": "review a livewire component for accessibility and reactive state"}

if __name__ == "__main__":
    raise SystemExit(main())
