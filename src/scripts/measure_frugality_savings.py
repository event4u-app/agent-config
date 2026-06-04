#!/usr/bin/env python3
"""Phase 0 baseline harness for road-to-trim-frugality-canon.

Measures the *current state* of the frugality canon along four
deterministic axes. Output: JSONL baseline appended to
agents/runtime/frugality/baseline.jsonl (gitignored).

Metrics:
  A. footprint    — per-rule char/token count, kernel/tier breakdown
  B. fillers      — filler-phrase prevalence in chat-history corpus
                    (heuristic signal, not full transcript)
  C. condensation  — uncondensed → condensed char delta per rule
  D. redundancy   — cross-ref overlap across "Interactions:" /
                    "See also" sections in the canon

Trim phases re-run this harness after each PR. Decline condition fires
if metric B regresses (filler prevalence increases) or metric C drops
below current baseline by >10% per rule.
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from pathlib import Path

CANON_RULES = [
    ("direct-answers", "kernel"),
    ("no-cheap-questions", "kernel"),
    ("ask-when-uncertain", "kernel"),
    ("user-interaction", "tier_1"),
    ("telegraph-speak", "tier_1"),
    ("token-efficiency", "tier_2"),
]
CHARTER = "frugality-charter"

FILLER_PATTERNS = [
    r"\bgreat question\b", r"\bfascinating\b", r"\bexcellent point\b",
    r"\blet me\s+(check|look|find|verify|investigate|see)\b",
    r"\bnow\s+(i'll|i will|let's)\b",
    r"\bgoing to\s+(check|run|use|call|invoke)\b",
    r"\bperfect\b!?", r"\bawesome\b!?",
    r"\bhere's what i\b", r"\bfound it\b",
    r"^\s*(ok|okay|alright)[!,.]\s",
]
FILLER_RE = re.compile("|".join(FILLER_PATTERNS), re.IGNORECASE | re.MULTILINE)

# Cross-ref section headers to count for redundancy metric
XREF_HEADERS = re.compile(r"^##\s+(Interactions|See also|Related)\s*$", re.MULTILINE)


def _read(path: Path) -> str:
    return path.read_text() if path.exists() else ""


def metric_a_footprint(root: Path) -> dict:
    """Per-rule char count, tier classification, total kernel %."""
    rows = []
    kernel_total = 0
    tier1_total = 0
    tier2_total = 0
    for name, tier in CANON_RULES:
        condensed = root / ".agent-src" / "rules" / f"{name}.md"
        chars = len(_read(condensed))
        tokens = chars // 4  # rough 4-char/token approximation
        rows.append({"rule": name, "tier": tier, "chars": chars, "tokens_approx": tokens})
        if tier == "kernel":
            kernel_total += chars
        elif tier == "tier_1":
            tier1_total += chars
        elif tier == "tier_2":
            tier2_total += chars
    charter_chars = len(_read(root / ".agent-src" / "contexts" / "contracts" / f"{CHARTER}.md"))
    return {
        "rules": rows,
        "kernel_total_chars": kernel_total,
        "tier_1_total_chars": tier1_total,
        "tier_2_total_chars": tier2_total,
        "charter_chars": charter_chars,
        "kernel_budget_chars": 26000,
        "kernel_pct": round(100 * kernel_total / 26000, 2),
    }


def metric_b_fillers(corpus: Path) -> dict:
    """Filler-phrase hits per agent turn in chat-history corpus."""
    if not corpus.exists():
        return {"corpus_present": False}
    lines = corpus.read_text().splitlines()
    agent_turns = 0
    filler_hits = 0
    total_chars = 0
    for ln in lines[1:]:
        try:
            d = json.loads(ln)
        except json.JSONDecodeError:
            continue
        if d.get("t") != "agent":
            continue
        text = d.get("text", "")
        agent_turns += 1
        total_chars += len(text)
        filler_hits += len(FILLER_RE.findall(text))
    return {
        "corpus_present": True,
        "agent_turns": agent_turns,
        "filler_hits_total": filler_hits,
        "filler_hits_per_turn": round(filler_hits / max(agent_turns, 1), 3),
        "agent_chars_total": total_chars,
        "patterns_count": len(FILLER_PATTERNS),
        "note": "chat-history texts are digests, not full transcripts; signal not output volume",
    }


def metric_c_condensation(root: Path) -> dict:
    """Uncondensed → condensed char delta per rule."""
    rows = []
    for name, _ in CANON_RULES:
        un = len(_read(root / ".agent-src.uncondensed" / "rules" / f"{name}.md"))
        co = len(_read(root / ".agent-src" / "rules" / f"{name}.md"))
        delta = un - co
        ratio = round(co / un, 3) if un else 0
        rows.append({"rule": name, "uncondensed_chars": un, "condensed_chars": co, "delta": delta, "ratio": ratio})
    return {"rules": rows}


def metric_d_redundancy(root: Path) -> dict:
    """Cross-ref section count + total xref-block size."""
    rows = []
    for name, _ in CANON_RULES:
        path = root / ".agent-src.uncondensed" / "rules" / f"{name}.md"
        text = _read(path)
        xref_count = len(XREF_HEADERS.findall(text))
        # naive: chars after last xref header to EOF
        m = list(XREF_HEADERS.finditer(text))
        xref_block_chars = (len(text) - m[-1].start()) if m else 0
        rows.append({"rule": name, "xref_sections": xref_count, "xref_block_chars": xref_block_chars})
    return {"rules": rows, "total_xref_chars": sum(r["xref_block_chars"] for r in rows)}


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    corpus = root / "agents" / "runtime" / ".agent-chat-history"

    record = {
        "schema_version": 1,
        "ts": datetime.now(tz=timezone.utc).isoformat(timespec="seconds"),
        "phase": "phase_0_baseline",
        "metric_a_footprint": metric_a_footprint(root),
        "metric_b_fillers": metric_b_fillers(corpus),
        "metric_c_condensation": metric_c_condensation(root),
        "metric_d_redundancy": metric_d_redundancy(root),
    }

    out = root / "agents" / "runtime" / "frugality" / "baseline.jsonl"
    with out.open("a") as fh:
        fh.write(json.dumps(record, ensure_ascii=False) + "\n")
    print(json.dumps(record, indent=2, ensure_ascii=False))
    print(f"\nappended → {out.relative_to(root)}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
