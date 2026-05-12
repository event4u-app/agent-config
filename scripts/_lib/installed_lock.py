"""Global-install lockfile at ``~/.config/agent-config/installed.lock``.

Phase 1.6 of road-to-global-first-install (ADR-007 D5). Records the
package version that performed the most recent user-scope install plus
the tools that were scaffolded. ``init --global`` reads this file: on
version mismatch the install refuses unless ``--force`` is passed; the
``update`` subcommand refreshes the entry in lockstep with the pin
flip in ``.agent-settings.yml``.

The schema is intentionally minimal YAML so the module can read and
write without depending on ``pyyaml``. Atomic writes go through
``tempfile + os.replace`` per ADR-007 risk-mitigation row.
"""
from __future__ import annotations

import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

LOCKFILE_ENV = "AGENT_CONFIG_INSTALLED_LOCK"
DEFAULT_LOCKFILE = Path.home() / ".config" / "agent-config" / "installed.lock"
SCHEMA_VERSION = 1

_VERSION_RE = re.compile(r'^\s*agent_config_version\s*:\s*"?([^"\s]+)"?\s*$')
_SCHEMA_RE = re.compile(r"^\s*schema_version\s*:\s*(\d+)\s*$")
_INSTALLED_AT_RE = re.compile(r'^\s*installed_at\s*:\s*"?([^"\s]+)"?\s*$')
_TOOL_RE = re.compile(r"^\s*-\s*([A-Za-z0-9_\-.]+)\s*$")


def lockfile_path(env: Optional[dict] = None) -> Path:
    """Return the active lockfile path, honoring the env override."""
    env = env if env is not None else os.environ
    override = env.get(LOCKFILE_ENV)
    if override:
        return Path(override).expanduser()
    return DEFAULT_LOCKFILE


def read_lockfile(path: Optional[Path] = None) -> Optional[dict]:
    """Parse ``path`` (or the default) into a dict; return ``None`` if absent.

    Tolerates partial / malformed files: missing keys yield missing dict
    entries rather than raising, so a hand-edited corrupt file does not
    brick ``init``.
    """
    target = path or lockfile_path()
    try:
        text = target.read_text(encoding="utf-8")
    except FileNotFoundError:
        return None
    except OSError:
        return None

    data: dict = {"tools": []}
    in_tools = False
    for raw_line in text.splitlines():
        if _SCHEMA_RE.match(raw_line):
            data["schema_version"] = int(_SCHEMA_RE.match(raw_line).group(1))
            in_tools = False
            continue
        if _VERSION_RE.match(raw_line):
            data["agent_config_version"] = _VERSION_RE.match(raw_line).group(1)
            in_tools = False
            continue
        if _INSTALLED_AT_RE.match(raw_line):
            data["installed_at"] = _INSTALLED_AT_RE.match(raw_line).group(1)
            in_tools = False
            continue
        if raw_line.strip().startswith("tools:"):
            in_tools = True
            continue
        if in_tools:
            m = _TOOL_RE.match(raw_line)
            if m:
                data["tools"].append(m.group(1))
            elif raw_line.strip() and not raw_line.startswith((" ", "\t", "-")):
                in_tools = False
    return data


def _render(version: str, tools: list[str], installed_at: str) -> str:
    lines = [
        f"schema_version: {SCHEMA_VERSION}",
        f'agent_config_version: "{version}"',
        f'installed_at: "{installed_at}"',
        "tools:",
    ]
    for tool in tools:
        lines.append(f"  - {tool}")
    return "\n".join(lines) + "\n"


def write_lockfile(
    version: str,
    tools: list[str],
    *,
    path: Optional[Path] = None,
    now: Optional[datetime] = None,
) -> Path:
    """Atomically write the lockfile; return the path written."""
    target = path or lockfile_path()
    target.parent.mkdir(parents=True, exist_ok=True)
    stamp = (now or datetime.now(timezone.utc)).strftime("%Y-%m-%dT%H:%M:%SZ")
    rendered = _render(version, sorted(set(tools)), stamp)
    # Atomic write: tempfile in the same dir + os.replace. The same-dir
    # constraint keeps the rename atomic across all POSIX filesystems
    # and Windows when the file already exists.
    fd, tmp_name = tempfile.mkstemp(
        prefix=".installed.lock.", dir=str(target.parent), text=False
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as fh:
            fh.write(rendered)
        os.replace(tmp_name, target)
    except Exception:
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise
    return target


def check_version(
    installed_version: str,
    *,
    path: Optional[Path] = None,
) -> tuple[bool, Optional[str]]:
    """Compare ``installed_version`` against the lockfile's recorded version.

    Returns ``(ok, recorded_version_or_none)``:
      * ``(True, None)``  — no lockfile yet; ``init`` may proceed.
      * ``(True, vX)``    — matches; ``init`` may proceed.
      * ``(False, vY)``   — mismatch; caller must refuse without ``--force``.
    """
    existing = read_lockfile(path=path)
    if existing is None:
        return True, None
    recorded = existing.get("agent_config_version")
    if not recorded:
        return True, None
    return (recorded == installed_version, recorded)


def current_package_version(repo_root: Optional[Path] = None) -> str:
    """Read ``version`` from the package's own ``package.json``."""
    if repo_root is None:
        repo_root = Path(__file__).resolve().parents[2]
    try:
        data = json.loads((repo_root / "package.json").read_text(encoding="utf-8"))
        version = data.get("version")
        if isinstance(version, str) and version.strip():
            return version.strip()
    except (OSError, ValueError, json.JSONDecodeError):
        pass
    return "0.0.0"
