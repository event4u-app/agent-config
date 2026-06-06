#!/usr/bin/env python3
"""Fail when ``package.json.version`` and the project-template pin drift.

CI guard for P3.3 of road-to-portable-runtime-and-update-check.md.

A release bump of ``package.json`` must update
``agent_config_version`` in
``.agent-src.uncondensed/templates/agents/agent-project-settings.example.yml``
(and its condensed twin under ``dist/agent-src/``) in lockstep. Otherwise
a fresh ``init`` on a new project would bootstrap onto a stale pin,
and the pin-resolver would re-exec back to the older version.

Exit codes:
    0 — pin matches package.json.version (or pin is empty and the
        ``--allow-empty`` flag is set, used for early development).
    1 — pin missing, drift detected, or template file unreadable.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))
from _lib.agent_src import resolve_logical  # noqa: E402

PACKAGE_JSON = REPO_ROOT / "package.json"

# Source-of-truth template lives under whichever artefact root owns it
# (legacy .agent-src.uncondensed/ pre-move, packages/*/.agent-src.uncondensed/
# post-ADR-017). Condensed twin always lands at the flat dist/agent-src/ surface.
_TEMPLATE_LOGICAL = "templates/agents/agent-project-settings.example.yml"


def _template_files() -> tuple[Path, ...]:
    src = resolve_logical(_TEMPLATE_LOGICAL)
    files: list[Path] = []
    if src is not None:
        files.append(src)
    else:
        files.append(REPO_ROOT / ".agent-src.uncondensed" / _TEMPLATE_LOGICAL)
    files.append(REPO_ROOT / "dist/agent-src" / _TEMPLATE_LOGICAL)
    return tuple(files)
PIN_LINE_RE = re.compile(r"^\s*agent_config_version\s*:\s*\"?([^\"\s#]*)\"?")


def _read_package_version() -> str | None:
    try:
        data = json.loads(PACKAGE_JSON.read_text(encoding="utf-8"))
    except (OSError, ValueError, json.JSONDecodeError):
        return None
    version = data.get("version")
    return version.strip() if isinstance(version, str) else None


def _read_template_pin(path: Path) -> str | None:
    try:
        for line in path.read_text(encoding="utf-8").splitlines():
            match = PIN_LINE_RE.match(line)
            if match:
                return match.group(1).strip()
    except OSError:
        return None
    return None


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Fail when package.json version and template pin drift.",
    )
    parser.add_argument(
        "--allow-empty",
        action="store_true",
        help="Accept an empty pin (used during early-stage development).",
    )
    args = parser.parse_args(argv)

    pkg_version = _read_package_version()
    if not pkg_version:
        print("❌  check_template_pin_drift: failed to read package.json version.", file=sys.stderr)
        return 1

    failures: list[str] = []
    for template in _template_files():
        try:
            rel = template.relative_to(REPO_ROOT)
        except ValueError:
            rel = template
        if not template.is_file():
            failures.append(f"missing template file: {rel}")
            continue
        pin = _read_template_pin(template)
        if pin is None:
            failures.append(f"{rel}: no `agent_config_version:` line found")
            continue
        if pin == "":
            if not args.allow_empty:
                failures.append(
                    f"{rel}: agent_config_version is empty; expected {pkg_version}"
                )
            continue
        if pin != pkg_version:
            failures.append(
                f"{rel}: agent_config_version={pin!r} does not match package.json version {pkg_version!r}"
            )

    if failures:
        print(
            "❌  check_template_pin_drift: template pin drift detected.",
            file=sys.stderr,
        )
        for line in failures:
            print(f"    - {line}", file=sys.stderr)
        print(
            "    Fix: update `agent_config_version:` in the listed template(s) to "
            f"{pkg_version!r} before releasing.",
            file=sys.stderr,
        )
        return 1

    print(f"✅  template pin = package.json version ({pkg_version}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
