#!/usr/bin/env python3
"""Routing-metadata + routing-eval linter for visible commands.

6.0.0-C Phase 2 Steps 4b + 5. Every VISIBLE command (tier 0/1) must carry:

  - `intent`     — non-empty one-line existence justification (Step 4b)
  - `routes_to`  — non-empty list of skill / cluster-sub / command slugs (Step 4b)
  - `replaces`   — a list (may be empty `[]`); the key must be present (Step 4b)
  - a routing eval at `<command-dir>/evals/<stem>.json` with >= MIN_CASES
    prompt→command cases (Step 5)

Internal commands (tier 2 / absent) are exempt — they are the composition layer.
Unlike the forward-only growth gates, this lint enforces on the WHOLE visible
surface: the backfill in 6.0.0-C Phase 2 brings every existing visible command
into compliance, so the gate is green today and stays green.

Exit codes: 0 = clean, 1 = violations found, 3 = internal error.

Usage:
    python3 scripts/lint_command_routing.py
    python3 scripts/lint_command_routing.py --quiet
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
FM_RE = re.compile(r"^---\n(.*?)\n---", re.DOTALL)
VISIBLE_TIERS = {0, 1}
MIN_CASES = 5  # roadmap Step 5: "5–10 example prompts"


@dataclass
class Violation:
    file: str
    reason: str


def _command_roots() -> list[Path]:
    pkgs = ROOT / "packages"
    roots = [d for d in pkgs.glob("*/.agent-src.uncondensed/commands")
             if d.is_dir()] if pkgs.is_dir() else []
    legacy = ROOT / ".agent-src.uncondensed" / "commands"
    if not roots and legacy.is_dir():
        roots = [legacy]
    return roots


def _frontmatter(text: str) -> dict:
    import yaml
    m = FM_RE.search(text)
    if not m:
        return {}
    try:
        return yaml.safe_load(m.group(1)) or {}
    except yaml.YAMLError:
        return {}


def check(md: Path) -> list[Violation]:
    fm = _frontmatter(md.read_text(encoding="utf-8"))
    tier = fm.get("tier", 2)
    if tier not in VISIBLE_TIERS:
        return []
    rel = str(md.relative_to(ROOT))
    vio: list[Violation] = []

    intent = fm.get("intent")
    if not (isinstance(intent, str) and intent.strip()):
        vio.append(Violation(rel, "missing/empty `intent` (Step 4b)"))

    routes = fm.get("routes_to")
    if not (isinstance(routes, list) and routes):
        vio.append(Violation(rel, "missing/empty `routes_to` list (Step 4b)"))

    if "replaces" not in fm or not isinstance(fm.get("replaces"), list):
        vio.append(Violation(rel, "missing `replaces` key (use `[]` when it "
                                  "replaces nothing) (Step 4b)"))

    eval_path = md.parent / "evals" / f"{md.stem}.json"
    if not eval_path.exists():
        vio.append(Violation(rel, f"missing routing eval "
                                  f"`{eval_path.relative_to(ROOT)}` (Step 5)"))
    else:
        try:
            data = json.loads(eval_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            vio.append(Violation(rel, f"routing eval is invalid JSON: {exc}"))
        else:
            cases = data.get("cases")
            if not (isinstance(cases, list) and len(cases) >= MIN_CASES):
                vio.append(Violation(rel, f"routing eval has < {MIN_CASES} "
                                          f"cases (Step 5: 5–10 prompts)"))
            elif not all(isinstance(c, dict) and c.get("prompt")
                         and c.get("expected") for c in cases):
                vio.append(Violation(rel, "routing eval case missing "
                                          "`prompt`/`expected`"))
    return vio


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args()

    roots = _command_roots()
    if not roots:
        print("❌  No command roots found.", file=sys.stderr)
        return 3

    visible = 0
    violations: list[Violation] = []
    for root in roots:
        for md in sorted(root.rglob("*.md")):
            if md.name == "AGENTS.md" or "_archive" in md.parts \
               or md.parent.name == "evals":
                continue
            fm = _frontmatter(md.read_text(encoding="utf-8"))
            if fm.get("tier", 2) in VISIBLE_TIERS:
                visible += 1
            violations += check(md)

    if violations:
        print(f"❌  {len(violations)} routing-metadata violation(s) across "
              f"{visible} visible command(s):")
        for v in violations:
            print(f"  • {v.file} — {v.reason}")
        print("\nSee command.schema.json (intent/routes_to/replaces) and "
              "docs/contracts/command-clusters.md § routing metadata.")
        return 1
    if not args.quiet:
        print(f"✅  {visible} visible command(s) carry intent/routes_to/replaces "
              f"+ a routing eval.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
