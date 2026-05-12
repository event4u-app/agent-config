"""Centralized loader for ``.agent-settings.yml`` with user-global fallback.

Phase 1 of road-to-portable-dev-preferences. Single source of truth for
how scripts read agent settings — replaces ~15 ad-hoc loaders in P3.

Resolution order (deepest wins; user-global is whitelist-filtered only):

  N. ``~/.config/agent-config/agent-settings.yml``  (user-global; whitelist only)
N-1. ``<repo-root>/.agent-settings.yml``            (project-wide; all keys)
N-2. ``<intermediate-dir>/.agent-settings.yml``     (subsystem-scoped; all keys)
  1. ``<CWD>/.agent-settings.yml``                  (deepest, wins; all keys)

``<repo-root>`` is the nearest ancestor that contains ``.git`` (directory
**or** file — submodule support). The walk stops there — it never drifts
into a parent repo or ``$HOME``. When ``cwd`` is ``None`` (default), the
loader behaves identically to the pre-cascade contract: project file +
user-global only, no ancestor walk. Back-compat is hard.

Whitelisted keys (``MERGEABLE_KEYS``) are exact dotted paths. A
non-whitelisted key in the user-global file is silently ignored — the
``verbose=True`` flag surfaces ignored paths via ``logging.info`` for
debugging. Non-root in-project layers (intermediate + CWD) are **not**
whitelist-filtered — they live inside the project boundary.

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
from typing import Any, Iterator

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


def find_project_root(start: Path) -> Path | None:
    """Walk up from ``start`` looking for ``.git`` (file or directory).

    Returns the first ancestor that contains ``.git`` as a file (submodule
    pointer) or directory (regular checkout), or ``None`` if the walk
    reaches the filesystem root without finding one. The walk stops at
    the project boundary — it never drifts into a parent repo or
    ``$HOME``.

    Pure read-only; never touches the filesystem beyond ``exists()``
    probes on the ``.git`` entry.
    """
    current = start.resolve() if start.exists() else start
    # ``Path.parents`` excludes ``current`` itself, so probe it first.
    for candidate in [current, *current.parents]:
        git_marker = candidate / ".git"
        if git_marker.exists():
            return candidate
    return None


def _resolve_cascade_paths(
    cwd: Path | None,
    project_path: Path | str | None,
) -> list[Path]:
    """Return the ordered cascade of in-project settings files (shallow → deep).

    When ``cwd`` is provided and ``find_project_root(cwd)`` succeeds, the
    list contains every ``<dir>/.agent-settings.yml`` from the repo root
    down to ``cwd`` (inclusive on both ends), shallowest first. When
    ``cwd`` is ``None`` or no ``.git`` is reached, falls back to the
    single legacy project path — back-compat with the pre-cascade
    loader.
    """
    if cwd is None:
        legacy = Path(project_path) if project_path else Path(DEFAULT_PROJECT_FILE)
        return [legacy]

    root = find_project_root(cwd)
    if root is None:
        legacy = Path(project_path) if project_path else Path(DEFAULT_PROJECT_FILE)
        return [legacy]

    cwd_resolved = cwd.resolve()
    # Build the chain root → … → cwd (shallowest first, deepest last).
    chain: list[Path] = []
    cursor = cwd_resolved
    while True:
        chain.append(cursor)
        if cursor == root:
            break
        parent = cursor.parent
        if parent == cursor:
            break
        cursor = parent
    chain.reverse()
    return [d / DEFAULT_PROJECT_FILE for d in chain]


def load_agent_settings(
    project_path: Path | str | None = None,
    user_global_path: Path | str | None = None,
    verbose: bool = False,
    cwd: Path | None = None,
) -> dict[str, Any]:
    """Return the merged settings dict.

    ``project_path`` defaults to ``./.agent-settings.yml`` (CWD-relative).
    ``user_global_path`` defaults to
    ``~/.config/agent-config/agent-settings.yml``. Both arguments accept
    ``Path`` or ``str``. Pass ``verbose=True`` to log keys present in
    user-global that are not on the whitelist.

    ``cwd`` enables the in-project cascade: when provided **and**
    ``find_project_root(cwd)`` reaches a ``.git`` ancestor, the loader
    walks every ``.agent-settings.yml`` from the repo root down to
    ``cwd`` and merges them shallowest → deepest (deepest wins).
    Non-root layers are **not** whitelist-filtered (they live inside the
    project boundary). When ``cwd`` is ``None`` (default), the loader
    falls back to the single ``project_path`` behaviour — back-compat
    with pre-cascade callers.
    """
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

    cascade = _resolve_cascade_paths(cwd, project_path)

    merged: dict[str, Any] = _deep_copy_defaults(_DEFAULTS)
    _deep_merge(merged, user_global_filtered)
    for path in cascade:
        layer = _read_yaml(path) or {}
        if layer:
            _deep_merge(merged, layer)
    return merged


def iter_setting_overrides(
    project_path: Path | str | None = None,
    user_global_path: Path | str | None = None,
    cwd: Path | None = None,
) -> Iterator[tuple[str, Any, Path]]:
    """Yield ``(dotted_key, value, source_path)`` for every leaf setting.

    Walks the same cascade as :func:`load_agent_settings` and emits one
    tuple per leaf observed at each layer (user-global → repo-root →
    intermediates → CWD). Callers can detect overrides by grouping
    tuples on ``dotted_key`` — the deepest tuple per group wins. Useful
    for ``task settings:trace`` and other banner-only diagnostics.
    Never blocks, never raises on missing files.
    """
    user_global_path_resolved = (
        Path(user_global_path) if user_global_path else DEFAULT_USER_GLOBAL_FILE
    )
    user_global_raw = _read_yaml(user_global_path_resolved) or {}
    user_global_filtered, _ = _filter_whitelist(user_global_raw, MERGEABLE_KEYS)
    if user_global_filtered:
        for key in _leaf_paths(user_global_filtered):
            yield key, _get_dotted(user_global_filtered, key), user_global_path_resolved

    for path in _resolve_cascade_paths(cwd, project_path):
        layer = _read_yaml(path)
        if not layer:
            continue
        for key in _leaf_paths(layer):
            yield key, _get_dotted(layer, key), path


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
