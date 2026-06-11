#!/usr/bin/env python3
"""Differential-test driver for the agents_overlay TS twin (ADR-088 parity gate).

Usage:
  ``agents_overlay_py_driver.py <user_global_agents_dir> <name> <kind> <cwd>``

Imports the real ``scripts._lib.agents_overlay`` module from ``<repo>/src``
(the same module the pytest suite uses), retargets ``USER_GLOBAL_AGENTS_DIR``
the way the pytest ``_isolated_user_global`` fixture does (so the user-global
layer points at a tmp tree instead of the developer's real home), runs
``resolve_overlay``, and writes the result to stdout as JSON.

The resolved path is emitted RELATIVE to ``<cwd>`` (POSIX) when it sits under
``<cwd>`` so TS and Python are comparable regardless of absolute prefix; a
user-global hit is emitted relative to ``<user_global_agents_dir>`` with a
``user-global:`` prefix; ``None`` stays ``None``.
"""
from __future__ import annotations

import json
import pathlib
import sys

DRIVER = pathlib.Path(__file__).resolve()
REPO_ROOT = DRIVER.parents[2]
sys.path.insert(0, str(REPO_ROOT / "src"))

from scripts._lib import agents_overlay as ao  # noqa: E402


def _relposix(root: pathlib.Path, p: pathlib.Path) -> str:
    try:
        return p.relative_to(root).as_posix()
    except ValueError:
        return p.as_posix()


def main() -> int:
    user_global_agents_dir = pathlib.Path(sys.argv[1])
    name = sys.argv[2]
    kind = sys.argv[3]
    cwd = pathlib.Path(sys.argv[4])

    # Mirror the _isolated_user_global fixture: redirect only the new-namespace
    # attribute, leaving the legacy attribute at the developer's real home.
    ao.USER_GLOBAL_AGENTS_DIR = user_global_agents_dir

    try:
        resolved = ao.resolve_overlay(name, kind, cwd)
    except ValueError as exc:
        sys.stdout.write(json.dumps({"error": str(exc)}, sort_keys=True))
        sys.stdout.flush()
        return 0

    if resolved is None:
        out: object = None
    else:
        resolved = resolved.resolve() if resolved.exists() else resolved
        cwd_resolved = cwd.resolve() if cwd.exists() else cwd
        ug_resolved = (
            user_global_agents_dir.resolve()
            if user_global_agents_dir.exists()
            else user_global_agents_dir
        )
        try:
            out = resolved.relative_to(cwd_resolved).as_posix()
        except ValueError:
            try:
                out = "user-global:" + resolved.relative_to(ug_resolved).as_posix()
            except ValueError:
                out = resolved.as_posix()

    sys.stdout.write(json.dumps({"path": out}, sort_keys=True))
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
