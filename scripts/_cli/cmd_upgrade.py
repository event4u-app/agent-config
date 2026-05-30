"""``agent-config upgrade`` — fetch + install the latest global binary + refresh.

Distinct from ``agent-config update`` (which only flips the
``agent_config_version`` pin in ``.agent-settings.yml`` — a project
decision, see :mod:`scripts._cli.cmd_update`). ``upgrade`` is the
**global** self-update path mandated by ADR-020's "no per-repo bump"
goal: it installs the latest published package globally and re-runs the
global install so new skills / rules / hooks reach every consumer at
once.

Two side effects, in order:

1. ``npm install -g @event4u/agent-config@latest`` — refresh the global
   binary on PATH (the binary the Claude plugin hook resolves).
2. ``agent-config global`` (→ ``install.py --global``) — refresh the
   global root (``~/.event4u/agent-config/``) + regenerate plugin hooks.

The **Claude marketplace plugin** updates on Claude Code's own cadence,
independent of npm; ``upgrade`` cannot drive it. ``agent-config doctor``
surfaces binary↔plugin drift so the user knows when to update the plugin
from the marketplace.

Flags:

* ``--check`` — report installed vs latest; install nothing. Exit 0.
* ``--dry-run`` — print the exact commands that would run; execute none.
* (no flag) — perform the upgrade.

Exit codes: ``0`` success / already-latest / check / dry-run · ``1`` a
step failed.
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path
from typing import Callable, Optional

from scripts._lib import installed_lock, update_check

PACKAGE_NAME = "@event4u/agent-config"

# A runner is injected in tests so the global-mutating commands are never
# executed in CI / sandbox. Returns the subprocess return code.
Runner = Callable[[list[str]], int]


def _default_runner(cmd: list[str]) -> int:
    try:
        return subprocess.run(cmd, check=False).returncode
    except OSError as exc:  # npm / bash missing
        sys.stderr.write(f"agent-config upgrade: cannot run {cmd[0]}: {exc}\n")
        return 1


def _installed_version() -> str:
    lock = installed_lock.read_lockfile()
    if isinstance(lock, dict):
        v = lock.get("agent_config_version")
        if isinstance(v, str) and v:
            return v.strip().lstrip("v")
    return ""


def _agent_config_bin() -> str:
    """The global wrapper the second step invokes. Prefer the binary on
    PATH; fall back to the package-local wrapper so a maintainer dev-loop
    (no global install yet) still refreshes."""
    from shutil import which
    return which("agent-config") or str(
        Path(__file__).resolve().parents[2] / "agent-config")


def main(
    argv: Optional[list[str]] = None,
    *,
    runner: Runner = _default_runner,
    fetcher=update_check.fetch_latest_from_npm,
    installed: Optional[str] = None,
    out=sys.stdout,
    err=sys.stderr,
) -> int:
    parser = argparse.ArgumentParser(
        prog="agent-config upgrade",
        description="Install the latest @event4u/agent-config globally and "
                    "refresh the global install.",
    )
    parser.add_argument("--check", action="store_true",
                        help="Report installed vs latest; install nothing.")
    parser.add_argument("--dry-run", action="store_true",
                        help="Print the commands that would run; execute none.")
    args = parser.parse_args(argv)

    installed = installed if installed is not None else _installed_version()
    latest = fetcher() or ""

    if args.check:
        if not latest:
            print("agent-config upgrade: latest version unavailable "
                  "(registry unreachable).", file=err)
            return 0
        if installed and not installed_lock_is_newer(latest, installed):
            print(f"✅  agent-config is up to date ({installed}).", file=out)
        else:
            print(f"ℹ️  agent-config {latest} available "
                  f"(installed: {installed or 'unknown'}). Run "
                  f"`agent-config upgrade`.", file=out)
        return 0

    target = f"{PACKAGE_NAME}@latest"
    steps = [
        ["npm", "install", "-g", target],
        [_agent_config_bin(), "global"],
    ]

    if args.dry_run:
        print("agent-config upgrade — dry run, would execute:", file=out)
        for cmd in steps:
            print("  " + " ".join(cmd), file=out)
        return 0

    for cmd in steps:
        print("→ " + " ".join(cmd), file=out)
        rc = runner(cmd)
        if rc != 0:
            print(f"❌  agent-config upgrade: step failed (exit {rc}): "
                  f"{' '.join(cmd)}", file=err)
            return 1

    print("✅  agent-config upgraded. Run `agent-config doctor` to verify "
          "PATH + plugin parity.", file=out)
    return 0


def installed_lock_is_newer(latest: str, installed: str) -> bool:
    """Thin wrapper around update_check._is_newer for one import site."""
    return update_check._is_newer(latest, installed)


if __name__ == "__main__":
    raise SystemExit(main())
