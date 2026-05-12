"""Pin-aware version resolver for the ``agent-config`` dispatcher.

Phase 3 of road-to-portable-runtime-and-update-check (P3.2). The
dispatcher consults this module **before** doing any work. If
``.agent-settings.yml`` carries a non-empty ``agent_config_version``
pin and the currently running package version does not match, the
process re-execs via ``npx @event4u/agent-config@<pin> <argv>``.

Determinism is the goal: a consumer's ``npx`` cache may resolve to a
different version than the project pinned to, and the resolver
guarantees the pinned version is the one that actually runs.

Escape hatch: ``AGENT_CONFIG_NO_PIN_REEXEC=1`` disables the re-exec
entirely (used for local development of the package itself and for
the recursion guard described below).

Recursion guard: the parent sets ``AGENT_CONFIG_PIN_REEXEC_DEPTH=1``
on the child env so the re-exec'd child does not loop if the freshly
spawned ``npx`` resolves to a still-mismatched version. One re-exec
per process, full stop.
"""
from __future__ import annotations

import os
import shutil
import sys
from pathlib import Path
from typing import Optional

PACKAGE_NAME = "@event4u/agent-config"
PIN_KEY = "agent_config_version"
NO_REEXEC_ENV = "AGENT_CONFIG_NO_PIN_REEXEC"
REEXEC_DEPTH_ENV = "AGENT_CONFIG_PIN_REEXEC_DEPTH"


def _normalize(version: str) -> str:
    return version.strip().lstrip("v")


def read_pin(cwd: Path, *, settings_loader=None) -> Optional[str]:
    """Return the pinned version from the cascaded settings, or ``None``.

    Empty string and missing key both yield ``None``.
    """
    if settings_loader is None:
        from scripts._lib import agent_settings  # local import (test override)

        settings_loader = agent_settings.load_agent_settings

    try:
        settings = settings_loader(cwd=cwd)
    except Exception:
        return None
    raw = settings.get(PIN_KEY)
    if not isinstance(raw, str):
        return None
    pin = raw.strip()
    return pin or None


def should_reexec(
    pin: Optional[str],
    installed: str,
    *,
    env: Optional[dict] = None,
) -> bool:
    """Pure predicate: do we need to re-exec under the pinned version?"""
    env = env if env is not None else os.environ
    if env.get(NO_REEXEC_ENV) == "1":
        return False
    if env.get(REEXEC_DEPTH_ENV) == "1":
        return False
    if not pin:
        return False
    if not installed:
        return False
    return _normalize(pin) != _normalize(installed)


def build_reexec_argv(pin: str, argv: list[str]) -> list[str]:
    """Build the ``npx`` argv that re-execs at the pinned version."""
    return ["npx", "--yes", f"{PACKAGE_NAME}@{_normalize(pin)}", *argv]


def maybe_reexec(
    installed: str,
    *,
    cwd: Optional[Path] = None,
    argv: Optional[list[str]] = None,
    env: Optional[dict] = None,
    runner=None,
) -> Optional[int]:
    """Re-exec at the pinned version if needed; return the child exit code.

    Returns ``None`` when no re-exec is performed (caller continues).
    The injected ``runner`` covers the test path — defaults to
    :func:`os.execvpe` on real invocations.
    """
    cwd = cwd or Path.cwd()
    argv = argv if argv is not None else sys.argv
    env = env if env is not None else os.environ

    pin = read_pin(cwd)
    if not should_reexec(pin, installed, env=env):
        return None

    assert pin is not None  # narrowed by should_reexec
    npx = shutil.which("npx")
    if not npx:
        # Cannot re-exec without npx — silently fall back to running
        # the locally-installed version. Better to do something than
        # to die because of a missing CLI.
        return None

    new_argv = build_reexec_argv(pin, argv[1:] if argv else [])
    child_env = dict(env)
    child_env[REEXEC_DEPTH_ENV] = "1"

    if runner is None:
        # Replace the current process; never returns on success.
        os.execvpe(npx, new_argv, child_env)
        return 1  # unreachable on POSIX
    return runner(npx, new_argv, child_env)


def _parse_cli(argv: list[str]) -> tuple[Path, str, list[str]]:
    """Parse the dispatcher-facing argv: ``--cwd X --installed Y -- ARGS``."""
    cwd = Path.cwd()
    installed = ""
    forward: list[str] = []
    i = 0
    while i < len(argv):
        token = argv[i]
        if token == "--cwd" and i + 1 < len(argv):
            cwd = Path(argv[i + 1])
            i += 2
        elif token == "--installed" and i + 1 < len(argv):
            installed = argv[i + 1]
            i += 2
        elif token == "--":
            forward = argv[i + 1:]
            break
        else:
            i += 1
    return cwd, installed, forward


if __name__ == "__main__":  # pragma: no cover
    cwd, installed, forward = _parse_cli(sys.argv[1:])
    # Build the argv the child should see: ``agent-config <forward...>``.
    child_argv = ["agent-config", *forward]
    maybe_reexec(installed, cwd=cwd, argv=child_argv)
