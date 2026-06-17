"""Global-install lockfile at ``~/.event4u/agent-config/installed.lock``.

Phase 1.6 of road-to-global-first-install (ADR-007 D5). Records the
package version that performed the most recent user-scope install plus
the tools that were scaffolded. ``init --global`` reads this file: on
version mismatch the install refuses unless ``--force`` is passed; the
``update`` subcommand refreshes the entry in lockstep with the pin
flip in ``.agent-settings.yml``.

The schema is intentionally minimal YAML so the module can read and
write without depending on ``pyyaml``. Atomic writes go through
``tempfile + os.replace`` per ADR-007 risk-mitigation row.

Path resolution is delegated to :mod:`scripts._lib.user_global_paths`
(Phase 1 of road-to-event4u-namespace-and-claude-desktop.md): writes
land at ``~/.event4u/agent-config/installed.lock``; reads fall back to
the legacy ``~/.config/agent-config/installed.lock`` if the new path
is missing, so pre-2.4 installs keep working during the transition.
"""
from __future__ import annotations

import json
import os
import re
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from scripts._lib import user_global_paths
from scripts._lib.install_layout import (
    INSTALL_LAYOUT_VERSION,
    coerce_layout_version,
    needs_migration,
)

LOCKFILE_ENV = "AGENT_CONFIG_INSTALLED_LOCK"
SCHEMA_VERSION = 1


def _default_lockfile() -> Path:
    """Canonical write target for the lockfile (new namespace)."""
    return user_global_paths.write_target("installed.lock")


# Module-level constant retained for back-compat with importers that read
# ``installed_lock.DEFAULT_LOCKFILE`` directly. Derived from the helper so
# the path tracks any future override of ``event4u_root()``.
DEFAULT_LOCKFILE = _default_lockfile()

_VERSION_RE = re.compile(r'^\s*agent_config_version\s*:\s*"?([^"\s]+)"?\s*$')
_SCHEMA_RE = re.compile(r"^\s*schema_version\s*:\s*(\d+)\s*$")
_LAYOUT_RE = re.compile(r"^\s*install_layout_version\s*:\s*(\d+)\s*$")
_INSTALLED_AT_RE = re.compile(r'^\s*installed_at\s*:\s*"?([^"\s]+)"?\s*$')
_TOOL_RE = re.compile(r"^\s*-\s*([A-Za-z0-9_\-.]+)\s*$")


def lockfile_path(env: Optional[dict] = None) -> Path:
    """Return the active lockfile path for **reads**, honoring overrides.

    Resolution order:

    1. ``$AGENT_CONFIG_INSTALLED_LOCK``  — explicit full-path override.
    2. ``~/.event4u/agent-config/installed.lock`` if it exists on disk.
    3. ``~/.config/agent-config/installed.lock``  (legacy fallback, read-only).
    4. Canonical write target under the new namespace (Step 2 fallthrough).

    Readers benefit from (3) so pre-2.4 installs keep working while the
    migration shim has not yet run. Writers must use
    :func:`lockfile_write_path` so a stale legacy file does not anchor
    subsequent writes to the deprecated location.
    """
    env = env if env is not None else os.environ
    override = env.get(LOCKFILE_ENV)
    if override:
        return Path(override).expanduser()
    resolved = user_global_paths.resolve_with_fallback("installed.lock", env=env)
    if resolved is not None:
        return resolved
    return user_global_paths.write_target("installed.lock", env=env)


def lockfile_write_path(env: Optional[dict] = None) -> Path:
    """Return the canonical write target for the lockfile.

    Unlike :func:`lockfile_path`, this never falls back to the legacy
    ``~/.config/agent-config/`` location. Honors the
    ``$AGENT_CONFIG_INSTALLED_LOCK`` override for tests, otherwise pins
    to ``~/.event4u/agent-config/installed.lock``. Callers in
    ``init``, ``update``, and ``uninstall`` use this so writes always
    land in the new namespace regardless of whether a stale legacy
    lockfile is still present.
    """
    env = env if env is not None else os.environ
    override = env.get(LOCKFILE_ENV)
    if override:
        return Path(override).expanduser()
    return user_global_paths.write_target("installed.lock", env=env)


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
        if _LAYOUT_RE.match(raw_line):
            data["install_layout_version"] = int(_LAYOUT_RE.match(raw_line).group(1))
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
        f"install_layout_version: {INSTALL_LAYOUT_VERSION}",
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


