"""``agent-config versions`` — list available package versions (Phase 4.1).

Queries the npm registry for available versions of
``@event4u/agent-config`` and prints them. Marks the current pin
(from ``.agent-settings.yml`` ``agent_config_version``) and the latest
published version.

Offline-tolerant: when ``--offline`` is passed or the registry is
unreachable, falls back to reading the local ``package.json`` version
and prints a single-line notice instead of failing.
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

from scripts._lib.agent_settings import project_settings_path, resolve_project_root

PACKAGE_NAME = "@event4u/agent-config"


def _project_root() -> Path:
    """Resolve the consumer project root via the Phase-3 helper.

    Honors ``AGENT_CONFIG_PROJECT_ROOT`` and the Step-7 anchor walk so
    ``agent-config versions`` invoked from a subdir reads the correct
    ``.agent-settings.yml`` / ``package.json``.
    """
    root, _ = resolve_project_root(None)
    return root


def _local_package_version() -> str:
    """Return ``version`` from the local ``package.json``, or ``""`` if absent."""
    candidates = [
        Path(__file__).resolve().parents[2] / "package.json",
        _project_root() / "package.json",
    ]
    for p in candidates:
        if p.exists():
            try:
                return str(json.loads(p.read_text()).get("version", ""))
            except (json.JSONDecodeError, OSError):
                continue
    return ""


def _pinned_version() -> str:
    """Return the ``agent_config_version`` pin from ``.agent-settings.yml``."""
    settings = project_settings_path(_project_root())
    if not settings.exists():
        return ""
    try:
        for line in settings.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line.startswith("agent_config_version"):
                _, _, rhs = line.partition(":")
                return rhs.strip().strip('"').strip("'")
    except OSError:
        pass
    return ""


def _query_npm() -> list[str]:
    """Run ``npm view <pkg> versions --json``; return parsed list or ``[]``."""
    try:
        proc = subprocess.run(
            ["npm", "view", PACKAGE_NAME, "versions", "--json"],
            capture_output=True, text=True, timeout=15,
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return []
    if proc.returncode != 0:
        return []
    try:
        data = json.loads(proc.stdout)
    except json.JSONDecodeError:
        return []
    if isinstance(data, str):
        return [data]
    if isinstance(data, list):
        return [str(v) for v in data]
    return []


def _format_table(versions: list[str], current: str, pinned: str, limit: int) -> str:
    rows: list[str] = []
    head = versions[-limit:] if limit > 0 else versions
    for v in head:
        marks = []
        if v == pinned:
            marks.append("← pinned")
        if v == current:
            marks.append("← latest")
        suffix = ("  " + " ".join(marks)) if marks else ""
        rows.append(f"  {v}{suffix}")
    return "\n".join(rows)


def _parse(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="agent-config versions",
        description="List available @event4u/agent-config versions on npm.",
    )
    parser.add_argument("--offline", action="store_true",
                        help="skip npm registry query; only show local package + pin")
    parser.add_argument("--limit", type=int, default=20,
                        help="show only the N most recent versions (default: 20; 0 = all)")
    parser.add_argument("--json", dest="as_json", action="store_true",
                        help="machine-readable output: {pinned, local, latest, versions[]}")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    opts = _parse(list(argv) if argv is not None else sys.argv[1:])

    # AGENT_CONFIG_OFFLINE=1 (set by `install.py --offline`) is honored
    # as a global kill-switch even when the per-command --offline flag
    # is absent. Keeps the env-driven offline contract consistent.
    offline = opts.offline or os.environ.get("AGENT_CONFIG_OFFLINE") == "1"

    local = _local_package_version()
    pinned = _pinned_version()
    versions: list[str] = []
    if not offline:
        versions = _query_npm()
    latest = versions[-1] if versions else local

    if opts.as_json:
        print(json.dumps({
            "pinned": pinned,
            "local": local,
            "latest": latest,
            "versions": versions,
            "source": "npm" if versions else "local",
        }, indent=2))
        return 0

    print(f"package: {PACKAGE_NAME}")
    print(f"pinned:  {pinned or '— (no .agent-settings.yml)'}")
    print(f"local:   {local or '—'}")
    if not versions:
        if offline:
            print("offline mode — registry query skipped")
        else:
            print("⚠️   npm registry unreachable; showing local only")
        return 0
    print(f"latest:  {latest}")
    print()
    print(f"available versions ({'last ' + str(opts.limit) if opts.limit > 0 else 'all'}):")
    print(_format_table(versions, latest, pinned, opts.limit))
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
