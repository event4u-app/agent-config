#!/usr/bin/env python3
"""Fail if any ``.agent-settings.local.yml`` is tracked by git.

`.agent-settings.local.yml` is the per-developer, per-machine override layer
(see ``scripts/_lib/agent_settings.py`` ``LOCAL_PROJECT_FILE``). It is
gitignored on purpose — committing one would leak one developer's local
machine paths (e.g. linked-project siblings) into everyone's checkout.

Exit 0 when none are tracked, 1 (with the offending paths) otherwise.
"""

from __future__ import annotations

import subprocess
import sys

LOCAL_FILE = ".agent-settings.local.yml"


def tracked_local_settings() -> list[str]:
    try:
        out = subprocess.run(
            ["git", "ls-files"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout
    except (subprocess.CalledProcessError, FileNotFoundError):
        # Not a git repo / git missing — nothing to enforce here.
        return []
    return [
        line
        for line in out.splitlines()
        if line.split("/")[-1] == LOCAL_FILE
    ]


def main() -> int:
    offenders = tracked_local_settings()
    if not offenders:
        print(f"✅  No tracked {LOCAL_FILE} files.")
        return 0
    print(f"❌  {LOCAL_FILE} must never be committed (per-machine local layer):")
    for path in offenders:
        print(f"  🔴 {path}")
    print(f"\nRun: git rm --cached <path>  — and confirm {LOCAL_FILE} is gitignored.")
    return 1


if __name__ == "__main__":
    sys.exit(main())
