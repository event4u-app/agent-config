#!/usr/bin/env python3
"""Skill-family content-overlap analysis (6.0.0-C Phase 4 Step 8).

Walks every ``SKILL.md`` across the package skill roots, builds a keyword
vector from the body (frontmatter stripped), and flags pairs whose
content cosine-similarity is >= OVERLAP_THRESHOLD. Each pair is annotated
with whether the two skills share a domain (their ``packs:`` sets intersect)
— the same-domain >70%-overlap pairs are the merge candidates the
evidence-based-pruning contract consumes.

Content similarity, NOT name prefix: `api-design` and `api-testing` are only
flagged if their *bodies* overlap, not because they share the `api-` prefix.

THIS SCRIPT MERGES NOTHING. It produces a candidate report for a future,
human-driven consolidation roadmap (docs/contracts/evidence-based-pruning.md).

Output:
  - agents/reports/skill-overlap.json (machine-readable)
  - agents/reports/skill-overlap.md  (human-readable)

Usage:
  python3 scripts/audit_skill_overlap.py
  python3 scripts/audit_skill_overlap.py --threshold 0.7 --quiet
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from collections import Counter
from dataclasses import dataclass, field
from itertools import combinations
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
REPORT_DIR = ROOT / "agents" / "reports"
OUT_JSON = REPORT_DIR / "skill-overlap.json"
OUT_MD = REPORT_DIR / "skill-overlap.md"
FM_RE = re.compile(r"^---\n(.*?)\n---", re.DOTALL)
OVERLAP_THRESHOLD = 0.7  # evidence-based-pruning.md: >70% content overlap

STOPWORDS = {
    "the", "and", "for", "with", "when", "use", "or", "of", "to", "a", "an",
    "is", "in", "on", "by", "be", "at", "as", "it", "if", "are", "this",
    "that", "from", "but", "not", "can", "any", "all", "no", "after",
    "before", "during", "user", "agent", "code", "project", "via", "into",
    "onto", "even", "without", "naming", "run", "runs", "running", "each",
    "every", "one", "two", "now", "then", "also", "based", "default", "skill",
    "you", "your", "should", "must", "see", "do", "not",
}


@dataclass
class Skill:
    name: str
    relpath: str
    packs: set[str] = field(default_factory=set)
    vector: Counter = field(default_factory=Counter)


def _skill_roots() -> list[Path]:
    pkgs = ROOT / "packages"
    roots = [d for d in pkgs.glob("*/.agent-src.uncondensed/skills")
             if d.is_dir()] if pkgs.is_dir() else []
    legacy = ROOT / ".agent-src.uncondensed" / "skills"
    if not roots and legacy.is_dir():
        roots = [legacy]
    return roots


def _keyword_vector(text: str) -> Counter:
    tokens = re.findall(r"[a-z][a-z0-9_-]{2,}", text.lower())
    return Counter(t for t in tokens if t not in STOPWORDS)


def _cosine(a: Counter, b: Counter) -> float:
    shared = set(a) & set(b)
    if not shared:
        return 0.0
    num = sum(a[t] * b[t] for t in shared)
    da = math.sqrt(sum(v * v for v in a.values()))
    db = math.sqrt(sum(v * v for v in b.values()))
    return num / (da * db) if da and db else 0.0


def _parse(md: Path) -> Skill:
    import yaml
    text = md.read_text(encoding="utf-8")
    fm: dict = {}
    body = text
    m = FM_RE.search(text)
    if m:
        try:
            fm = yaml.safe_load(m.group(1)) or {}
        except yaml.YAMLError:
            fm = {}
        body = text[m.end():]
    name = fm.get("name") if isinstance(fm, dict) else None
    packs = fm.get("packs") if isinstance(fm, dict) else None
    return Skill(
        name=str(name) if name else md.parent.name,
        relpath=str(md.relative_to(ROOT)),
        packs=set(packs) if isinstance(packs, list) else set(),
        vector=_keyword_vector(body),
    )


def collect() -> list[Skill]:
    skills: list[Skill] = []
    seen: set[str] = set()
    for root in _skill_roots():
        for md in sorted(root.rglob("SKILL.md")):
            if "_archive" in md.parts:
                continue
            key = md.parent.name
            if key in seen:
                continue
            seen.add(key)
            skills.append(_parse(md))
    return skills


def find_pairs(skills: list[Skill], threshold: float) -> list[dict]:
    pairs: list[dict] = []
    for a, b in combinations(skills, 2):
        sim = _cosine(a.vector, b.vector)
        if sim >= threshold:
            shared = sorted(a.packs & b.packs)
            pairs.append({
                "a": a.name, "b": b.name,
                "a_path": a.relpath, "b_path": b.relpath,
                "similarity": round(sim, 3),
                "same_domain": bool(shared),
                "shared_packs": shared,
            })
    pairs.sort(key=lambda p: (not p["same_domain"], -p["similarity"]))
    return pairs


def render_md(skills: list[Skill], pairs: list[dict], threshold: float) -> str:
    merge = [p for p in pairs if p["same_domain"]]
    cross = [p for p in pairs if not p["same_domain"]]
    L = [
        "# Skill-family overlap report (6.0.0-C Phase 4 Step 8)\n",
        f"> Content cosine-similarity over {len(skills)} skills; pairs at "
        f"≥ {threshold:.0%}. **Same-domain pairs (shared `packs:`) are the "
        f"merge candidates** consumed by "
        f"[`evidence-based-pruning.md`](../../docs/contracts/evidence-based-pruning.md). "
        f"This report merges NOTHING — it is input to a future, human-driven "
        f"consolidation roadmap.\n",
        f"\n- Skills scanned: **{len(skills)}**",
        f"\n- Overlap pairs ≥ {threshold:.0%}: **{len(pairs)}** "
        f"({len(merge)} same-domain merge candidates, {len(cross)} cross-domain)\n",
        "\n## Merge candidates — same-domain, ≥ threshold\n",
    ]
    if not merge:
        L.append("None — no same-domain pair exceeds the overlap threshold.\n")
    else:
        L.append("| Skill A | Skill B | similarity | shared packs |")
        L.append("|---|---|--:|---|")
        for p in merge:
            L.append(f"| `{p['a']}` | `{p['b']}` | {p['similarity']:.0%} | "
                     f"{', '.join(p['shared_packs'])} |")
    L.append("\n## Cross-domain overlaps (informational, not merge candidates)\n")
    if not cross:
        L.append("None.\n")
    else:
        L.append("| Skill A | Skill B | similarity |")
        L.append("|---|---|--:|")
        for p in cross:
            L.append(f"| `{p['a']}` | `{p['b']}` | {p['similarity']:.0%} |")
    return "\n".join(L) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--threshold", type=float, default=OVERLAP_THRESHOLD)
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    skills = collect()
    if not skills:
        print("❌  No skills found under the package skill roots.", file=sys.stderr)
        return 3
    pairs = find_pairs(skills, args.threshold)
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps({
        "threshold": args.threshold,
        "skills_scanned": len(skills),
        "pairs": pairs,
    }, indent=2), encoding="utf-8")
    OUT_MD.write_text(render_md(skills, pairs, args.threshold), encoding="utf-8")

    if not args.quiet:
        merge = sum(1 for p in pairs if p["same_domain"])
        print(f"✅  Skill overlap: {len(skills)} skills, {len(pairs)} pair(s) "
              f"≥ {args.threshold:.0%} ({merge} same-domain merge candidate(s)).")
        print(f"   JSON: {OUT_JSON.relative_to(ROOT)}")
        print(f"   MD:   {OUT_MD.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