def _parse_installed_at(stamp: Optional[str]) -> Optional[datetime]:
    """Parse the lockfile's ``installed_at`` stamp back into a UTC datetime.

    Returns ``None`` when absent or malformed, so a migration falls back to
    the current time rather than raising on a hand-edited file.
    """
    if not stamp:
        return None
    try:
        return datetime.strptime(stamp, "%Y-%m-%dT%H:%M:%SZ").replace(
            tzinfo=timezone.utc
        )
    except ValueError:
        return None


def migrate_layout(
    *,
    path: Optional[Path] = None,
    now: Optional[datetime] = None,
) -> Optional[dict]:
    """Migrate an installed-tree lockfile to the current install-layout ABI.

    Idempotent. Detects ``install_layout_version < INSTALL_LAYOUT_VERSION``
    (absent = pre-freeze v0) and migrates the on-disk shape in place,
    preserving the recorded tools, package version, and ``installed_at``
    stamp and re-stamping the layout version.

    At the freeze baseline (v0 → v1) the only material change is stamping
    the version — the on-disk shape is unchanged. Future layout versions
    extend this function with the concrete shape transforms; surgical-uninstall
    pointers must always be preserved.

    Returns:
      * ``None`` — no lockfile exists (nothing installed).
      * ``{"from": v, "to": v, "changed": []}`` — already current (no-op).
      * ``{"from": old, "to": current, "changed": [...]}`` — migrated.
    """
    target = path or lockfile_write_path()
    existing = read_lockfile(path=target)
    if existing is None:
        return None
    from_v = coerce_layout_version(existing.get("install_layout_version"))
    if not needs_migration(existing.get("install_layout_version")):
        return {"from": from_v, "to": from_v, "changed": []}
    version = existing.get("agent_config_version") or current_package_version()
    tools = list(existing.get("tools", []))
    when = now or _parse_installed_at(existing.get("installed_at"))
    write_lockfile(version, tools, path=target, now=when)
    return {
        "from": from_v,
        "to": INSTALL_LAYOUT_VERSION,
        "changed": [
            f"install_layout_version {from_v} → {INSTALL_LAYOUT_VERSION}"
        ],
    }


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


_SEMVER_RE = re.compile(r"^\s*v?(\d+)\.(\d+)\.(\d+)")


def _parse_semver(version: str) -> Optional[tuple[int, int, int]]:
    """Parse ``X.Y.Z[-suffix]`` into a ``(major, minor, patch)`` tuple.

    Returns ``None`` when the leading three numeric segments cannot be
    extracted. Suffixes (``-rc1``, ``+build.5``) are ignored: the
    classification only needs the numeric prefix to decide upgrade vs
    downgrade.
    """
    match = _SEMVER_RE.match(version)
    if not match:
        return None
    return int(match.group(1)), int(match.group(2)), int(match.group(3))


def classify_mismatch(
    installed_version: str, recorded: Optional[str],
) -> str:
    """Classify the relationship between recorded and installed versions.

    Returns one of:
      * ``"none"``        — no lockfile yet; install proceeds clean.
      * ``"match"``       — recorded equals installed.
      * ``"upgrade"``     — recorded < installed; auto-heal allowed.
      * ``"downgrade"``   — recorded > installed; refuse without ``--force``.
      * ``"unparseable"`` — recorded shape unrecognizable (pre-1.0, 1.x
        legacy formats from the namespace migration); treated as
        upgrade by the install path.
    """
    if recorded is None:
        return "none"
    if recorded == installed_version:
        return "match"
    rec = _parse_semver(recorded)
    inst = _parse_semver(installed_version)
    if rec is None or inst is None:
        return "unparseable"
    if rec < inst:
        return "upgrade"
    return "downgrade"


def current_package_version(repo_root: Optional[Path] = None) -> str:
    """Read ``version`` from the package's own ``package.json``."""
    if repo_root is None:
        repo_root = Path(__file__).resolve().parents[3]
    try:
        data = json.loads((repo_root / "package.json").read_text(encoding="utf-8"))
        version = data.get("version")
        if isinstance(version, str) and version.strip():
            return version.strip()
    except (OSError, ValueError, json.JSONDecodeError):
        pass
    return "0.0.0"
