#!/usr/bin/env python3
"""Activation-likelihood heuristic for the Rule-Governance pass
(Phase 5.3 of road-to-augment-limit-fit).

For every auto-rule from `agents/runtime/reports/auto-rules-audit.json`:

1. Build a token set from `description`, `triggers[].keyword`,
   `triggers[].intent`, and the rule name itself.
2. Index a corpus of skills (`SKILL.md`), contexts
   (`agents/settings/contexts/**/*.md`), guidelines, and command files.
3. Score `corpus_hits = sum(1 for token in tokens if token in corpus)`.
4. Flag rules with `< 2` corpus hits as "low-likelihood" (their trigger
   surface is so generic that the host LLM is unlikely to find a
   project-local file the rule was written to bridge to).

Result is a JSON dump + Markdown section appended to
`agents/runtime/reports/auto-rules-audit.md`.
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
REPORT_DIR = REPO_ROOT / "agents" / "reports"
AUDIT_JSON = REPORT_DIR / "auto-rules-audit.json"
AUDIT_MD = REPORT_DIR / "auto-rules-audit.md"
LIKELIHOOD_JSON = REPORT_DIR / "auto-rules-likelihood.json"

CORPUS_GLOBS = [
    ".agent-src.uncondensed/skills/**/SKILL.md",
    ".agent-src.uncondensed/commands/**/*.md",
    "agents/settings/contexts/**/*.md",
    "docs/guidelines/**/*.md",
]

LOW_LIKELIHOOD_HITS = 2

STOPWORDS = {
    "the", "and", "for", "with", "when", "use", "or", "of", "to", "a",
    "an", "is", "in", "on", "by", "be", "at", "as", "it", "if", "are",
    "this", "that", "from", "but", "not", "can", "any", "all", "no",
    "after", "before", "during", "user", "agent", "code", "project",
    "via", "into", "onto", "even", "without", "naming", "rule", "rules",
    "skill", "skills", "command", "commands", "files", "file", "doc",
    "docs", "md", "txt",
}


def tokens(text: str) -> set[str]:
    raw = re.findall(r"[A-Za-z][A-Za-z0-9_-]{2,}", text.lower())
    return {t for t in raw if t not in STOPWORDS and len(t) > 3}


def build_corpus() -> Counter:
    counter: Counter = Counter()
    for glob in CORPUS_GLOBS:
        for path in REPO_ROOT.glob(glob):
            if not path.is_file():
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            for tok in tokens(text):
                counter[tok] += 1
    return counter


def score(rule: dict, corpus: Counter) -> dict:
    rule_tokens = (
        tokens(rule["description"])
        | tokens(rule["name"].replace("-", " "))
        | tokens(" ".join(rule["triggers"]["keywords"]))
        | tokens(" ".join(rule["triggers"]["intents"]))
    )
    hits = {t: corpus[t] for t in rule_tokens if corpus[t] > 0}
    return {
        "name": rule["name"],
        "tokens": sorted(rule_tokens),
        "hits": dict(sorted(hits.items(), key=lambda x: -x[1])[:8]),
        "hit_count": len(hits),
        "total_hit_volume": sum(hits.values()),
        "low_likelihood": len(hits) < LOW_LIKELIHOOD_HITS,
    }


def render_md(scores: list[dict]) -> str:
    flagged = [s for s in scores if s["low_likelihood"]]
    lines = [
        "",
        "## Phase 5.3 — Activation likelihood (corpus-keyword)",
        "",
        f"Corpus: skills + commands + contexts + guidelines.",
        f"Low-likelihood threshold: `< {LOW_LIKELIHOOD_HITS}` distinct corpus hits.",
        "",
        f"Rules flagged: **{len(flagged)} / {len(scores)}**.",
        "",
        "### Low-likelihood rules",
        "",
    ]
    if not flagged:
        lines += ["_None._", ""]
    else:
        lines += ["| Rule | Hits | Tokens (top) |", "|------|------|--------------|"]
        for s in sorted(flagged, key=lambda x: x["hit_count"]):
            toks = ", ".join(f"`{t}`" for t in s["tokens"][:6]) or "—"
            lines.append(f"| `{s['name']}` | {s['hit_count']} | {toks} |")
        lines.append("")
    lines += [
        "### Full ranking (lowest hit-count first, top 20)",
        "",
        "| Rule | Distinct hits | Total hit volume |",
        "|------|---------------|------------------|",
    ]
    for s in sorted(scores, key=lambda x: (x["hit_count"], x["total_hit_volume"]))[:20]:
        lines.append(f"| `{s['name']}` | {s['hit_count']} | {s['total_hit_volume']} |")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    if not AUDIT_JSON.exists():
        print(f"❌  Run audit_auto_rules.py first: missing {AUDIT_JSON}", file=sys.stderr)
        return 1
    rules = json.loads(AUDIT_JSON.read_text(encoding="utf-8"))["rules"]
    corpus = build_corpus()
    scores = [score(r, corpus) for r in rules]
    LIKELIHOOD_JSON.write_text(
        json.dumps({"corpus_size": len(corpus), "scores": scores}, indent=2),
        encoding="utf-8",
    )
    md = AUDIT_MD.read_text(encoding="utf-8") if AUDIT_MD.exists() else ""
    if "## Phase 5.3 — Activation likelihood" in md:
        md = md.split("## Phase 5.3 — Activation likelihood")[0].rstrip() + "\n"
    AUDIT_MD.write_text(md + render_md(scores), encoding="utf-8")
    flagged = [s for s in scores if s["low_likelihood"]]
    print(f"✅  Likelihood scored: {len(scores)} rules, {len(flagged)} low-likelihood.")
    print(f"   JSON: {LIKELIHOOD_JSON.relative_to(REPO_ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
