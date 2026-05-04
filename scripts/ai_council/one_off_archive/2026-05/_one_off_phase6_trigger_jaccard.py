#!/usr/bin/env python3
"""Phase 6.1 — chat-history-* trigger overlap (Jaccard).

Source of truth per rule = frontmatter `description:` field
(the trigger surface that decides when an `auto` rule activates).
Tokens = lowercased alphanum words length ≥ 3, minus a small
stop-list of file-name fragments and connective words that carry
no trigger signal.

Output: pairwise Jaccard + branch verdict per roadmap § 6.1.
"""
from __future__ import annotations

import re
from itertools import combinations
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RULES_DIR = ROOT / ".agent-src.uncompressed/rules"

RULES = [
    "chat-history-cadence",
    "chat-history-ownership",
    "chat-history-visibility",
]

STOP = {
    "the", "and", "for", "with", "from", "via", "per", "not",
    "into", "onto", "out", "off", "any", "all", "this", "that",
    "agent", "chat", "history",
    "agentchathistory", "chathistory",
    "rule", "rules", "file", "files",
}

DESC_RE = re.compile(r'^description:\s*"([^"]+)"', re.MULTILINE)
TOKEN_RE = re.compile(r"[a-z][a-z0-9_]{2,}")


def tokens(rule_id: str) -> set[str]:
    text = (RULES_DIR / f"{rule_id}.md").read_text(encoding="utf-8")
    m = DESC_RE.search(text)
    if not m:
        raise RuntimeError(f"no description in {rule_id}")
    desc = m.group(1).lower()
    raw = TOKEN_RE.findall(desc)
    return {t for t in raw if t not in STOP}


def jaccard(a: set[str], b: set[str]) -> float:
    union = a | b
    if not union:
        return 0.0
    return len(a & b) / len(union)


def main() -> int:
    sets = {r: tokens(r) for r in RULES}

    print(f"Phase 6.1 — trigger Jaccard (source: frontmatter `description:`)")
    print()
    for r, ts in sets.items():
        print(f"  {r}  ({len(ts)} tokens)")
        print(f"    {sorted(ts)}")
        print()

    print("Pairwise Jaccard:")
    print()
    print(f"  {'pair':55s}  intersect  union  Jaccard")
    pairs_above = 0
    for a, b in combinations(RULES, 2):
        inter = sets[a] & sets[b]
        union = sets[a] | sets[b]
        j = jaccard(sets[a], sets[b])
        marker = " **" if j >= 0.30 else ""
        print(f"  {a + ' × ' + b:55s}  {len(inter):>8d}  {len(union):>5d}  {j:>6.3f}{marker}")
        print(f"    intersection: {sorted(inter)}")
        if j >= 0.30:
            pairs_above += 1
    print()

    if pairs_above >= 2:
        print(f"VERDICT: ≥ 30% on {pairs_above}/3 pairs → PROCEED to 6.2 (unified shape).")
        return 0
    if pairs_above == 1:
        print(f"VERDICT: mixed ({pairs_above}/3 pairs ≥ 30%) → ESCALATE to council.")
        return 0
    print(f"VERDICT: < 30% on all 3 pairs → STOP at 6.1 (orthogonal — current shape optimal).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
