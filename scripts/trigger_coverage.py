#!/usr/bin/env python3
"""Trigger-coverage suite (roadmap Phase 2.1 / 2.2).

The deterministic *must-load* floor for the lean-initial-context migration.
Before any auto-tier rule body is demoted to a router-resolved pointer
(Phase 3), this suite proves the router still fires that rule on
representative task phrasings — so a needed rule can never silently fail
to surface.

Cases live in `tests/eval/trigger-coverage.yaml` and have the shape:

    - id: secrets-edit
      prompt: "add a webhook secret to the billing service auth flow"
      expect: [security-sensitive-stop]   # MUST be in the fired set

Matching is deterministic against `dist/router.json` (NOT the semantic
production router — this is a reproducible floor that catches a removed
trigger in CI):

- kernel rules always fire (always-on layer).
- a tier rule fires iff any of its triggers matches the prompt:
  - `keyword` → case-insensitive substring.
  - `intent`  → every alpha word (len>2) of the intent phrase appears as a
    token in the prompt (so "structural decision" fires on a prompt that
    contains both "structural" and "decision").

A case fails when an expected rule is NOT in the fired set. Exit 1 on any
miss → the merge that would have shrunk the rule is blocked (2.2).

Usage:
    python3 scripts/trigger_coverage.py            # run, human report
    python3 scripts/trigger_coverage.py --json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
ROUTER = REPO_ROOT / "dist" / "router.json"
CORPUS = REPO_ROOT / "tests" / "eval" / "trigger-coverage.yaml"

try:
    import yaml
except ImportError:  # pragma: no cover
    sys.stderr.write("error: PyYAML required (pip install pyyaml)\n")
    sys.exit(2)

_WORD = re.compile(r"[a-z][a-z0-9_]+")


def _tokens(text: str) -> set[str]:
    return {w for w in _WORD.findall(text.lower()) if len(w) > 2}


def load_router() -> dict:
    return json.loads(ROUTER.read_text(encoding="utf-8"))


def fired_rules(prompt: str, router: dict) -> set[str]:
    """Return every rule id the router would surface for `prompt`."""
    low = prompt.lower()
    toks = _tokens(prompt)
    fired: set[str] = set(router.get("kernel", []))
    for tier in ("tier_1", "tier_2"):
        for entry in router.get(tier, []):
            for trig in entry.get("triggers", []):
                if "keyword" in trig:
                    if trig["keyword"].lower() in low:
                        fired.add(entry["id"])
                        break
                elif "intent" in trig:
                    words = _tokens(trig["intent"])
                    if words and words <= toks:
                        fired.add(entry["id"])
                        break
    return fired


def run(corpus: list[dict], router: dict) -> tuple[list[dict], int]:
    results = []
    misses = 0
    for case in corpus:
        fired = fired_rules(case["prompt"], router)
        expected = case.get("expect", [])
        missing = [r for r in expected if r not in fired]
        ok = not missing
        if not ok:
            misses += 1
        results.append({"id": case["id"], "ok": ok, "missing": missing,
                        "expect": expected})
    return results, misses


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args(argv)

    if not ROUTER.is_file():
        sys.stderr.write(f"error: {ROUTER} missing — run compile_router first\n")
        return 2
    corpus = yaml.safe_load(CORPUS.read_text(encoding="utf-8")) or []
    router = load_router()
    results, misses = run(corpus, router)

    if args.json:
        print(json.dumps({"cases": len(results), "misses": misses,
                          "results": results}, indent=2, sort_keys=True))
    else:
        for r in results:
            mark = "✅" if r["ok"] else "❌"
            detail = "" if r["ok"] else f"  MISSING: {', '.join(r['missing'])}"
            print(f"  {mark}  {r['id']}{detail}")
        print()
        if misses:
            print(f"❌  trigger-coverage: {misses}/{len(results)} case(s) failed — "
                  "a required rule does not fire. Blocking.")
        else:
            print(f"✅  trigger-coverage: {len(results)}/{len(results)} pass")
    return 1 if misses else 0


if __name__ == "__main__":
    sys.exit(main())
