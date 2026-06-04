#!/usr/bin/env python3
"""Trigger-overlap analysis for the Rule-Governance pass (Phase 5.2 of
road-to-augment-limit-fit).

Reads `agents/runtime/reports/auto-rules-audit.json` (produced by
`audit_auto_rules.py`) and computes:

- path-prefix Jaccard similarity (per pair of rules);
- description-keyword overlap fraction (per pair of rules).

Pairs scoring `path_jaccard >= 0.5` OR `keyword_overlap >= 0.4` are
flagged as merge candidates. Output is appended to
`agents/runtime/reports/auto-rules-audit.md` and a structured JSON list is
written to `agents/runtime/reports/auto-rules-overlap.json` for downstream
consumers (Phase 5.3 likelihood, 5.4 council walk).
"""

from __future__ import annotations

import json
import re
import sys
from itertools import combinations
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
REPORT_DIR = REPO_ROOT / "agents" / "reports"
AUDIT_JSON = REPORT_DIR / "auto-rules-audit.json"
AUDIT_MD = REPORT_DIR / "auto-rules-audit.md"
OVERLAP_JSON = REPORT_DIR / "auto-rules-overlap.json"

PATH_THRESHOLD = 0.5
KEYWORD_THRESHOLD = 0.4

STOPWORDS = {
    "the", "and", "for", "with", "when", "use", "or", "of", "to", "a",
    "an", "is", "in", "on", "by", "be", "at", "as", "it", "if", "are",
    "this", "that", "from", "but", "not", "can", "any", "all", "no",
    "after", "before", "during", "user", "agent", "code", "project",
    "via", "into", "onto", "even", "without", "naming",
}


def keyword_set(text: str) -> set[str]:
    tokens = re.findall(r"[A-Za-z][A-Za-z0-9_-]{2,}", text.lower())
    return {t for t in tokens if t not in STOPWORDS and not t.isdigit()}


def jaccard(a: set, b: set) -> float:
    if not a and not b:
        return 0.0
    return len(a & b) / len(a | b)


def overlap_fraction(a: set, b: set) -> float:
    """Symmetric overlap as fraction of smaller set."""
    if not a or not b:
        return 0.0
    return len(a & b) / min(len(a), len(b))


def analyse(rules: list[dict]) -> list[dict]:
    pairs: list[dict] = []
    for r in rules:
        r["_paths"] = set(r["triggers"]["path_prefixes"])
        r["_keywords"] = (
            keyword_set(r["description"])
            | keyword_set(" ".join(r["triggers"]["keywords"]))
            | keyword_set(" ".join(r["triggers"]["intents"]))
        )

    for a, b in combinations(rules, 2):
        pj = jaccard(a["_paths"], b["_paths"])
        ko = overlap_fraction(a["_keywords"], b["_keywords"])
        flagged = pj >= PATH_THRESHOLD or ko >= KEYWORD_THRESHOLD
        if not flagged:
            continue
        pairs.append(
            {
                "rule_a": a["name"],
                "rule_b": b["name"],
                "path_jaccard": round(pj, 3),
                "keyword_overlap": round(ko, 3),
                "shared_paths": sorted(a["_paths"] & b["_paths"]),
                "shared_keywords": sorted(a["_keywords"] & b["_keywords"])[:12],
                "rule_a_desc": a["description"],
                "rule_b_desc": b["description"],
            }
        )

    return sorted(
        pairs, key=lambda p: -(p["path_jaccard"] + p["keyword_overlap"])
    )


def render_md(pairs: list[dict]) -> str:
    lines = [
        "",
        "## Phase 5.2 — Trigger overlap (Jaccard + keyword)",
        "",
        f"Pairs flagged: **{len(pairs)}** "
        f"(thresholds: path-Jaccard ≥ {PATH_THRESHOLD}, "
        f"keyword-overlap ≥ {KEYWORD_THRESHOLD}).",
        "",
    ]
    if not pairs:
        lines.append("_No pairs over threshold._")
        lines.append("")
        return "\n".join(lines)
    lines += [
        "| # | Rule A | Rule B | Path-J | Keyword-O | Shared keywords |",
        "|---|--------|--------|--------|-----------|-----------------|",
    ]
    for i, p in enumerate(pairs, 1):
        kw = ", ".join(f"`{k}`" for k in p["shared_keywords"][:6]) or "—"
        lines.append(
            f"| {i} | `{p['rule_a']}` | `{p['rule_b']}` | "
            f"{p['path_jaccard']:.2f} | {p['keyword_overlap']:.2f} | {kw} |"
        )
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    if not AUDIT_JSON.exists():
        print(f"❌  Run audit_auto_rules.py first: missing {AUDIT_JSON}", file=sys.stderr)
        return 1
    data = json.loads(AUDIT_JSON.read_text(encoding="utf-8"))
    pairs = analyse(data["rules"])
    OVERLAP_JSON.write_text(
        json.dumps({"pair_count": len(pairs), "pairs": pairs}, indent=2),
        encoding="utf-8",
    )
    md_existing = AUDIT_MD.read_text(encoding="utf-8") if AUDIT_MD.exists() else ""
    if "## Phase 5.2 — Trigger overlap" in md_existing:
        md_existing = md_existing.split("## Phase 5.2 — Trigger overlap")[0].rstrip() + "\n"
    AUDIT_MD.write_text(md_existing + render_md(pairs), encoding="utf-8")
    print(f"✅  Overlap analysis: {len(pairs)} pairs flagged.")
    print(f"   JSON: {OVERLAP_JSON.relative_to(REPO_ROOT)}")
    print(f"   MD appended: {AUDIT_MD.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
