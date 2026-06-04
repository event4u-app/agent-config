#!/usr/bin/env python3
"""Thin CLI wrapper: emit the daily update-check banner to stderr.

Invoked by the ``scripts/agent-config`` dispatcher **after** a
subcommand finishes. Never raises, never exits non-zero — banner is
best-effort. See ``scripts/_lib/update_check.py`` for the decision
logic.

Usage:
    python3 scripts/check_update_banner.py [--installed-version X.Y.Z]

When ``--installed-version`` is omitted, reads ``package.json`` next to
the package root (``$PACKAGE_ROOT/package.json``).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "src"))

from scripts._lib import agent_settings  # noqa: E402
from scripts._lib import update_check  # noqa: E402


def _read_installed_version(package_root: Path) -> str:
    candidate = package_root / "package.json"
    try:
        data = json.loads(candidate.read_text(encoding="utf-8"))
        version = data.get("version")
        if isinstance(version, str) and version.strip():
            return version.strip()
    except (OSError, ValueError, json.JSONDecodeError):
        pass
    return ""


def _read_settings_flag(cwd: Path) -> bool:
    try:
        settings = agent_settings.load_agent_settings(cwd=cwd)
    except Exception:
        return True
    block = settings.get("update_check")
    if isinstance(block, dict) and block.get("enabled") is False:
        return False
    return True


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="check-update-banner", add_help=False)
    parser.add_argument("--installed-version", default="")
    parser.add_argument("--cwd", default=str(Path.cwd()))
    parser.add_argument("--help", "-h", action="store_true")
    args, _unknown = parser.parse_known_args(argv)
    if args.help:
        print(__doc__ or "")
        return 0

    installed = args.installed_version or _read_installed_version(ROOT)
    if not installed:
        return 0

    try:
        cwd = Path(args.cwd).resolve()
    except OSError:
        cwd = ROOT
    enabled = _read_settings_flag(cwd)

    try:
        banner = update_check.check_for_update(
            installed,
            settings_enabled=enabled,
        )
    except Exception:
        return 0

    if banner:
        print(banner, file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
