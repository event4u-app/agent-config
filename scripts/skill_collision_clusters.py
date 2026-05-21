#!/usr/bin/env python3
"""Skill-collision cluster analysis (Phase 2.2 of step-1-v2-feedback-followup).

Walks `.agent-src.uncompressed/skills/<id>/SKILL.md`, extracts the
`description` frontmatter, computes pairwise keyword overlap, and groups
high-overlap skill pairs into clusters. The output drives the
selection-accuracy fixture set defined by council file 05 (Round-3
protocol — ≥ 3 shared significant terms → collision cluster).

Output: `agents/runtime/reports/skill-collision-clusters.json`

Schema:
    {
      "skill_count": int,
      "cluster_count": int,
      "clusters": [
        {
          "cluster_id": "C01",
          "members": ["skill-a", "skill-b", ...],
          "shared_keywords": [...],
          "max_overlap": float,
          "descriptions": {"skill-a": "...", ...}
        },
        ...
      ]
    }
"""

from __future__ import annotations

import json
import re
import sys
from itertools import combinations
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = REPO_ROOT / ".agent-src.uncompressed" / "skills"
OUT_JSON = REPO_ROOT / "agents" / "reports" / "skill-collision-clusters.json"

KEYWORD_OVERLAP_THRESHOLD = 0.40
MIN_SHARED_KEYWORDS = 3
TOP_N_CLUSTERS = 10

STOPWORDS = {
    "the", "and", "for", "with", "when", "use", "or", "of", "to", "a",
    "an", "is", "in", "on", "by", "be", "at", "as", "it", "if", "are",
    "this", "that", "from", "but", "not", "can", "any", "all", "no",
    "after", "before", "during", "user", "agent", "code", "project",
    "via", "into", "onto", "even", "without", "naming", "uses", "used",
    "using", "also", "etc", "across", "between", "review", "design",
    "writing", "create", "creating", "edit", "editing", "make", "making",
    "set", "setting", "based", "well", "right", "left", "new",
}


def keyword_set(text: str) -> set[str]:
    tokens = re.findall(r"[A-Za-z][A-Za-z0-9_-]{2,}", text.lower())
    return {t for t in tokens if t not in STOPWORDS and not t.isdigit()}


def overlap_fraction(a: set[str], b: set[str]) -> float:
    if not a or not b:
        return 0.0
    return len(a & b) / min(len(a), len(b))


def load_skills() -> list[dict]:
    skills = []
    for skill_md in sorted(SKILLS_DIR.glob("*/SKILL.md")):
        text = skill_md.read_text()
        if not text.startswith("---"):
            continue
        parts = text.split("---", 2)
        if len(parts) < 3:
            continue
        try:
            fm = yaml.safe_load(parts[1]) or {}
        except yaml.YAMLError:
            continue
        name = fm.get("name") or skill_md.parent.name
        description = (fm.get("description") or "").strip()
        if not description:
            continue
        skills.append(
            {
                "name": name,
                "description": description,
                "_keywords": keyword_set(description),
            }
        )
    return skills


def build_clusters(skills: list[dict]) -> list[dict]:
    # Pairwise edges where overlap & shared-keyword threshold is met.
    edges: list[tuple[str, str, set[str], float]] = []
    by_name = {s["name"]: s for s in skills}
    for a, b in combinations(skills, 2):
        shared = a["_keywords"] & b["_keywords"]
        ov = overlap_fraction(a["_keywords"], b["_keywords"])
        if len(shared) >= MIN_SHARED_KEYWORDS and ov >= KEYWORD_OVERLAP_THRESHOLD:
            edges.append((a["name"], b["name"], shared, ov))

    # Union-find over edge set → connected-component clusters.
    parent: dict[str, str] = {}

    def find(x: str) -> str:
        parent.setdefault(x, x)
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(x: str, y: str) -> None:
        rx, ry = find(x), find(y)
        if rx != ry:
            parent[rx] = ry

    for a, b, _, _ in edges:
        union(a, b)

    components: dict[str, list[str]] = {}
    for name in {n for edge in edges for n in edge[:2]}:
        components.setdefault(find(name), []).append(name)

    clusters: list[dict] = []
    for idx, (_, members) in enumerate(sorted(components.items(), key=lambda kv: -len(kv[1])), start=1):
        member_kws = [by_name[m]["_keywords"] for m in members]
        shared_all = set.intersection(*member_kws) if member_kws else set()
        member_edges = [(a, b, sk, ov) for a, b, sk, ov in edges if a in members and b in members]
        max_ov = max((ov for *_, ov in member_edges), default=0.0)
        clusters.append({
            "cluster_id": f"C{idx:02d}",
            "members": sorted(members),
            "shared_keywords": sorted(shared_all),
            "max_overlap": round(max_ov, 3),
            "descriptions": {m: by_name[m]["description"] for m in sorted(members)},
        })
    return clusters[:TOP_N_CLUSTERS]


def main() -> int:
    if not SKILLS_DIR.exists():
        print(f"❌  Skills dir not found: {SKILLS_DIR}", file=sys.stderr)
        return 2
    skills = load_skills()
    clusters = build_clusters(skills)
    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps({
        "skill_count": len(skills),
        "cluster_count": len(clusters),
        "clusters": clusters,
    }, indent=2) + "\n")
    print(f"✅  Wrote {OUT_JSON.relative_to(REPO_ROOT)} — {len(clusters)} clusters from {len(skills)} skills")
    return 0


if __name__ == "__main__":
    sys.exit(main())
