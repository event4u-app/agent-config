#!/usr/bin/env python3
"""Block D · D2 — score_skill_relevance.

Rank skills by relevance to a free-form task description.

Heuristic (council iter-1 D-OQ1 verdict (b) — discovery-story tool 1):

  score = keyword_overlap * 70 + persona_match * 30

where:
  - keyword_overlap = |task_terms ∩ skill_terms| / |task_terms|
    (skill_terms = tokens from `name` + `description`)
  - persona_match  = 1.0 if any persona on the skill is named or
    role-mentioned in the task, else 0.0

Inputs:
  --task TEXT      — task description (required)
  --skills-dir DIR — directory holding SKILL.md files (default: package skills)
  --top N          — emit only top-N ranked skills (default: all non-zero)
  --json           — machine-readable ranked output

Output: ranked list with integer scores 0–100, descending. Ties break on name.

Stdlib-only. ≤ 180 LOC. Embedded `_SAMPLE` for self-demo (`python3 -m … --json`).
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Dict, Iterable, List, Tuple

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SKILLS_DIR = ROOT / ".agent-src.uncompressed" / "skills"
TOKEN_RE = re.compile(r"[a-z][a-z0-9]+")
STOPWORDS = frozenset({
    "the", "a", "an", "and", "or", "but", "of", "for", "with", "to", "in",
    "on", "at", "by", "from", "as", "is", "are", "was", "were", "be", "been",
    "this", "that", "these", "those", "it", "its", "use", "when", "even",
    "via", "via:", "into", "onto", "use:", "skill", "skills", "task", "tasks",
    "code", "file", "files", "doing", "make", "do", "go", "get", "set",
    "not", "no", "yes", "any", "some", "all", "one", "two", "new", "old",
    "user", "users", "our", "your", "their", "they", "we", "you", "i", "me",
})


def _tokenize(text: str) -> set:
    return {t for t in TOKEN_RE.findall(text.lower()) if t not in STOPWORDS and len(t) > 2}


def _parse_frontmatter(path: Path) -> Dict[str, object]:
    """Minimal YAML-frontmatter reader (stdlib-only). Returns {} on parse miss."""
    text = path.read_text(encoding="utf-8", errors="replace")
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    if end == -1:
        return {}
    block = text[3:end]
    out: Dict[str, object] = {}
    current_list_key: str | None = None
    for raw in block.splitlines():
        line = raw.rstrip()
        if not line or line.startswith("#"):
            continue
        if current_list_key and line.startswith("  - "):
            out.setdefault(current_list_key, []).append(line[4:].strip())  # type: ignore[union-attr]
            continue
        current_list_key = None
        m = re.match(r"^([a-zA-Z_][\w-]*)\s*:\s*(.*)$", line)
        if not m:
            continue
        key, val = m.group(1), m.group(2).strip()
        if val == "":
            current_list_key = key
            continue
        if val.startswith('"') and val.endswith('"'):
            val = val[1:-1]
        out[key] = val
    return out


def _load_skills(skills_dir: Path) -> List[Dict[str, object]]:
    skills: List[Dict[str, object]] = []
    for skill_md in sorted(skills_dir.glob("*/SKILL.md")):
        fm = _parse_frontmatter(skill_md)
        name = str(fm.get("name") or skill_md.parent.name)
        desc = str(fm.get("description") or "")
        personas = fm.get("personas") or []
        if isinstance(personas, str):
            personas = [personas]
        skills.append({
            "name": name,
            "description": desc,
            "personas": list(personas),
            "terms": _tokenize(name + " " + desc),
        })
    return skills


def _score(task_terms: set, skill: Dict[str, object]) -> int:
    if not task_terms:
        return 0
    skill_terms = skill["terms"]  # type: ignore[index]
    overlap = len(task_terms & skill_terms) / max(len(task_terms), 1)  # type: ignore[arg-type]
    persona_hit = 0.0
    task_lower = " ".join(task_terms)
    for persona in skill["personas"]:  # type: ignore[union-attr]
        slug = str(persona).lower()
        if slug in task_lower or any(part in task_terms for part in slug.split("-")):  # type: ignore[operator]
            persona_hit = 1.0
            break
    return round(overlap * 70 + persona_hit * 30)


def rank(task: str, skills_dir: Path) -> List[Tuple[str, int, List[str]]]:
    task_terms = _tokenize(task)
    skills = _load_skills(skills_dir)
    rows: List[Tuple[str, int, List[str]]] = []
    for s in skills:
        score = _score(task_terms, s)
        if score > 0:
            rows.append((str(s["name"]), score, list(s["personas"])))  # type: ignore[arg-type]
    rows.sort(key=lambda r: (-r[1], r[0]))
    return rows


def _print_human(rows: Iterable[Tuple[str, int, List[str]]], top: int | None) -> None:
    rows = list(rows)
    if top:
        rows = rows[:top]
    if not rows:
        print("(no relevant skills found)")
        return
    width = max(len(r[0]) for r in rows)
    for name, score, personas in rows:
        persona_str = ", ".join(personas) if personas else "—"
        print(f"  {score:3d}  {name:<{width}}  {persona_str}")


def main(argv: List[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    parser.add_argument("--task", required=False, default="",
                        help="task description (required unless --sample is used)")
    parser.add_argument("--skills-dir", default=str(DEFAULT_SKILLS_DIR),
                        help="directory holding SKILL.md files")
    parser.add_argument("--top", type=int, default=0, help="emit only top-N rows")
    parser.add_argument("--json", action="store_true", help="emit JSON instead of text")
    parser.add_argument("--sample", action="store_true", help="run against the embedded sample task")
    args = parser.parse_args(argv)
    task = _SAMPLE["task"] if args.sample else args.task
    if not task:
        parser.error("--task is required (or pass --sample)")
    rows = rank(task, Path(args.skills_dir))
    if args.json:
        payload = [{"name": n, "score": s, "personas": p} for n, s, p in (rows[:args.top] if args.top else rows)]
        json.dump({"task": task, "ranked": payload}, sys.stdout, indent=2)
        sys.stdout.write("\n")
    else:
        _print_human(rows, args.top or None)
    return 0


_SAMPLE = {"task": "build a livewire component for the user dashboard with reactive state"}

if __name__ == "__main__":
    raise SystemExit(main())
