#!/usr/bin/env python3
"""Regression guard: no NEW `.agent-src.uncondensed/` references in `src/`.

`.agent-src.uncondensed/` is the dead pre-relocation source path (the source of
truth moved to `src/`, ADR-051). Existing stale *prose* mentions in `src/` are
fixed opportunistically — a large blind sweep was rejected by AI-council
(2026-06-09): the path literal is also the *detection subject* of the reference
linters, so a blanket rewrite is a loaded gun, and historical ADRs are correct
as written. This guard stops the debt from *growing*: it fails when a diff
**adds** a new `.agent-src.uncondensed/` line under `src/`.

Files that legitimately contain the literal forever are exempt:
  - src/scripts/_lib/agent_src.py        (the LEGACY_SRC constant)
  - src/scripts/check_references.py       (forbidden-substring detector)
  - src/scripts/check_condensed_paths.py  (forbidden-substring detector)

Faithful-twin rule (Python→TypeScript migration): a `*.ts` file is also
exempt when a same-stem `*.py` sibling exists AND already contains the
literal. A TS twin that faithfully mirrors a pre-existing legacy
reference (e.g. agent_src.ts, install_regenerator.ts) is not a NEW
dead-path — the reference already lived in the ported `.py`. This
cannot mask a genuinely new dead-path: a fresh one introduced only in
a `.ts` has no `.py` sibling already carrying it.

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


def _is_faithful_twin(cur_file: str) -> bool:
    """True when `cur_file` is a `*.ts` whose same-stem `*.py` sibling exists
    and already references the legacy tree — a faithful TS port of a
    pre-existing legacy reference, not a new dead-path. The sibling check
    matches the bare directory name (`.agent-src.uncondensed`, no trailing
    slash) because the `.py` may reference it as a path SEGMENT
    (`root / ".agent-src.uncondensed"`) while the `.ts` twin / its comments
    use the slash form — both are the same faithful reference. Reads from
    disk relative to cwd (CI runs the guard at the repo root); injectable in
    tests via the `twin_check` param of `find_offenders`."""
    if not cur_file.endswith(".ts"):
        return False
    sibling = cur_file[:-3] + ".py"
    try:
        with open(sibling, encoding="utf-8") as fh:
            return LEGACY.rstrip("/") in fh.read()
    except OSError:
        return False


def _base() -> str:
    for i, a in enumerate(sys.argv):
        if a == "--base" and i + 1 < len(sys.argv):
            return sys.argv[i + 1]
    return "origin/main"


def find_offenders(diff_text: str, twin_check=_is_faithful_twin) -> list[str]:
    """Added (`+`) lines under a non-exempt src/ file that introduce the legacy
    path. Pure over the diff string except for the faithful-twin sibling check
    (`twin_check`, injectable for unit tests)."""
    cur_file = None
    offenders: list[str] = []
    for line in diff_text.splitlines():
        if line.startswith("+++ b/"):
            cur_file = line[6:]
            continue
        if line.startswith("+") and not line.startswith("+++"):
            # src/-scoped: a full diff (e.g. `gh pr diff`) carries every path;
            # only added lines under src/ (minus the exempt detectors and
            # faithful TS twins) count.
            if (cur_file and cur_file.startswith("src/")
                    and cur_file not in EXEMPT and LEGACY in line
                    and not twin_check(cur_file)):
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
