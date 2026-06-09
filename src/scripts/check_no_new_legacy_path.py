#!/usr/bin/env python3
"""Regression guard: no NEW `.agent-src.uncondensed/` references in `src/`.

`.agent-src.uncondensed/` is the dead pre-relocation source path (the source of
truth moved to `src/`, ADR-051). Existing stale *prose* mentions in `src/` are
fixed opportunistically — a large blind sweep was rejected by AI-council
(2026-06-09): the path literal is also the *detection subject* of the reference
linters, so a blanket rewrite is a loaded gun, and historical ADRs are correct
as written. This guard stops the debt from *growing*: it fails when a diff
**adds** a new `.agent-src.uncondensed/` line under `src/`.

Three `src/` files legitimately contain the literal forever and are exempt:
  - src/scripts/_lib/agent_src.py        (the LEGACY_SRC constant)
  - src/scripts/check_references.py       (forbidden-substring detector)
  - src/scripts/check_condensed_paths.py  (forbidden-substring detector)

Diff-based: compares added lines against a base ref (default `origin/main`).
On a clean checkout with no diff, it is a no-op (exit 0).

Usage:  python3 src/scripts/check_no_new_legacy_path.py [--base <ref>]
Exit:   0 = no new references, 1 = a new reference was added, 2 = internal error.
"""
from __future__ import annotations

import subprocess
import sys

LEGACY = ".agent-src.uncondensed/"
EXEMPT = {
    "src/scripts/_lib/agent_src.py",
    "src/scripts/check_references.py",
    "src/scripts/check_condensed_paths.py",
    "src/scripts/check_no_new_legacy_path.py",  # this file documents the literal
}


def _base() -> str:
    for i, a in enumerate(sys.argv):
        if a == "--base" and i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return "origin/main"


def find_offenders(diff_text: str) -> list[str]:
    """Added (`+`) lines under a non-exempt src/ file that introduce the legacy
    path. Pure function over a unified-diff string — unit-testable."""
    cur_file = None
    offenders: list[str] = []
    for line in diff_text.splitlines():
        if line.startswith("+++ b/"):
            cur_file = line[6:]
            continue
        if line.startswith("+") and not line.startswith("+++"):
            # src/-scoped: a full diff (e.g. `gh pr diff`) carries every path;
            # only added lines under src/ (minus the exempt detectors) count.
            if (cur_file and cur_file.startswith("src/")
                    and cur_file not in EXEMPT and LEGACY in line):
                offenders.append(f"{cur_file}: {line[1:].strip()[:100]}")
    return offenders


def main() -> int:
    # --stdin: read a unified diff from stdin (CI pipes `gh pr diff` — auth-safe,
    # no `git fetch <base>` extraheader race on shallow PR-merge checkouts, the
    # documented failure the kernel-bundle step sidesteps the same way).
    if "--stdin" in sys.argv:
        offenders = find_offenders(sys.stdin.read())
    else:
        base = _base()
        # Two-dot diff: working tree vs base — catches committed + uncommitted
        # additions (robust locally and where the working tree is the branch tip).
        try:
            diff = subprocess.run(
                ["git", "diff", base, "--", "src/"],
                capture_output=True, text=True, check=False,
            )
        except Exception as exc:  # pragma: no cover
            print(f"❌  check_no_new_legacy_path: git diff failed: {exc}")
            return 2
        if diff.returncode not in (0, 1):
            # base ref missing (shallow clone / detached) — degrade to no-op.
            print(f"⚠️  check_no_new_legacy_path: base '{base}' unavailable; skipping (no-op).")
            return 0
        offenders = find_offenders(diff.stdout)

    if offenders:
        print("❌  New `.agent-src.uncondensed/` reference(s) added under src/ "
              "(the source of truth is `src/` — ADR-051):")
        for o in offenders:
            print(f"  🔴 {o}")
        print("\nFix: reference the real `src/` target. Existing stale prose is "
              "migrated opportunistically; do not ADD new dead-path references.")
        return 1

    print("✅  No new `.agent-src.uncondensed/` references added under src/.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
