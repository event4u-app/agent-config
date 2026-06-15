#!/usr/bin/env python3
"""Anti-duplicate originality gate (road-to-competitive-borrow P1.1).

Promotes the existing structural-overlap *report* (``skill_overlap.py``) to a
guard-railed *gate*. Reuses that script's tokeniser / Jaccard primitives — no
second similarity engine — but reads the **canonical** ``src/skills`` tree
(``skill_overlap.py`` still scans the dead ``.agent-src.uncondensed`` baseline
path) and adds the two things a gate needs the report does not:

  1. **Domain awareness.** Two skills are *same-domain* when their ``packs:``
     sets intersect. Same-domain near-duplicates are the real failure (volume
     ≠ capability); cross-domain overlap is usually coincidental trigger
     language.
  2. **Severity split.** Same-domain pairs ≥ ``FAIL_THRESHOLD`` are the
     would-fail class; cross-domain pairs ≥ ``WARN_THRESHOLD`` are advisory.

**Warn-only by default.** ``docs/contracts/adr-architectural-consensus-mechanism.md``
deferred promoting the ontology-collision lint from ``warn-only`` to
``fail-the-build`` "until thresholds are confirmed stable across one full
release cycle … so the threshold has time to settle without breaking PRs on
borderline noise." This gate honours that deferral: it prints the would-fail
class and exits 0. Promotion path: run with ``--strict`` (exits 1 on any
non-allowlisted same-domain violation) once thresholds are stable.
Resolution of the roadmap-P1.1-vs-ADR conflict: AI council (claude-sonnet-4-5
+ gpt-4o, design lens, deep, 2026-06-15) — both members converged warn-only.

Allowlist: ``lint_skill_originality_allowlist.json`` (legitimate
ADR-disambiguated cluster heads). Hard-capped at 20 entries per the
``autonomous-execution`` allowlist-growth antipattern (>20 = the linter is
wrong, not the content).

Usage:
    python3 scripts/lint_skill_originality.py            # warn-only (CI default)
    python3 scripts/lint_skill_originality.py --strict   # exit 1 on same-domain violations
    python3 scripts/lint_skill_originality.py --json out.json
    python3 scripts/lint_skill_originality.py --quiet
"""
from __future__ import annotations

import argparse
import json
import sys
from itertools import combinations
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from skill_overlap import jaccard, parse_frontmatter, tokenize  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
SKILLS = REPO / "src" / "skills"
ALLOWLIST = Path(__file__).resolve().parent / "lint_skill_originality_allowlist.json"
ALLOWLIST_CAP = 20

# Same calibration as skill_overlap.py: 0.6 description-token Jaccard catches
# structural carbon-copies only (skills encode distinct trigger language by
# design). Same-domain pairs at/above this are merge/supersede candidates.
FAIL_THRESHOLD = 0.6
# Advisory floor — faint signal, never blocking even under --strict. Calibrated
# to surface the known cluster heads (laravel↔symfony-workflow ≈ 0.44,
# blade-ui↔livewire ≈ 0.42) without dragging in the coincidental ≈0.30 tail.
WARN_THRESHOLD = 0.40


def parse_packs(fm: dict) -> set[str]:
    """Extract the packs: list. parse_frontmatter collapses list items into one
    space-joined string under the key (e.g. "- engineering-base - meta")."""
    raw = fm.get("packs", "")
    return {tok.strip().lstrip("-").strip() for tok in raw.split() if tok.strip("-").strip()}


def load_skills(root: Path) -> list[dict]:
    skills: list[dict] = []
    for skill_md in sorted(root.glob("*/SKILL.md")):
        fm, _ = parse_frontmatter(skill_md.read_text(encoding="utf-8", errors="replace"))
        desc = fm.get("description", "")
        trig = " ".join(fm.get(k, "") for k in ("triggers", "keywords", "intents", "domain"))
        skills.append({
            "slug": skill_md.parent.name,
            "tokens": tokenize(desc + " " + trig),
            "packs": parse_packs(fm),
        })
    return skills


