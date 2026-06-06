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


def _command_files() -> list[Path]:
    """Discover command sources in the post-ADR-051 layout.

    Authoring lives at src/domains/<domain>/**/command.md; the legacy
    packages/*/.agent-src.uncondensed/commands tree is kept as a
    fallback for older checkouts.
    """
    domains = ROOT / "src" / "domains"
    if domains.is_dir():
        return sorted(domains.rglob("command.md"))
    legacy_roots = [d for d in (ROOT / "packages").glob(
        "*/.agent-src.uncondensed/commands") if d.is_dir()]
    return sorted(md for root in legacy_roots for md in root.rglob("*.md"))


# Central eval store in the post-ADR-051 layout. Eval stems use the
# command's `name` or one of its `replaces` aliases.
EVALS_DIR = ROOT / "src" / "agent-src" / "commands" / "evals"


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

    eval_keys = [k for k in [fm.get("name"), *(fm.get("replaces") or [])]
                 if isinstance(k, str) and k.strip()]
    eval_path = next(
        (EVALS_DIR / f"{k}.json" for k in eval_keys
         if (EVALS_DIR / f"{k}.json").exists()),
        md.parent / "evals" / f"{md.stem}.json",  # legacy per-dir layout
    )
    if not eval_path.exists():
        vio.append(Violation(rel, f"missing routing eval under "
                                  f"`{EVALS_DIR.relative_to(ROOT)}/` for any of "
                                  f"{eval_keys or [md.stem]} (Step 5)"))
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

    files = _command_files()
    if not files:
        print("❌  No command roots found.", file=sys.stderr)
        return 3

    visible = 0
    violations: list[Violation] = []
    for md in files:
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
