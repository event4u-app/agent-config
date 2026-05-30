#!/usr/bin/env python3
"""Fail when a skill or command lacks a `recommended_model` value.

Phase 5 coverage gate of `road-to-per-skill-model-autoswitch.md` (ADR-034):
every skill and command MUST declare an explicit `recommended_model`
(`opus | sonnet | gpt`) or `inherit`. An untagged artefact is an error — it
leaves the per-skill model-switch surface with a silent gap. Run
`python3 scripts/backfill_recommended_model.py` to seed missing tags.

The enum itself is validated by `scripts/validate_frontmatter.py`; this gate
only enforces *presence* (an explicit decision was made for every artefact).

CLI: python3 scripts/lint_recommended_model_coverage.py [--quiet]
Exit: 0 clean · 1 at least one untagged skill/command.
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from validate_frontmatter import parse_frontmatter  # noqa: E402
from _lib.agent_src import artefact_roots  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]


def _targets():
    for root in artefact_roots():
        sdir = root / "skills"
        if sdir.exists():
            for p in sorted(sdir.rglob("SKILL.md")):
                yield "skill", p
        cdir = root / "commands"
        if cdir.exists():
            for p in sorted(cdir.rglob("*.md")):
                if p.name != "AGENTS.md":
                    yield "command", p


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--quiet", action="store_true")
    args = ap.parse_args(argv)

    total = 0
    missing = []
    for kind, path in _targets():
        total += 1
        fm, _ = parse_frontmatter(path.read_text(encoding="utf-8"))
        if not isinstance(fm, dict) or not fm.get("recommended_model"):
            missing.append((kind, path.relative_to(ROOT).as_posix()))

    if missing:
        for kind, rel in missing[:40]:
            print(f"❌  [{kind}] {rel}: missing `recommended_model` "
                  f"(set opus/sonnet/gpt or inherit)")
        if len(missing) > 40:
            print(f"  ... and {len(missing) - 40} more")
        print(
            f"\n== recommended_model coverage: {len(missing)}/{total} artefact(s) "
            "untagged. Run `python3 scripts/backfill_recommended_model.py`. ==",
            file=sys.stderr,
        )
        return 1
    if not args.quiet:
        print(f"✅  lint-recommended-model-coverage: {total} artefact(s) tagged.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
