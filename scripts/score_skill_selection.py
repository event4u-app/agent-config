#!/usr/bin/env python3
"""Selection-accuracy scorer (council file 05, Phase 2.2).

Reads `tests/fixtures/skill_selection/fixtures.yml` and a predictions
JSON (`{fixture_id: selected_skill_name}`), then computes:

- (a) intended-skill hit rate — exact `intended` match
- (b) correct-cluster hit rate — any member of the same cluster

Per-cluster pass/fail uses the Round-3 protocol:
    pass = (a) >= 0.90  OR  (b) >= 0.95
    fail = (a) <  0.80  AND  (b) <  0.80   →  cluster needs `routes_to`

Predictions source:
- `--predictions <path>`: external JSON file (LLM run, eval harness, manual).
- `--baseline`: built-in TF-IDF-style description-similarity baseline. The
  baseline does NOT speak for any specific host tool; it estimates what
  pure description-matching would do and provides a numeric floor.

Output: human-readable summary on stdout + machine JSON to
`agents/reports/skill-selection-accuracy.json` (or `--out`).
"""

from __future__ import annotations

import argparse
import json
import math
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import yaml

REPO_ROOT = Path(__file__).resolve().parent.parent
FIXTURES = REPO_ROOT / "tests" / "fixtures" / "skill_selection" / "fixtures.yml"
CLUSTERS = REPO_ROOT / "agents" / "reports" / "skill-collision-clusters.json"
SKILLS_DIR = REPO_ROOT / ".agent-src.uncompressed" / "skills"
DEFAULT_OUT = REPO_ROOT / "agents" / "reports" / "skill-selection-accuracy.json"

PASS_A = 0.90
PASS_B = 0.95
FAIL_THRESHOLD = 0.80

STOPWORDS = {
    "the", "and", "for", "with", "when", "use", "or", "of", "to", "a", "an",
    "is", "in", "on", "by", "be", "at", "as", "it", "if", "are", "this",
    "that", "from", "but", "not", "can", "any", "all", "no", "after",
    "before", "during", "user", "agent", "code", "project", "via", "into",
    "onto", "even", "without", "naming", "uses", "used", "using", "also",
    "etc", "across", "between",
}


def tokenize(text: str) -> list[str]:
    tokens = re.findall(r"[A-Za-z][A-Za-z0-9_-]{2,}", text.lower())
    return [t for t in tokens if t not in STOPWORDS and not t.isdigit()]


def load_skills() -> dict[str, str]:
    out = {}
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
        desc = (fm.get("description") or "").strip()
        if desc:
            out[name] = desc
    return out


def tfidf_vectors(docs: dict[str, str]) -> tuple[dict[str, dict[str, float]], dict[str, float]]:
    n_docs = len(docs)
    df: Counter[str] = Counter()
    tokenized = {k: tokenize(v) for k, v in docs.items()}
    for toks in tokenized.values():
        for term in set(toks):
            df[term] += 1
    idf = {term: math.log((n_docs + 1) / (count + 1)) + 1 for term, count in df.items()}
    vectors: dict[str, dict[str, float]] = {}
    for name, toks in tokenized.items():
        tf = Counter(toks)
        vectors[name] = {term: tf[term] * idf.get(term, 0.0) for term in tf}
    return vectors, idf


def cosine(a: dict[str, float], b: dict[str, float]) -> float:
    if not a or not b:
        return 0.0
    common = set(a) & set(b)
    dot = sum(a[t] * b[t] for t in common)
    na = math.sqrt(sum(v * v for v in a.values()))
    nb = math.sqrt(sum(v * v for v in b.values()))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def baseline_predict(fixtures: list[dict], skills: dict[str, str]) -> dict[str, str]:
    vectors, idf = tfidf_vectors(skills)
    preds: dict[str, str] = {}
    for fx in fixtures:
        prompt_tokens = tokenize(fx["prompt"])
        tf = Counter(prompt_tokens)
        pv = {term: tf[term] * idf.get(term, 0.0) for term in tf}
        best_name, best_score = "", -1.0
        for name, vec in vectors.items():
            score = cosine(pv, vec)
            if score > best_score:
                best_name, best_score = name, score
        preds[fx["id"]] = best_name
    return preds


def score(fixtures: list[dict], clusters: list[dict], preds: dict[str, str]) -> dict:
    # Look up cluster membership by intended-skill (robust to cluster_id renumbering).
    by_member: dict[str, set[str]] = {}
    for c in clusters:
        members = set(c["members"])
        for m in members:
            by_member[m] = members
    per_cluster = defaultdict(lambda: {"total": 0, "hits_a": 0, "hits_b": 0, "misses": [], "label": ""})
    for fx in fixtures:
        intended = fx["intended"]
        members = by_member.get(intended, {intended})
        # Stable label: sorted members joined — survives cluster_id renumbering.
        cid = fx.get("cluster") or "+".join(sorted(members)[:2])
        pred = preds.get(fx["id"], "")
        rec = per_cluster[cid]
        rec["total"] += 1
        rec["label"] = ",".join(sorted(members))
        if pred == intended:
            rec["hits_a"] += 1
        if pred in members:
            rec["hits_b"] += 1
        else:
            rec["misses"].append({"id": fx["id"], "intended": intended, "predicted": pred})
    results = []
    for cid, rec in sorted(per_cluster.items()):
        a = rec["hits_a"] / rec["total"]
        b = rec["hits_b"] / rec["total"]
        if a >= PASS_A or b >= PASS_B:
            verdict = "pass"
        elif a < FAIL_THRESHOLD and b < FAIL_THRESHOLD:
            verdict = "fail-needs-routes_to"
        else:
            verdict = "mixed"
        results.append({"cluster": cid, "n": rec["total"], "hit_a": round(a, 3),
                        "hit_b": round(b, 3), "verdict": verdict, "misses": rec["misses"]})
    total = sum(r["n"] for r in results)
    overall_a = sum(r["hit_a"] * r["n"] for r in results) / total if total else 0.0
    overall_b = sum(r["hit_b"] * r["n"] for r in results) / total if total else 0.0
    return {"clusters": results,
            "overall": {"n": total, "hit_a": round(overall_a, 3), "hit_b": round(overall_b, 3)}}


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--predictions", type=Path, help="JSON file: {fixture_id: skill_name}")
    p.add_argument("--baseline", action="store_true", help="Use built-in TF-IDF baseline")
    p.add_argument("--source", default="external", help="Label recorded in output")
    p.add_argument("--out", type=Path, default=DEFAULT_OUT)
    args = p.parse_args()

    if not args.predictions and not args.baseline:
        print("❌  Specify --predictions <file> or --baseline", file=sys.stderr)
        return 2
    fixtures = yaml.safe_load(FIXTURES.read_text())["fixtures"]
    clusters = json.loads(CLUSTERS.read_text())["clusters"]
    skills = load_skills()
    if args.baseline:
        preds = baseline_predict(fixtures, skills)
        source = "tfidf-baseline"
    else:
        preds = json.loads(args.predictions.read_text())
        source = args.source
    report = score(fixtures, clusters, preds)
    report["source"] = source
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, indent=2) + "\n")
    print(f"✅  Wrote {args.out.relative_to(REPO_ROOT)}  (source={source})")
    print(f"   overall: hit_a={report['overall']['hit_a']:.3f}  hit_b={report['overall']['hit_b']:.3f}  n={report['overall']['n']}")
    for c in report["clusters"]:
        print(f"   {c['cluster']:6}  n={c['n']:2}  hit_a={c['hit_a']:.2f}  hit_b={c['hit_b']:.2f}  {c['verdict']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
