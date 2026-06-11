#!/usr/bin/env python3
"""Differential-test driver for the agent_src TS twin (ADR-088 parity gate 2).

Usage: ``agent_src_py_driver.py <synthetic_root> <function> [arg]``

Points the real ``src/scripts/_lib/agent_src`` module's root attributes at
``<synthetic_root>`` (mirroring exactly what the TS twin's ``_setRootsForTest``
does), then calls ``<function>`` and writes its result to stdout as JSON so
``tests/lib/agent_src.test.ts`` can assert TS == Python byte-for-byte over the
logical contract.

Physical paths in results are emitted RELATIVE to ``<synthetic_root>`` (POSIX)
so the two implementations are comparable regardless of absolute prefix.

Supported functions:
  artefact_roots
  iter_artefacts            (optional arg: suffix, default ".md")
  iter_all_sources
  iter_commands
  resolve_logical <logical_rel>
  logical_relpath <abs_or_rel_path>
  strip_source_prefix <rel>
  is_artefact_path <rel>
  resolve_package_core_path <rel>
  pack_slug_prefix <pack_id>
  command_slug <abs_path>
"""
from __future__ import annotations

import json
import pathlib
import sys

DRIVER = pathlib.Path(__file__).resolve()
REPO_ROOT = DRIVER.parents[2]
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))

from _lib import agent_src as A  # noqa: E402


def _retarget(root: pathlib.Path) -> None:
    """Reassign every root attribute the way the TS twin's _setRootsForTest does."""
    A.ROOT = root
    A.LEGACY_SRC = root / ".agent-src.uncondensed"
    A.PACKAGES = root / "packages"
    A.PACKAGE_CORE = A.PACKAGES / "core"
    A.SRC = root / "src"
    A.SRC_SKILLS = A.SRC / "skills"
    A.SRC_RULES = A.SRC / "rules"
    A.SRC_AGENT = A.SRC / "agent-src"
    A.SRC_DOMAINS = A.SRC / "domains"
    A._slug_prefix_cache.clear()


def _relposix(root: pathlib.Path, p) -> str:
    pp = pathlib.Path(p)
    try:
        return pp.relative_to(root).as_posix()
    except ValueError:
        return pp.as_posix()


def main() -> int:
    root = pathlib.Path(sys.argv[1]).resolve()
    fn = sys.argv[2]
    arg = sys.argv[3] if len(sys.argv) > 3 else None
    _retarget(root)

    result: object
    if fn == "artefact_roots":
        result = [_relposix(root, p) for p in A.artefact_roots()]
    elif fn == "iter_artefacts":
        suffix = arg if arg is not None else ".md"
        result = [_relposix(root, p) for p in A.iter_artefacts(suffix)]
    elif fn == "iter_all_sources":
        result = [[_relposix(root, p), rel] for p, rel in A.iter_all_sources()]
    elif fn == "iter_commands":
        result = [_relposix(root, p) for p in A.iter_commands()]
    elif fn == "resolve_logical":
        r = A.resolve_logical(arg or "")
        result = None if r is None else _relposix(root, r)
    elif fn == "logical_relpath":
        try:
            result = {"ok": A.logical_relpath(pathlib.Path(arg or ""))}
        except ValueError as exc:
            result = {"error": str(exc)}
    elif fn == "strip_source_prefix":
        result = A.strip_source_prefix(arg or "")
    elif fn == "is_artefact_path":
        result = A.is_artefact_path(arg or "")
    elif fn == "resolve_package_core_path":
        result = _relposix(root, A.resolve_package_core_path(arg or ""))
    elif fn == "pack_slug_prefix":
        result = A.pack_slug_prefix(arg or "")
    elif fn == "command_slug":
        result = A.command_slug(pathlib.Path(arg or ""))
    else:
        sys.stderr.write(f"unknown function: {fn}\n")
        return 2

    sys.stdout.write(json.dumps(result, sort_keys=True))
    sys.stdout.flush()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
