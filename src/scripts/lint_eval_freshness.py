#!/usr/bin/env python3
"""Lint trigger-eval freshness — corpus-backed skills must carry a current
`upstream.last_eval` (the corpus-refresh DoD, ADR-061 §6 + road-to-image-brand-
typography Phase D).

Deterministic, no token spend: it only reads on-disk manifests. The live eval
(`task test-triggers-live`) and the recording (`agent-config eval:record`) are
separate, spend-bearing steps; this gate verifies the *result* was recorded and
is still attached to the pinned SHA.

A skill is in scope when ALL hold:
  - it ships `evals/triggers.json` (it is description-routed), AND
  - it has a corpus `data/manifest.json`, AND
  - that manifest's `upstream` is an object carrying a non-null `sha`.

`upstream: null` (an original-authored corpus with no upstream pin — e.g. the
`brand` corpus) is OUT of scope: there is no SHA to attach an eval to, so there
is nothing to keep fresh. Such corpora are skipped, not failed.

For an in-scope skill the gate fails when:
  - `upstream.last_eval` is absent (never recorded), OR
  - `last_eval.sha_at_eval` != `upstream.sha` (recorded against a stale pin —
    the SHA bumped without a re-eval).

Exit codes:
  0  all in-scope skills have a current last_eval (or none are in scope)
  1  at least one in-scope skill is missing / stale
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
SKILLS_DIR = REPO / "src" / "skills"


def _load_json(path: Path) -> dict | None:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def check() -> list[str]:
    """Return a list of freshness violations (empty = clean)."""
    errors: list[str] = []
    if not SKILLS_DIR.exists():
        return errors

    for manifest_path in sorted(SKILLS_DIR.glob("*/data/manifest.json")):
        skill_dir = manifest_path.parent.parent
        skill = skill_dir.name

        # In scope only if the skill is description-routed (ships triggers).
        if not (skill_dir / "evals" / "triggers.json").exists():
            continue

        manifest = _load_json(manifest_path)
        if manifest is None:
            errors.append(f"{skill}: manifest.json is unreadable / invalid JSON")
            continue

        upstream = manifest.get("upstream")
        # Out of scope: no upstream pin (original-authored corpus, e.g. brand).
        if not isinstance(upstream, dict):
            continue
        sha = upstream.get("sha")
        if not sha:
            continue

        last_eval = upstream.get("last_eval")
        if not isinstance(last_eval, dict):
            errors.append(
                f"{skill}: ships evals/triggers.json + a SHA-pinned manifest but "
                f"has no `upstream.last_eval` — run the live eval and "
                f"`agent-config eval:record` (ADR-061 §6 refresh DoD)."
            )
            continue
        sha_at_eval = last_eval.get("sha_at_eval")
        if sha_at_eval != sha:
            errors.append(
                f"{skill}: `upstream.last_eval.sha_at_eval` ({sha_at_eval!r}) != "
                f"`upstream.sha` ({sha!r}) — the corpus moved since the last eval; "
                f"re-run the live eval and re-record."
            )

    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--quiet", action="store_true", help="Suppress the OK line")
    args = parser.parse_args()

    errors = check()
    if errors:
        print("eval-freshness: corpus-backed skills missing a current last_eval:", file=sys.stderr)
        for e in errors:
            print(f"  - {e}", file=sys.stderr)
        return 1
    if not args.quiet:
        print("✅  eval-freshness: all SHA-pinned corpus skills carry a current upstream.last_eval.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
