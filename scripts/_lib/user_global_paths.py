"""Vendor-namespaced user-global path resolution.

Phase 1 of road-to-event4u-namespace-and-claude-desktop.md. Single source
of truth for "where does this package keep user-global state on disk?".
Replaces hard-coded ``~/.config/agent-config/`` literals scattered across
``scripts/_lib`` and ``scripts/ai_council``.

Resolution order:

  1. ``$EVENT4U_CONFIG_HOME``  — full path override (testing + power users).
  2. ``~/.event4u/agent-config/``  — vendor-namespaced source-of-truth.

For backward compatibility during the transition, ``legacy_xdg_root()``
exposes the old ``~/.config/agent-config/`` path so loaders can read
state written by pre-2.4 installs. Writers should never target the
legacy path; the auto-migration shim (Phase 3) copies state once into
the new namespace.

Contract — pure, read-only, never auto-creates directories.
"""
from __future__ import annotations

import os
import shutil
from pathlib import Path
from typing import Optional

#: Environment variable that overrides ``event4u_root()`` outright.
#: Accepts a full path (``~`` expanded). Primarily used by tests; power
#: users may also point this at a custom location.
EVENT4U_HOME_ENV = "EVENT4U_CONFIG_HOME"

#: Vendor-namespaced default. Relative to the user's home directory.
DEFAULT_EVENT4U_ROOT_RELATIVE = Path(".event4u") / "agent-config"

#: Legacy XDG-shaped default written by pre-2.4 installs. Read-only
#: fallback during the transition; never the target of a write.
LEGACY_XDG_ROOT_RELATIVE = Path(".config") / "agent-config"


def event4u_root(env: Optional[dict] = None) -> Path:
    """Return the active user-global root directory.

    Honours ``EVENT4U_CONFIG_HOME`` first, falls back to
    ``~/.event4u/agent-config/``. Never creates the directory.
    """
    env_map = env if env is not None else os.environ
    override = env_map.get(EVENT4U_HOME_ENV)
    if override:
        return Path(override).expanduser()
    return Path.home() / DEFAULT_EVENT4U_ROOT_RELATIVE


def legacy_xdg_root() -> Path:
    """Return the pre-2.4 user-global root at ``~/.config/agent-config/``.

    Used by loaders during the transition to read settings, lockfiles,
    and keys written before the namespace migration ran. Writers MUST
    NOT target this path — only ``event4u_root()`` is a valid write
    target. Never creates the directory.
    """
    return Path.home() / LEGACY_XDG_ROOT_RELATIVE


def resolve_with_fallback(
    relative_name: str,
    *,
    env: Optional[dict] = None,
) -> Optional[Path]:
    """Resolve a named file/dir under the user-global root, with legacy fallback.

    Returns the new-namespace path if it exists on disk, otherwise the
    legacy XDG path if it exists, otherwise ``None``. Callers that need
    the *write target* (regardless of existence) should use
    ``event4u_root() / relative_name`` directly.

    ``relative_name`` is a forward-slash separated string (e.g.
    ``"installed.lock"`` or ``"agents/global"``). It is treated as a
    path fragment relative to the chosen root; absolute paths are
    rejected with ``ValueError``.
    """
    fragment = Path(relative_name)
    if fragment.is_absolute():
        raise ValueError(
            f"resolve_with_fallback expects a relative path, got {relative_name!r}"
        )
    new_path = event4u_root(env=env) / fragment
    if new_path.exists():
        return new_path
    legacy_path = legacy_xdg_root() / fragment
    if legacy_path.exists():
        return legacy_path
    return None


def write_target(relative_name: str, *, env: Optional[dict] = None) -> Path:
    """Return the canonical write target for a named user-global file/dir.

    Always rooted at ``event4u_root()`` — writers never target the
    legacy XDG path. Caller is responsible for ``mkdir(parents=True)``
    on the parent before writing. Never creates the directory itself.
    """
    fragment = Path(relative_name)
    if fragment.is_absolute():
        raise ValueError(
            f"write_target expects a relative path, got {relative_name!r}"
        )
    return event4u_root(env=env) / fragment


#: Breadcrumb dropped into the legacy root after a successful migration.
#: Tells the user where their state now lives and how to clean up. The
#: legacy tree itself is never auto-deleted — only the user does that.
MIGRATION_BREADCRUMB_NAME = "MIGRATED.md"

_BREADCRUMB_TEMPLATE = """# Migrated to `~/.event4u/agent-config/`

This directory (`~/.config/agent-config/`) is the **legacy** location
for `event4u/agent-config` user-global state. As of v2.4 the canonical
location is `~/.event4u/agent-config/`.

The migration shim has already copied your settings, keys, lockfiles,
and overrides into the new namespace. File modes (0600 on keys) were
preserved. Loaders prefer the new path but still read from this tree
as a fallback, so removing it is safe **once you've confirmed** the
new location is working.

## To clean up

```bash
rm -rf ~/.config/agent-config
```

## Why the move

`~/.config/` is a generic XDG-shaped directory shared by many tools.
`~/.event4u/agent-config/` is vendor-namespaced and avoids collisions
with unrelated CLIs. See
`agents/roadmaps/road-to-event4u-namespace-and-claude-desktop.md` for
the full rationale.
"""


def migrate_legacy_namespace(
    *,
    env: Optional[dict] = None,
    legacy_root_override: Optional[Path] = None,
) -> bool:
    """Copy pre-2.4 user-global state from legacy XDG root into the new namespace.

    Idempotent and safe to call on every install / init. Returns ``True``
    if a copy ran during this invocation, ``False`` when the migration
    was already complete or there was nothing to migrate.

    Contract:

    - Never auto-deletes the legacy tree — that's the user's call (the
      breadcrumb at ``~/.config/agent-config/MIGRATED.md`` documents it).
    - Preserves file modes via ``shutil.copytree(..., copy_function=copy2)``
      so 0600 key files stay 0600 after the copy.
    - If the new root already exists with any content, the migration
      treats it as already-done and only writes the breadcrumb (if
      missing) — never overwrites new-namespace state.
    - If the legacy root is missing or empty, the function is a no-op.

    ``legacy_root_override`` is for tests; production callers leave it ``None``.
    """
    legacy_root = (
        legacy_root_override if legacy_root_override is not None else legacy_xdg_root()
    )
    new_root = event4u_root(env=env)

    if not legacy_root.exists() or not legacy_root.is_dir():
        return False

    # Skip the migrated-breadcrumb itself when checking for content so a
    # second invocation does not loop on its own marker.
    legacy_entries = [
        p for p in legacy_root.iterdir() if p.name != MIGRATION_BREADCRUMB_NAME
    ]
    if not legacy_entries:
        return False

    new_has_content = new_root.exists() and any(new_root.iterdir())
    if new_has_content:
        _ensure_breadcrumb(legacy_root)
        return False

    new_root.mkdir(parents=True, exist_ok=True)
    for entry in legacy_entries:
        target = new_root / entry.name
        if target.exists():
            continue
        if entry.is_dir():
            shutil.copytree(entry, target, copy_function=shutil.copy2)
        else:
            shutil.copy2(entry, target)

    _ensure_breadcrumb(legacy_root)
    return True


def _ensure_breadcrumb(legacy_root: Path) -> None:
    """Write the ``MIGRATED.md`` breadcrumb into ``legacy_root`` if absent."""
    breadcrumb = legacy_root / MIGRATION_BREADCRUMB_NAME
    if breadcrumb.exists():
        return
    breadcrumb.write_text(_BREADCRUMB_TEMPLATE, encoding="utf-8")
