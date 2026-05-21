#!/usr/bin/env python3
"""Structural overlap detection across skills (description + triggers).

Implements step-2-skill-inventory-rationalization.md Phase 2 Step 2.
Mirrors `scripts/audit_overlap.py` (the rule-side analog) but reads
`.agent-src.uncompressed/skills/<slug>/SKILL.md` frontmatter directly
and emits `agents/runtime/metrics/skill-overlap.md` listing pairs scoring
≥ 0.6 on either:

  - description-trigger Jaccard (tokenized union of `description` +
    any `triggers:` / `keywords:` / `intents:` frontmatter values);
  - symbol-set overlap (paths cited inside the SKILL.md body —
    `.agent-src.uncompressed/...`, `agents/...`, `scripts/...`).

The 0.6 threshold matches the roadmap; the rule-side script uses
lower thresholds because rules have richer trigger metadata. Skills
encode most signal in prose, so we raise the bar.

Output is **a baseline, not a verdict**. Phase 2 Step 3 combines this
report with the 30-day activation counts before any action.
"""
from __future__ import annotations

import argparse
import re
import sys
from itertools import combinations
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
SKILLS = REPO / ".agent-src.uncompressed" / "skills"
OUT = REPO / "agents" / "metrics" / "skill-overlap.md"

# Roadmap target. Empirical calibration (210 skills, 2026-05-16) shows
# this threshold catches structural carbon-copies only — known-similar
# pairs like blade-ui / flux land around 0.35 token-jaccard because
# skill descriptions encode distinct trigger language by design.
STRONG_TOKEN = 0.6
STRONG_SYMBOL = 0.6
# Calibrated review threshold — flags pairs worth a Phase 2 Step 3
# review without exceeding signal-to-noise. Below this, descriptions
# diverge enough that overlap is coincidental.
CANDIDATE_TOKEN = 0.30
CANDIDATE_SYMBOL = 0.50
# Symbol-jaccard is noisy below this floor — two skills sharing a single
# context-spine reference produce 1.0 with no signal. Require a non-trivial
# symbol set on both sides before the symbol axis counts as evidence.
SYMBOL_MIN_SET = 4

STOPWORDS = {
    "the", "and", "for", "with", "when", "use", "or", "of", "to", "a", "an",
    "is", "in", "on", "by", "be", "at", "as", "it", "if", "are", "this",
    "that", "from", "but", "not", "can", "any", "all", "no", "after",
    "before", "during", "user", "agent", "code", "project", "via", "into",
    "onto", "even", "without", "naming", "skill", "skills", "rule", "rules",
    "command", "commands", "guideline", "guidelines",
}

PATH_RE = re.compile(r"`?(?:\.agent-src(?:\.uncompressed)?|agents|scripts|docs|tests|\.augment|\.claude)/[A-Za-z0-9_./-]+`?")
TOKEN_RE = re.compile(r"[A-Za-z][A-Za-z0-9_-]{2,}")


def parse_frontmatter(text: str) -> tuple[dict, str]:
    if not text.startswith("---"):
        return {}, text
    parts = text.split("---", 2)
    if len(parts) < 3:
        return {}, text
    fm_raw, body = parts[1], parts[2]
    fm: dict[str, str] = {}
    current_key: str | None = None
    buf: list[str] = []
    for line in fm_raw.splitlines():
        if not line.strip():
            continue
        if line.startswith(" ") and current_key is not None:
            buf.append(line.strip())
            continue
        if current_key is not None:
            fm[current_key] = " ".join(buf) if buf else fm.get(current_key, "")
        if ":" in line:
            k, v = line.split(":", 1)
            current_key, buf = k.strip(), []
            v = v.strip()
            if v:
                fm[current_key] = v.strip().strip('"').strip("'")
                current_key = None
    if current_key is not None and buf:
        fm[current_key] = " ".join(buf)
    return fm, body


def tokenize(text: str) -> set[str]:
    return {t.lower() for t in TOKEN_RE.findall(text or "")
            if t.lower() not in STOPWORDS and not t.isdigit() and len(t) > 2}


def symbol_set(body: str) -> set[str]:
    return {m.strip("`") for m in PATH_RE.findall(body or "")}


