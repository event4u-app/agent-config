#!/usr/bin/env python3
"""Bench runner for the eval corpora — step-4 measurement-and-benchmark Phase 1.

Deterministic, no-API skill-selection baseline. For each prompt in a
corpus YAML, ranks the 210 skills in `.agent-src.uncondensed/skills/`
by keyword overlap between the prompt text and each skill's
`description` frontmatter field. Reports selection accuracy as
`top-K contains >= 1 expected_skill`.

This is a baseline retrieval — not the production router. The
production router uses semantic embeddings; this runner pins a
reproducible floor so accuracy regressions in skill descriptions are
catchable in CI.

Usage:
    python3 scripts/bench_runner.py --corpus non-dev
    python3 scripts/bench_runner.py --corpus non-dev --top-k 3 --json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Iterable

try:
    import yaml
except ImportError:
    sys.stderr.write("error: PyYAML required (pip install pyyaml)\n")
    sys.exit(2)

REPO_ROOT = Path(__file__).resolve().parent.parent
SKILLS_DIR = REPO_ROOT / ".agent-src.uncondensed" / "skills"
CORPUS_DIR = REPO_ROOT / "tests" / "eval"

STOPWORDS = frozenset({
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from",
    "has", "have", "in", "into", "is", "it", "its", "of", "on", "or",
    "that", "the", "this", "to", "via", "with", "your", "you", "use",
    "when", "what", "which", "who", "how", "why", "be", "do", "i",
    "we", "they", "them", "their", "our", "ours", "but", "not", "no",
    "yes", "all", "any", "some", "more", "less", "than", "then",
})


def tokenize(text: str) -> set[str]:
    tokens = re.findall(r"[a-z][a-z0-9\-]+", text.lower())
    return {t for t in tokens if t not in STOPWORDS and len(t) > 2}


def load_skill_descriptions() -> dict[str, str]:
    """Return {skill_name: description_text} for every skill on disk."""
    skills: dict[str, str] = {}
    for skill_dir in sorted(SKILLS_DIR.iterdir()):
        skill_md = skill_dir / "SKILL.md"
        if not skill_md.is_file():
            continue
        text = skill_md.read_text(encoding="utf-8")
        m = re.search(r"^---\s*\n(.*?)\n---\s*\n", text, re.DOTALL)
        if not m:
            continue
        try:
            fm = yaml.safe_load(m.group(1)) or {}
        except yaml.YAMLError:
            continue
        desc = fm.get("description", "")
        name = fm.get("name") or skill_dir.name
        if desc:
            skills[name] = f"{name} {desc}"
    return skills


def rank_skills(prompt: str, skills: dict[str, str], top_k: int) -> list[str]:
    """Rank skills by keyword overlap with the prompt; return top-K names."""
    prompt_tokens = tokenize(prompt)
    if not prompt_tokens:
        return []
    scores: list[tuple[float, str]] = []
    for name, desc in skills.items():
        desc_tokens = tokenize(desc)
        if not desc_tokens:
            continue
        overlap = prompt_tokens & desc_tokens
        if not overlap:
            continue
        # Jaccard with a small IDF-shaped boost for rare matches.
        union = prompt_tokens | desc_tokens
        score = len(overlap) / len(union)
        scores.append((score, name))
    scores.sort(reverse=True)
    return [name for _, name in scores[:top_k]]


def run_corpus(corpus_path: Path, top_k: int) -> dict:
    corpus = yaml.safe_load(corpus_path.read_text(encoding="utf-8"))
    skills = load_skill_descriptions()
    results = []
    hits = 0
    for p in corpus["prompts"]:
        ranked = rank_skills(p["prompt"], skills, top_k)
        expected = set(p.get("expected_skills", []))
        hit = bool(expected & set(ranked))
        if hit:
            hits += 1
        results.append({
            "id": p["id"],
            "category": p.get("category", ""),
            "expected_skills": sorted(expected),
            "top_k_ranked": ranked,
            "hit": hit,
        })
    n = len(results)
    accuracy = hits / n if n else 0.0
    return {
        "corpus_id": corpus["corpus_id"],
        "target": corpus.get("selection_accuracy_target", 0.60),
        "top_k": top_k,
        "prompts_total": n,
        "prompts_hit": hits,
        "selection_accuracy": round(accuracy, 4),
        "passed": accuracy >= corpus.get("selection_accuracy_target", 0.60),
        "per_prompt": results,
    }


def main(argv: Iterable[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--corpus", default="non-dev", help="corpus id (non-dev | dev)")
    ap.add_argument("--top-k", type=int, default=3, help="top-K window for hit-check")
    ap.add_argument("--json", action="store_true", help="emit JSON only")
    args = ap.parse_args(list(argv) if argv is not None else None)

    corpus_path = CORPUS_DIR / f"corpus-{args.corpus}.yaml"
    if not corpus_path.is_file():
        sys.stderr.write(f"error: corpus not found: {corpus_path}\n")
        return 2

    summary = run_corpus(corpus_path, args.top_k)

    if args.json:
        print(json.dumps(summary, indent=2))
    else:
        print(f"corpus: {summary['corpus_id']}  target={summary['target']}  top-k={summary['top_k']}")
        print(f"prompts: {summary['prompts_hit']} / {summary['prompts_total']} hit")
        print(f"selection_accuracy: {summary['selection_accuracy']:.2%}")
        print(f"verdict: {'PASS' if summary['passed'] else 'FAIL'}")
        for r in summary["per_prompt"]:
            mark = "✓" if r["hit"] else "✗"
            print(f"  {mark} {r['id']:14s} expected={r['expected_skills']} got={r['top_k_ranked'][:3]}")

    return 0 if summary["passed"] else 1


if __name__ == "__main__":
    sys.exit(main())
