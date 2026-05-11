"""Centralized loader for ``.agent-settings.yml`` with user-global fallback.

Phase 1 of road-to-portable-dev-preferences. Single source of truth for
how scripts read agent settings — replaces ~15 ad-hoc loaders in P3.

Resolution order (project wins, user-global fills gaps for whitelisted
keys only):

  1. Project ``./.agent-settings.yml``                  (full file, all keys)
  2. ``~/.config/agent-config/agent-settings.yml``      (whitelist only)
  3. Built-in defaults                                  (currently empty)

Whitelisted keys (``MERGEABLE_KEYS``) are exact dotted paths. A
non-whitelisted key in the user-global file is silently ignored — the
``verbose=True`` flag surfaces ignored paths via ``logging.info`` for
debugging.

Contract — pure, read-only, tolerant:

* Lazy PyYAML import; no yaml installed → defaults returned.
* Missing project file → user-global + defaults.
* Missing user-global file → project + defaults.
* Both missing → defaults.
* Malformed YAML / unreadable file → defaults, logged at WARNING.
* No file is ever created or written by this module.
"""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

DEFAULT_PROJECT_FILE = ".agent-settings.yml"
DEFAULT_USER_GLOBAL_FILE = (
    Path.home() / ".config" / "agent-config" / "agent-settings.yml"
)

#: Exact dotted paths allowed to cascade from user-global into the merged
#: settings. Anything not listed here is silently ignored when present in
#: the user-global file. Adding a key requires an ADR — see
#: ``agents/roadmaps/road-to-portable-dev-preferences.md``.
MERGEABLE_KEYS: tuple[str, ...] = (
    "name",
    "ide",
    "cost_profile",
    "personal.bot_icon",
    "personal.autonomy",
    "caveman.speak_scope",
)

_DEFAULTS: dict[str, Any] = {}


def load_agent_settings(
    project_path: Path | str | None = None,
    user_global_path: Path | str | None = None,
    verbose: bool = False,
) -> dict[str, Any]:
    """Return the merged settings dict.

    ``project_path`` defaults to ``./.agent-settings.yml`` (CWD-relative).
    ``user_global_path`` defaults to
    ``~/.config/agent-config/agent-settings.yml``. Both arguments accept
    ``Path`` or ``str``. Pass ``verbose=True`` to log keys present in
    user-global that are not on the whitelist.
    """
    project = _read_yaml(
        Path(project_path) if project_path else Path(DEFAULT_PROJECT_FILE),
    ) or {}
    user_global_raw = _read_yaml(
        Path(user_global_path) if user_global_path else DEFAULT_USER_GLOBAL_FILE,
    ) or {}

    user_global_filtered, ignored = _filter_whitelist(
        user_global_raw, MERGEABLE_KEYS,
    )
    if verbose and ignored:
        logger.info(
            "agent_settings: ignored non-whitelisted user-global keys: %s",
            sorted(ignored),
        )

    merged: dict[str, Any] = _deep_copy_defaults(_DEFAULTS)
    _deep_merge(merged, user_global_filtered)
    _deep_merge(merged, project)
    return merged


def _read_yaml(path: Path) -> dict[str, Any] | None:
    """Best-effort YAML read; never raises. Returns ``None`` on any failure."""
    if not path.is_file():
        return None
    try:
        import yaml  # type: ignore[import-untyped]
    except ImportError:
        return None
    try:
        with path.open(encoding="utf-8") as fh:
            data = yaml.safe_load(fh) or {}
    except (OSError, yaml.YAMLError):
        logger.warning("agent_settings: unreadable or malformed YAML at %s", path)
        return None
    return data if isinstance(data, dict) else None


def _filter_whitelist(
    raw: dict[str, Any], allowed: tuple[str, ...],
) -> tuple[dict[str, Any], list[str]]:
    """Return ``(filtered_dict, ignored_paths)`` from a user-global blob."""
    filtered: dict[str, Any] = {}
    for dotted in allowed:
        value = _get_dotted(raw, dotted)
        if value is not None:
            _set_dotted(filtered, dotted, value)
    ignored = [p for p in _leaf_paths(raw) if p not in allowed]
    return filtered, ignored


def _get_dotted(data: dict[str, Any], dotted: str) -> Any:
    cursor: Any = data
    for part in dotted.split("."):
        if not isinstance(cursor, dict) or part not in cursor:
            return None
        cursor = cursor[part]
    return cursor


def _set_dotted(target: dict[str, Any], dotted: str, value: Any) -> None:
    parts = dotted.split(".")
    cursor = target
    for part in parts[:-1]:
        nxt = cursor.setdefault(part, {})
        if not isinstance(nxt, dict):
            nxt = {}
            cursor[part] = nxt
        cursor = nxt
    cursor[parts[-1]] = value


def _leaf_paths(data: dict[str, Any], prefix: str = "") -> list[str]:
    paths: list[str] = []
    for key, value in data.items():
        path = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict) and value:
            paths.extend(_leaf_paths(value, path))
        else:
            paths.append(path)
    return paths


def _deep_merge(dst: dict[str, Any], src: dict[str, Any]) -> None:
    """Merge ``src`` into ``dst`` in-place; nested dicts are merged recursively."""
    for key, value in src.items():
        if (
            isinstance(value, dict)
            and isinstance(dst.get(key), dict)
        ):
            _deep_merge(dst[key], value)
        else:
            dst[key] = value


def _deep_copy_defaults(src: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    _deep_merge(out, src)
    return out