def load_allowlist() -> set[frozenset]:
    if not ALLOWLIST.is_file():
        return set()
    data = json.loads(ALLOWLIST.read_text(encoding="utf-8"))
    entries = data.get("pairs", [])
    if len(entries) > ALLOWLIST_CAP:
        print(
            f"❌  lint_skill_originality: allowlist has {len(entries)} entries "
            f"(> {ALLOWLIST_CAP}). Per the autonomous-execution allowlist-growth "
            f"antipattern, this means the linter is wrong, not the content — "
            f"tighten the heuristic or narrow scope, do not grow the allowlist.",
            file=sys.stderr,
        )
        raise SystemExit(2)
    return {frozenset((p["skill_a"], p["skill_b"])) for p in entries}


def analyse(skills: list[dict], allow: set[frozenset]) -> list[dict]:
    findings: list[dict] = []
    for a, b in combinations(skills, 2):
        j = jaccard(a["tokens"], b["tokens"])
        same_domain = bool(a["packs"] & b["packs"])
        if same_domain and j >= FAIL_THRESHOLD:
            severity = "would-fail"
        elif not same_domain and j >= WARN_THRESHOLD:
            severity = "warn"
        elif same_domain and j >= WARN_THRESHOLD:
            severity = "warn"
        else:
            continue
        allowed = frozenset((a["slug"], b["slug"])) in allow
        findings.append({
            "skill_a": a["slug"], "skill_b": b["slug"],
            "jaccard": round(j, 3),
            "same_domain": same_domain,
            "shared_packs": sorted(a["packs"] & b["packs"]),
            "severity": "allowlisted" if allowed else severity,
        })
    findings.sort(key=lambda f: (f["severity"] != "would-fail", -f["jaccard"]))
    return findings


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--strict", action="store_true",
                    help="exit 1 on any non-allowlisted same-domain violation (post-promotion)")
    ap.add_argument("--json", type=Path, help="also write findings as JSON")
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    skills = load_skills(SKILLS)
    if not skills:
        print(f"no skills under {SKILLS}", file=sys.stderr)
        return 1
    allow = load_allowlist()
    findings = analyse(skills, allow)

    blocking = [f for f in findings if f["severity"] == "would-fail"]
    warns = [f for f in findings if f["severity"] == "warn"]

    if args.json:
        args.json.parent.mkdir(parents=True, exist_ok=True)
        args.json.write_text(json.dumps({
            "scanned": len(skills),
            "fail_threshold": FAIL_THRESHOLD,
            "warn_threshold": WARN_THRESHOLD,
            "mode": "strict" if args.strict else "warn-only",
            "findings": findings,
        }, indent=2) + "\n", encoding="utf-8")

    if not args.quiet:
        for f in blocking:
            tag = "WOULD-FAIL" if not args.strict else "FAIL"
            print(f"  [{tag}] same-domain {f['jaccard']:.3f}  "
                  f"`{f['skill_a']}` ↔ `{f['skill_b']}`  packs={f['shared_packs']}")
        for f in warns:
            print(f"  [warn] {f['jaccard']:.3f}  `{f['skill_a']}` ↔ `{f['skill_b']}`"
                  f"{' (same-domain)' if f['same_domain'] else ''}")

    if args.strict and blocking:
        print(f"❌  lint_skill_originality: {len(blocking)} same-domain "
              f"near-duplicate pair(s) ≥ {FAIL_THRESHOLD}. Merge, supersede, "
              f"or allowlist with an ADR rationale.", file=sys.stderr)
        return 1

    if not args.quiet:
        suffix = "" if args.strict else " (warn-only per ADR deferral)"
        print(f"✅  lint_skill_originality: {len(skills)} skills, "
              f"{len(blocking)} would-fail / {len(warns)} warn{suffix}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
