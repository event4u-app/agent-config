"""Centralized loader for ``.agent-settings.yml`` with user-global fallback.

Phase 1 of road-to-portable-dev-preferences. Single source of truth for
how scripts read agent settings — replaces ~15 ad-hoc loaders in P3.

Resolution order (deepest wins; user-global is whitelist-filtered only):

  N. ``~/.event4u/agent-config/agent-settings.yml`` (user-global; whitelist only)
N-1. ``<repo-root>/.agent-settings.yml``            (project-wide; all keys)
N-2. ``<intermediate-dir>/.agent-settings.yml``     (subsystem-scoped; all keys)
  1. ``<CWD>/.agent-settings.yml``                  (deepest, wins; all keys)

The user-global path is resolved via the sibling
:mod:`work_engine._lib.user_global_paths` module (vendored from
``scripts/_lib/user_global_paths.py`` so the engine stays self-contained
when shipped into consumer projects) with a read-fallback to the legacy
``~/.config/agent-config/agent-settings.yml`` so pre-2.4 installs keep
working during the namespace migration.

``<repo-root>`` is the nearest ancestor that anchors the project. As of
Step 7 the anchor set is (closest-leaf wins; tiebreaker
``.agent-settings.yml`` > ``agents/`` > ``.git``):

* ``.agent-settings.yml`` file,
* ``agents/`` directory containing ``roadmaps/``, ``settings/.ai-council.yml``,
  or ``roadmaps-progress.md`` (bare ``agents/`` does **not** anchor),
* ``.git`` file or directory (submodule support).

Set ``AGENT_CONFIG_LEGACY_ANCHOR=1`` to revert to the pre-Step-7
``.git``-only walk for one minor-version soak. The walk stops at the
first anchor — it never drifts into a parent repo or ``$HOME``. When
``cwd`` is ``None`` (default), the loader behaves identically to the
pre-cascade contract: project file + user-global only, no ancestor
walk. Back-compat is hard.

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
import os
from pathlib import Path
from typing import Any, Iterator

from . import user_global_paths

logger = logging.getLogger(__name__)

DEFAULT_PROJECT_FILE = ".agent-settings.yml"
USER_GLOBAL_FILENAME = "agent-settings.yml"

#: Canonical write target under the new ``~/.event4u/agent-config/``
#: namespace. Reads route through :func:`_resolve_user_global_file` so
#: pre-2.4 installs are still picked up from ``~/.config/agent-config/``
#: until the migration shim copies them across.
DEFAULT_USER_GLOBAL_FILE = user_global_paths.write_target(USER_GLOBAL_FILENAME)


def _resolve_user_global_file() -> Path:
    """Return the active user-global settings path with legacy fallback."""
    found = user_global_paths.resolve_with_fallback(USER_GLOBAL_FILENAME)
    if found is not None:
        return found
    return DEFAULT_USER_GLOBAL_FILE

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


#: Anchor identifier returned by :func:`find_project_root_with_anchor`.
ANCHOR_AGENT_SETTINGS = "agent-settings"
ANCHOR_AGENTS_DIR = "agents-dir"
ANCHOR_GIT = "git"

#: Marker subpaths that qualify a bare ``agents/`` directory as a project
#: anchor (D1). Any one is sufficient. Bare ``agents/`` without a marker
#: is **not** an anchor. ``.event4u-bridge.yml`` is the global-only
#: consumer anchor (ADR-020 § Phase 4.2) — a clean consumer repo only
#: ever ships ``agents/overrides/`` plus this marker.
_AGENTS_DIR_MARKERS: tuple[str, ...] = (
    "roadmaps",
    "settings/.ai-council.yml",
    "roadmaps-progress.md",
    ".event4u-bridge.yml",
)

#: Kill-switch (D5). When set to ``"1"``, :func:`find_project_root` and
#: :func:`find_project_root_with_anchor` revert to the pre-Step-7
#: ``.git``-only walk for one minor-version soak.
_LEGACY_ANCHOR_ENV = "AGENT_CONFIG_LEGACY_ANCHOR"


def _boundary_anchor_at(path: Path) -> str | None:
    """Return the boundary-anchor name at ``path`` or ``None``.

    Boundary anchors stop the walk and define the project root:

    * ``agents/`` containing a D1 marker → ``"agents-dir"``
    * ``.git`` (file or directory) → ``"git"``

    ``.agent-settings.yml`` is a **layer marker**, not a boundary
    anchor (decision: ``step-7-d3-cascade-conflict-decision``). It
    only anchors when no boundary is found in any ancestor — handled
    by :func:`find_project_root_with_anchor` as a second pass.

    Pure read-only — at most ``1 + len(_AGENTS_DIR_MARKERS)``
    ``exists()`` probes per call (D6 perf budget).
    """
    agents_dir = path / "agents"
    if agents_dir.is_dir():
        for marker in _AGENTS_DIR_MARKERS:
            if (agents_dir / marker).exists():
                return ANCHOR_AGENTS_DIR
    if (path / ".git").exists():
        return ANCHOR_GIT
    return None


def find_project_root_with_anchor(start: Path) -> tuple[Path, str] | None:
    """Walk up from ``start`` and return ``(root, anchor_name)`` or ``None``.

    Two-tier lookup (boundary vs layer split — see council decision
    ``step-7-d3-cascade-conflict-decision``):

    1. **Boundary pass.** Walk up from ``start``. First ancestor with
       a boundary anchor wins:

       * ``agents/`` containing **any** of ``roadmaps/``,
         ``settings/.ai-council.yml``, or ``roadmaps-progress.md`` (D1) →
         ``"agents-dir"``
       * ``.git`` (file or directory; submodule support) → ``"git"``

       When both coexist at the same ancestor, ``agents/`` wins
       (D3 ordering minus the layer marker).

    2. **Layer fallback.** No boundary found in the chain. Walk again
       and return the **outermost** ancestor containing
       ``.agent-settings.yml`` → ``"agent-settings"``. This delivers
       Step-7's minimal-init goal without breaking the cascade.

    When ``AGENT_CONFIG_LEGACY_ANCHOR=1`` is set (D5 kill-switch), only
    the ``.git`` anchor is considered.

    Pure read-only; never writes, never raises on missing paths.
    """
    current = start.resolve() if start.exists() else start
    legacy = os.environ.get(_LEGACY_ANCHOR_ENV) == "1"
    chain = [current, *current.parents]
    if legacy:
        for candidate in chain:
            if (candidate / ".git").exists():
                return candidate, ANCHOR_GIT
        return None
    # Boundary pass.
    for candidate in chain:
        anchor = _boundary_anchor_at(candidate)
        if anchor is not None:
            return candidate, anchor
    # Layer fallback — outermost .agent-settings.yml wins so the
    # cascade can layer deeper files below it.
    outermost: Path | None = None
    for candidate in chain:
        if (candidate / DEFAULT_PROJECT_FILE).exists():
            outermost = candidate
    if outermost is not None:
        return outermost, ANCHOR_AGENT_SETTINGS
    return None


def find_project_root(start: Path) -> Path | None:
    """Walk up from ``start`` and return the project root or ``None``.

    Thin wrapper over :func:`find_project_root_with_anchor` that drops
    the anchor-name component. Kept for back-compat — every pre-Step-7
    caller already takes a ``Path | None`` here.
    """
    result = find_project_root_with_anchor(start)
    return result[0] if result is not None else None


def find_project_root_with_trace(
    start: Path,
) -> tuple[Path | None, str | None, list[dict[str, Any]]]:
    """Walk up from ``start`` and return ``(root, anchor, trace)``.

    Step 8 A1 — diagnostic variant of :func:`find_project_root_with_anchor`.
    Returns the same ``(root, anchor)`` pair (or ``(None, None)`` when no
    anchor is found) plus an ordered list of trace records describing
    every ancestor probed.

    Each trace record is a dict:

    * ``ancestor``  — absolute path probed (string).
    * ``pass``      — ``"boundary"`` or ``"layer"``.
    * ``hit``       — anchor name on hit, ``None`` on miss.
    * ``reason``    — one-line explanation (``agents/ has roadmaps/``,
      ``no .git``, ``layer marker``, ``legacy: only .git considered``,
      etc.).

    Pure read-only. No additional ``exists()`` cost beyond
    :func:`find_project_root_with_anchor` — the trace records reuse the
    same probes.
    """
    trace: list[dict[str, Any]] = []
    current = start.resolve() if start.exists() else start
    legacy = os.environ.get(_LEGACY_ANCHOR_ENV) == "1"
    chain = [current, *current.parents]

    if legacy:
        for candidate in chain:
            hit = (candidate / ".git").exists()
            trace.append({
                "ancestor": str(candidate),
                "pass": "boundary",
                "hit": ANCHOR_GIT if hit else None,
                "reason": (
                    "legacy: .git found" if hit
                    else "legacy: no .git"
                ),
            })
            if hit:
                return candidate, ANCHOR_GIT, trace
        return None, None, trace

    # Boundary pass — same probes as find_project_root_with_anchor.
    for candidate in chain:
        agents_dir = candidate / "agents"
        if agents_dir.is_dir():
            for marker in _AGENTS_DIR_MARKERS:
                if (agents_dir / marker).exists():
                    trace.append({
                        "ancestor": str(candidate),
                        "pass": "boundary",
                        "hit": ANCHOR_AGENTS_DIR,
                        "reason": f"agents/ has {marker}",
                    })
                    return candidate, ANCHOR_AGENTS_DIR, trace
        if (candidate / ".git").exists():
            trace.append({
                "ancestor": str(candidate),
                "pass": "boundary",
                "hit": ANCHOR_GIT,
                "reason": ".git present",
            })
            return candidate, ANCHOR_GIT, trace
        trace.append({
            "ancestor": str(candidate),
            "pass": "boundary",
            "hit": None,
            "reason": "no agents/ marker, no .git",
        })

    # Layer fallback — outermost .agent-settings.yml wins.
    outermost: Path | None = None
    for candidate in chain:
        present = (candidate / DEFAULT_PROJECT_FILE).exists()
        trace.append({
            "ancestor": str(candidate),
            "pass": "layer",
            "hit": ANCHOR_AGENT_SETTINGS if present else None,
            "reason": (
                f"{DEFAULT_PROJECT_FILE} present" if present
                else f"no {DEFAULT_PROJECT_FILE}"
            ),
        })
        if present:
            outermost = candidate
    if outermost is not None:
        return outermost, ANCHOR_AGENT_SETTINGS, trace
    return None, None, trace


#: Origin tag returned by :func:`resolve_project_root` alongside the
#: anchor names defined above. Distinct values let callers (doctor,
#: tests, future telemetry) surface *how* the root was chosen.
ORIGIN_ROOT_FLAG = "root-flag"    # --root global flag (Step 8 A3)
ORIGIN_EXPLICIT = "explicit"      # --project arg on a subcommand
ORIGIN_ENV = "env"                # AGENT_CONFIG_PROJECT_ROOT (wrapper-pinned)
ORIGIN_CWD_FALLBACK = "cwd-fallback"  # no anchor found

PROJECT_ROOT_ENV = "AGENT_CONFIG_PROJECT_ROOT"
ROOT_OVERRIDE_ENV = "AGENT_CONFIG_ROOT_OVERRIDE"


class ProjectRootError(Exception):
    """Raised when an explicit project-root override points to an invalid path.

    Step 8 A3: ``--root <path>`` and ``AGENT_CONFIG_PROJECT_ROOT`` must
    fail loudly when the target does not exist or is not a directory.
    Callers translate this into exit code 2 (no silent CWD fallback).
    """


def _validate_root_path(path: Path, origin_label: str) -> Path:
    """Resolve ``path``; raise :class:`ProjectRootError` when invalid.

    ``origin_label`` is one of ``--root``, ``AGENT_CONFIG_PROJECT_ROOT``,
    or ``--project``; surfaced verbatim in the error message so the
    operator can see which channel injected the bad value.
    """
    resolved = Path(path).expanduser()
    if not resolved.exists():
        raise ProjectRootError(
            f"{origin_label} points to a path that does not exist: {resolved}",
        )
    if not resolved.is_dir():
        raise ProjectRootError(
            f"{origin_label} points to a non-directory: {resolved}",
        )
    return resolved.resolve()


def resolve_project_root(
    arg: str | Path | None,
    *,
    cwd: Path | None = None,
) -> tuple[Path, str]:
    """Return ``(root, origin)`` for any ``cmd_*`` entry point.

    Resolution order (Step 8 A3 — explicit override hardening):

    1. ``AGENT_CONFIG_PROJECT_ROOT`` env var with
       ``AGENT_CONFIG_ROOT_OVERRIDE=1`` set by the master CLI's ``--root``
       flag → ``ORIGIN_ROOT_FLAG``. Fail-loud on invalid path.
    2. Explicit ``--project`` / ``--target`` argument → ``ORIGIN_EXPLICIT``.
       Fail-loud on invalid path.
    3. ``AGENT_CONFIG_PROJECT_ROOT`` environment variable, set by the
       project-local ``./agent-config`` wrapper → ``ORIGIN_ENV``.
       Fail-loud on invalid path.
    4. Anchor walk from ``cwd`` via
       :func:`find_project_root_with_anchor` → anchor name
       (``agents-dir`` / ``git`` / ``agent-settings``).
    5. Fall back to ``cwd`` itself → ``ORIGIN_CWD_FALLBACK``.

    The ``--root`` channel wins over a subcommand-level ``--project``
    because it is a deliberate global override (Step 8 council decision).
    Wrapper-set env (3) still wins over the anchor walk so subdir
    invocations stay pinned.

    Raises :class:`ProjectRootError` when any explicit override points
    to a missing path or non-directory — callers map this to exit 2.
    """
    if os.environ.get(ROOT_OVERRIDE_ENV) == "1":
        env_value = os.environ.get(PROJECT_ROOT_ENV)
        if env_value:
            return _validate_root_path(Path(env_value), "--root"), ORIGIN_ROOT_FLAG
    if arg is not None and str(arg) != "":
        return _validate_root_path(Path(arg), "--project"), ORIGIN_EXPLICIT
    env_value = os.environ.get(PROJECT_ROOT_ENV)
    if env_value:
        return (
            _validate_root_path(Path(env_value), PROJECT_ROOT_ENV),
            ORIGIN_ENV,
        )
    start = (cwd or Path.cwd()).resolve()
    walked = find_project_root_with_anchor(start)
    if walked is not None:
        return walked
    return start, ORIGIN_CWD_FALLBACK


def _resolve_cascade_paths(
    cwd: Path | None,
    project_path: Path | str | None,
) -> list[Path]:
    """Return the ordered cascade of in-project settings files (shallow → deep).

    When ``cwd`` is provided and ``find_project_root(cwd)`` succeeds, the
    list contains every ``<dir>/.agent-settings.yml`` from the repo root
    down to ``cwd`` (inclusive on both ends), shallowest first. When
    ``cwd`` is ``None`` or no anchor is reached, falls back to the
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
    ``~/.event4u/agent-config/agent-settings.yml`` (with a read fallback
    to the legacy ``~/.config/agent-config/agent-settings.yml``). Both arguments accept
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
        Path(user_global_path) if user_global_path else _resolve_user_global_file(),
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
        Path(user_global_path) if user_global_path else _resolve_user_global_file()
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
