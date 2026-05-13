"""Daily update-check banner for the ``agent-config`` dispatcher.

Phase 2 of road-to-portable-runtime-and-update-check. Pure functions:
``check_for_update()`` decides whether a banner should be emitted and
returns the banner string (or ``None``). The dispatcher prints the
returned string to ``stderr`` after the subcommand finishes — never
delaying the work, never prompting.

Design constraints (see roadmap P2):

- Stdlib only (no new deps); the package's Python floor is stdlib-only.
- 1 s hard timeout on the registry call; network failure is silent.
- 24 h cadence gated by ``~/.event4u/agent-config/update-check.json``
  (legacy ``~/.config/agent-config/update-check.json`` is read once as
  a fallback so the cadence is not reset on the first run after the
  Phase-1 namespace migration).
- Suppress in CI, on non-TTY stdout, when ``AGENT_CONFIG_NO_UPDATE_CHECK=1``,
  or when ``update_check.enabled: false`` in settings.
- State file mode is ``0600``.

The dispatcher is the only call site. Tests mock ``now``, the state
path, and ``fetch_latest_from_npm`` to cover every branch.
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from scripts._lib import user_global_paths

PACKAGE_NAME = "@event4u/agent-config"
NPM_REGISTRY_URL = f"https://registry.npmjs.org/{PACKAGE_NAME}/latest"
FETCH_TIMEOUT_S = 1.0
CHECK_WINDOW = timedelta(hours=24)

STATE_FILENAME = "update-check.json"

#: Canonical write target. Reads are routed via
#: :func:`_resolve_state_path` with a read-fallback to the legacy
#: ``~/.config/agent-config/update-check.json`` so a fresh install
#: under the new namespace does not lose the 24 h cadence window
#: established by a pre-2.4 install.
DEFAULT_STATE_PATH = user_global_paths.write_target(STATE_FILENAME)


def _resolve_state_path() -> Path:
    """Return the active state path, preferring the new namespace."""
    found = user_global_paths.resolve_with_fallback(STATE_FILENAME)
    if found is not None:
        return found
    return DEFAULT_STATE_PATH


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def fetch_latest_from_npm(
    *,
    timeout: float = FETCH_TIMEOUT_S,
    url: str = NPM_REGISTRY_URL,
) -> Optional[str]:
    """Return the ``latest`` dist-tag version, or ``None`` on any failure.

    Hard 1 s timeout. Any exception (network, JSON, missing key) yields
    ``None`` — the update check is best-effort.
    """
    try:
        req = urllib.request.Request(
            url,
            headers={"Accept": "application/json", "User-Agent": "agent-config-update-check"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 — fixed URL
            payload = json.load(resp)
        version = payload.get("version")
        if isinstance(version, str) and version.strip():
            return version.strip()
    except (urllib.error.URLError, TimeoutError, ValueError, OSError, json.JSONDecodeError):
        return None
    return None


def _read_state(path: Path) -> dict:
    try:
        with path.open("r", encoding="utf-8") as fh:
            data = json.load(fh)
        if isinstance(data, dict):
            return data
    except (OSError, ValueError, json.JSONDecodeError):
        pass
    return {}


def _write_state(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix=".update-check-", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            json.dump(payload, fh, indent=2, sort_keys=True)
        os.chmod(tmp, 0o600)
        os.replace(tmp, path)
    except Exception:
        try:
            os.unlink(tmp)
        except OSError:
            pass
        raise


def _should_check(state: dict, now: datetime) -> bool:
    last = state.get("last_check_utc")
    if not isinstance(last, str):
        return True
    try:
        last_dt = datetime.fromisoformat(last.replace("Z", "+00:00"))
    except ValueError:
        return True
    if last_dt.tzinfo is None:
        last_dt = last_dt.replace(tzinfo=timezone.utc)
    return (now - last_dt) >= CHECK_WINDOW


def _format_banner(latest: str, installed: str) -> str:
    return (
        f"ℹ️  agent-config {latest} available (you have {installed}).\n"
        f"    Update: npx {PACKAGE_NAME} update"
    )


def _is_newer(latest: str, installed: str) -> bool:
    def _parse(v: str) -> tuple:
        parts = v.lstrip("v").split("-", 1)[0].split(".")
        out = []
        for p in parts[:3]:
            try:
                out.append(int(p))
            except ValueError:
                out.append(0)
        while len(out) < 3:
            out.append(0)
        return tuple(out)

    return _parse(latest) > _parse(installed)


def check_for_update(
    installed_version: str,
    *,
    now: Optional[datetime] = None,
    state_path: Optional[Path] = None,
    env: Optional[dict] = None,
    is_tty: Optional[bool] = None,
    settings_enabled: bool = True,
    fetcher=fetch_latest_from_npm,
) -> Optional[str]:
    """Decide whether to show an update banner. Pure (modulo state file).

    Returns the banner string or ``None``. ``None`` covers every
    suppression branch (CI, non-TTY, opt-out, within 24 h, network
    failure, no update available).
    """
    env = env if env is not None else os.environ
    if env.get("AGENT_CONFIG_NO_UPDATE_CHECK") == "1":
        return None
    if env.get("CI") in {"1", "true"} or env.get("GITHUB_ACTIONS") == "true":
        return None
    if not settings_enabled:
        return None
    if is_tty is None:
        is_tty = sys.stdout.isatty()
    if not is_tty:
        return None

    now = now or _now_utc()
    # When the caller does not pin a state path, route through the
    # fallback resolver so a pre-2.4 install's cadence file is still
    # consulted before we decide to re-check npm.
    read_path = state_path or _resolve_state_path()
    write_path = state_path or DEFAULT_STATE_PATH
    state = _read_state(read_path)
    if not _should_check(state, now):
        latest = state.get("last_seen_version")
        if isinstance(latest, str) and _is_newer(latest, installed_version):
            return _format_banner(latest, installed_version)
        return None

    latest = fetcher()
    payload = {
        "last_check_utc": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "last_seen_version": latest or state.get("last_seen_version", ""),
        "installed_version": installed_version,
    }
    try:
        _write_state(write_path, payload)
    except OSError:
        pass

    if not latest or not _is_newer(latest, installed_version):
        return None
    return _format_banner(latest, installed_version)