def jaccard(a: set, b: set) -> float:
    if not a and not b:
        return 0.0
    return len(a & b) / len(a | b)


def load_skills(root: Path) -> list[dict]:
    skills: list[dict] = []
    if not root.is_dir():
        return skills
    for skill_md in sorted(root.glob("*/SKILL.md")):
        slug = skill_md.parent.name
        text = skill_md.read_text(encoding="utf-8", errors="replace")
        fm, body = parse_frontmatter(text)
        desc = fm.get("description", "")
        trig = " ".join(fm.get(k, "") for k in ("triggers", "keywords", "intents", "domain"))
        skills.append({
            "slug": slug,
            "tokens": tokenize(desc + " " + trig),
            "symbols": symbol_set(body),
        })
    return skills


def analyse(skills: list[dict]) -> list[dict]:
    pairs: list[dict] = []
    for a, b in combinations(skills, 2):
        j = jaccard(a["tokens"], b["tokens"])
        if min(len(a["symbols"]), len(b["symbols"])) >= SYMBOL_MIN_SET:
            s = jaccard(a["symbols"], b["symbols"])
        else:
            s = 0.0
        if j >= STRONG_TOKEN or s >= STRONG_SYMBOL:
            tier = "strong"
        elif j >= CANDIDATE_TOKEN or s >= CANDIDATE_SYMBOL:
            tier = "candidate"
        else:
            continue
        pairs.append({
            "skill_a": a["slug"], "skill_b": b["slug"],
            "tier": tier,
            "description_jaccard": round(j, 3),
            "symbol_jaccard": round(s, 3),
        })
    pairs.sort(key=lambda p: (p["tier"] != "strong",
                              -max(p["description_jaccard"], p["symbol_jaccard"])))
    return pairs


def render(pairs: list[dict], total: int) -> str:
    strong = [p for p in pairs if p["tier"] == "strong"]
    candidate = [p for p in pairs if p["tier"] == "candidate"]
    lines = [
        "# Skill Structural Overlap (baseline)",
        "",
        "> Generated by `scripts/skill_overlap.py`. Scans",
        "> `.agent-src.uncompressed/skills/*/SKILL.md` frontmatter (description +",
        "> trigger metadata) and body symbol references. Reports pairs in two",
        f"> tiers: **strong** ≥ {STRONG_TOKEN} description-token Jaccard or ≥ {STRONG_SYMBOL}",
        f"> symbol-set Jaccard (roadmap floor); **candidate** ≥ {CANDIDATE_TOKEN} / ≥ {CANDIDATE_SYMBOL}",
        "> (empirical calibration — skill descriptions encode distinct trigger",
        "> language by design, so the roadmap floor catches structural carbon-",
        "> copies only). See [`step-2-skill-inventory-rationalization.md`](../roadmaps/step-2-skill-inventory-rationalization.md)",
        "> Phase 2 Step 2.",
        "",
        f"**Skills scanned:** {total} · **Strong pairs:** {len(strong)} · "
        f"**Candidate pairs:** {len(candidate)}",
        "",
        "| # | skill_a | skill_b | tier | desc_jaccard | symbol_jaccard |",
        "|---|---|---|---|---|---|",
    ]
    for i, p in enumerate(pairs, 1):
        lines.append(f"| {i} | `{p['skill_a']}` | `{p['skill_b']}` | {p['tier']} | "
                     f"{p['description_jaccard']} | {p['symbol_jaccard']} |")
    lines.append("")
    lines.append("**Read-out:** `strong` pairs are first-cut merge / supersede candidates. "
                 "`candidate` pairs are worth a Phase 2 Step 3 review but the description "
                 "signal is faint — usage data (30-day activation report) is the deciding "
                 "input, not this report. Structural overlap alone is evidence, not a verdict.")
    lines.append("")
    return "\n".join(lines)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()
    skills = load_skills(SKILLS)
    if not skills:
        print(f"no skills under {SKILLS}", file=sys.stderr)
        return 1
    pairs = analyse(skills)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(render(pairs, len(skills)), encoding="utf-8")
    if not args.quiet:
        print(f"✅  Wrote {args.out.relative_to(REPO)} "
              f"({len(skills)} skills, {len(pairs)} pair(s) flagged)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
