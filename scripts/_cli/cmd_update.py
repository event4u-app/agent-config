"""``agent-config update`` — explicit, opt-in update of the version pin.

Phase 3 of road-to-portable-runtime-and-update-check (P3.1). The
command is the only user-driven path that flips
``agent_config_version`` in ``.agent-settings.yml``; the daily banner
(P2) never writes settings files.

Flags:

* ``--check`` — print the available latest version + return; no write.
* ``--to <version>`` — pin to an exact version (registry-existence
  checked). Downgrades are allowed; the pin is a project decision.
* (no flag) — pin to the registry's ``latest`` tag.

Write target: the **deepest** ``.agent-settings.yml`` in the project
cascade that already carries the ``agent_config_version`` key. When no
file carries it, the repo-root file is created/edited. Comments and
key ordering are preserved by line-based substitution.

The npx cache is warmed via
``npx --yes @event4u/agent-config@<new> --version`` so the next
invocation is offline-fast. The P2 state file is refreshed in
lockstep — the new ``installed_version`` is recorded so the banner
does not yell about the old pin.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from scripts._lib import installed_lock, update_check
from scripts._lib.agent_settings import (
    DEFAULT_PROJECT_FILE,
    _resolve_cascade_paths,
    find_project_root,
)

PACKAGE_NAME = "@event4u/agent-config"
PIN_KEY = "agent_config_version"
REGISTRY_VERSION_URL = f"https://registry.npmjs.org/{PACKAGE_NAME}/{{version}}"
PIN_LINE_RE = re.compile(r"^(\s*agent_config_version\s*:\s*)(.*)$")


def _normalize(version: str) -> str:
    return version.strip().lstrip("v")


def _registry_has_version(version: str, *, timeout: float = 1.0) -> bool:
    url = REGISTRY_VERSION_URL.format(version=_normalize(version))
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310
            return resp.status == 200
    except (urllib.error.URLError, TimeoutError, OSError):
        return False


def _find_pin_file(cwd: Path) -> Path:
    """Return the deepest cascade file that carries the pin, else repo root."""
    cascade = _resolve_cascade_paths(cwd, None)
    for path in reversed(cascade):
        if path.is_file() and _read_pin_line(path) is not None:
            return path
    # No file carries it — pick the repo-root cascade entry (shallowest).
    if cascade:
        return cascade[0]
    return cwd / DEFAULT_PROJECT_FILE


def _read_pin_line(path: Path) -> Optional[int]:
    try:
        with path.open("r", encoding="utf-8") as fh:
            for idx, line in enumerate(fh):
                if PIN_LINE_RE.match(line):
                    return idx
    except OSError:
        return None
    return None


def _write_pin(path: Path, new_version: str) -> bool:
    """Rewrite the pin in ``path``; return ``True`` if the file changed."""
    target = f'agent_config_version: "{_normalize(new_version)}"\n'
    try:
        lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
    except FileNotFoundError:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(target, encoding="utf-8")
        return True
    for idx, line in enumerate(lines):
        if PIN_LINE_RE.match(line):
            if lines[idx] == target:
                return False
            lines[idx] = target
            path.write_text("".join(lines), encoding="utf-8")
            return True
    # File exists but has no pin line — append at end.
    if lines and not lines[-1].endswith("\n"):
        lines.append("\n")
    lines.append(target)
    path.write_text("".join(lines), encoding="utf-8")
    return True


def _warm_npx_cache(version: str, *, runner=subprocess.run) -> None:
    try:
        runner(
            ["npx", "--yes", f"{PACKAGE_NAME}@{_normalize(version)}", "--version"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=120,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        pass


def _refresh_state(installed: str, latest: str, state_path: Path) -> None:
    state = update_check._read_state(state_path)
    payload = {
        "last_check_utc": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "last_seen_version": latest,
        "installed_version": installed,
    }
    state.update(payload)
    try:
        update_check._write_state(state_path, state)
    except OSError:
        pass


def main(
    argv: Optional[list[str]] = None,
    *,
    cwd: Optional[Path] = None,
    installed_version: Optional[str] = None,
    fetcher=update_check.fetch_latest_from_npm,
    version_checker=_registry_has_version,
    cache_warmer=_warm_npx_cache,
    state_path: Optional[Path] = None,
    out=sys.stdout,
    err=sys.stderr,
) -> int:
    """Entry point. ``scripts/agent-config`` dispatches here."""
    parser = argparse.ArgumentParser(
        prog="agent-config update",
        description="Update the agent_config_version pin in .agent-settings.yml.",
    )
    parser.add_argument("--check", action="store_true",
                        help="Print the latest available version and exit. No file is written.")
    parser.add_argument("--to", metavar="VERSION",
                        help="Pin to an explicit version (registry-existence checked).")
    parser.add_argument("--offline", action="store_true",
                        help="Skip the npm registry check; requires --to <version> "
                             "(without --to there is no source for 'latest').")
    args = parser.parse_args(argv)

    cwd = (cwd or Path.cwd()).resolve()
    installed_version = installed_version or _detect_installed_version()
    state_path = state_path or update_check.DEFAULT_STATE_PATH

    # AGENT_CONFIG_OFFLINE=1 (set by `install.py --offline`) is honored
    # as an env-level kill-switch. Mirrors cmd_versions.py.
    offline = args.offline or os.environ.get("AGENT_CONFIG_OFFLINE") == "1"

    if offline and not args.to:
        print(
            "❌  agent-config: --offline requires --to <version> "
            "(no registry, no 'latest' to fetch).",
            file=err,
        )
        return 1

    if args.to:
        target = _normalize(args.to)
        if offline:
            # Trust the caller; air-gapped env can't reach the registry.
            latest = target
        elif not version_checker(target):
            print(
                f"❌  agent-config: version {target} not found on the npm registry.",
                file=err,
            )
            return 1
        else:
            latest = target
    else:
        latest = fetcher()
        if not latest:
            print(
                "❌  agent-config: failed to fetch latest version from the npm registry.",
                file=err,
            )
            return 1
        latest = _normalize(latest)

    if args.check:
        if update_check._is_newer(latest, installed_version):
            print(f"agent-config {latest} available (you have {installed_version}).", file=out)
            print(f"Update: npx {PACKAGE_NAME} update", file=out)
        else:
            print(f"agent-config is up to date ({installed_version}).", file=out)
        return 0

    pin_file = _find_pin_file(cwd)
    changed = _write_pin(pin_file, latest)
    try:
        rel = pin_file.relative_to(cwd)
    except ValueError:
        rel = pin_file

    if changed:
        print(f"✅  Pinned {PACKAGE_NAME} to {latest} in {rel}.", file=out)
    else:
        print(f"ℹ️  {rel} already pins to {latest}.", file=out)

    # `npx --yes <pkg>@<v> --version` would hit the registry; skip it
    # offline so the air-gap guarantee holds end-to-end.
    if not offline:
        cache_warmer(latest)
    _refresh_state(latest, latest, state_path)
    _refresh_global_lockfile(latest, out=out)
    return 0


def _refresh_global_lockfile(version: str, *, out=sys.stdout) -> None:
    """Update the global ``installed.lock`` if it exists.

    Resolution prefers ``~/.event4u/agent-config/installed.lock`` and
    falls back to the legacy ``~/.config/agent-config/installed.lock``.

    Phase 1.6 — the lockfile is only present when the user has run a
    global install; we never create one here, but we keep it in lockstep
    when ``update`` flips the pin. Atomic write goes through
    ``installed_lock.write_lockfile``.
    """
    read_path = installed_lock.lockfile_path()
    write_path = installed_lock.lockfile_write_path()
    existing = installed_lock.read_lockfile(path=read_path)
    if existing is None:
        return
    recorded = existing.get("agent_config_version")
    tools = list(existing.get("tools", []))
    if recorded == version and read_path == write_path:
        print(f"ℹ️  {write_path} already records {version}.", file=out)
        return
    installed_lock.write_lockfile(version, tools, path=write_path)
    print(f"✅  Refreshed global lockfile at {write_path}.", file=out)


def _detect_installed_version() -> str:
    """Read ``version`` from the package's own ``package.json``."""
    pkg_json = Path(__file__).resolve().parents[2] / "package.json"
    try:
        data = json.loads(pkg_json.read_text(encoding="utf-8"))
        version = data.get("version")
        if isinstance(version, str) and version.strip():
            return version.strip()
    except (OSError, ValueError, json.JSONDecodeError):
        pass
    return "0.0.0"


if __name__ == "__main__":  # pragma: no cover
    sys.exit(main())

