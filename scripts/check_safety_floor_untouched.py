#!/usr/bin/env python3
"""Safety-floor exclusion linter (Phase 2A.0 of road-to-structural-optimization).

Per Q3=A locked decision (council Round 3, 2026-05-03), the four
safety-floor always-rules are out of scope for Phase 2A slimming:

  - non-destructive-by-default
  - commit-policy
  - scope-control
  - verify-before-complete

This linter compares HEAD against a baseline ref (default: ``main``)
and fails CI if any of those four rule files were modified by the
working branch.

Lift via the two-gate rollback documented in
``agents/roadmaps/road-to-structural-optimization.md`` § Phase 2A
Abort/rollback.

Exit codes: 0 = clean (or skipped — see ``--skip-if-no-baseline``),
1 = safety-floor file modified, 3 = internal error.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
RULES_DIR_REL = ".agent-src.uncompressed/rules"
SAFETY_FLOOR = (
    "non-destructive-by-default.md",
    "commit-policy.md",
    "scope-control.md",
    "verify-before-complete.md",
)


def _run_git(args: list[str]) -> tuple[int, str]:
    proc = subprocess.run(
        ["git", *args],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
    return proc.returncode, (proc.stdout or "") + (proc.stderr or "")


def _baseline_exists(ref: str) -> bool:
    code, _ = _run_git(["rev-parse", "--verify", "--quiet", ref])
    return code == 0


def _changed_files(baseline: str) -> list[str]:
    code, output = _run_git(["diff", "--name-only", f"{baseline}...HEAD"])
    if code != 0:
        raise RuntimeError(f"git diff failed: {output}")
    return [line.strip() for line in output.splitlines() if line.strip()]


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--baseline",
        default="origin/main",
        help="Baseline ref (default: origin/main)",
    )
    parser.add_argument(
        "--skip-if-no-baseline",
        action="store_true",
        help="Exit 0 silently if baseline ref does not exist (local dev)",
    )
    args = parser.parse_args()

    if not _baseline_exists(args.baseline):
        if args.skip_if_no_baseline:
            print(f"ℹ️  baseline {args.baseline} not found — skipped")
            return 0
        # Fallback: try plain `main`
        if _baseline_exists("main"):
            args.baseline = "main"
        else:
            print(
                f"❌  baseline {args.baseline} (and `main`) not found. "
                "Pass --skip-if-no-baseline to silence in local dev.",
                file=sys.stderr,
            )
            return 3

    try:
        changed = _changed_files(args.baseline)
    except RuntimeError as exc:
        print(f"❌  {exc}", file=sys.stderr)
        return 3

    floor_paths = {f"{RULES_DIR_REL}/{name}" for name in SAFETY_FLOOR}
    breaches = sorted(p for p in changed if p in floor_paths)

    if breaches:
        print(
            "❌  Safety-floor rule(s) modified — Phase 2A is not allowed to "
            "touch these (Q3=A locked decision):",
            file=sys.stderr,
        )
        for path in breaches:
            print(f"    {path}", file=sys.stderr)
        print(
            "\n    Lift via the two-gate rollback documented in "
            "agents/roadmaps/road-to-structural-optimization.md "
            "§ Phase 2A Abort/rollback.",
            file=sys.stderr,
        )
        return 1

    print(
        f"✅  Safety-floor untouched ({len(SAFETY_FLOOR)} rules guarded "
        f"vs. {args.baseline})."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
