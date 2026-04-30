"""Frontend-stack detection from project manifests.

The detector reads ``composer.json`` and ``package.json`` from a project
root, applies the heuristic table below in priority order, and returns a
:class:`StackResult` carrying the labelled frontend plus the manifest
``mtime`` it was computed against. The dispatcher caches the result on
``state.stack`` and re-runs detection whenever the recorded ``mtime``
no longer matches what the filesystem reports.

Heuristics (priority order — first match wins):

1. ``composer.json`` lists ``livewire/livewire`` AND ``livewire/flux`` →
   ``blade-livewire-flux``
2. ``package.json`` lists ``react`` AND any of ``@radix-ui/*``,
   ``shadcn-ui`` or has a ``components.json`` (the shadcn marker file)
   → ``react-shadcn``
3. ``package.json`` lists ``vue`` (any major) → ``vue``
4. Otherwise → ``plain``

Detection is filesystem-cheap: at most three small JSON reads per
project root. Errors (missing file, malformed JSON, missing ``require``
section) downgrade to ``plain`` rather than raising — a wrong stack
label is recoverable (audit catches it, user can override), but a
crash mid-dispatch is not.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

KNOWN_STACKS: frozenset[str] = frozenset(
    {"blade-livewire-flux", "react-shadcn", "vue", "plain"},
)
"""All stack labels the detector can return.

Kept as a frozenset so consumers (state schema, fixtures, tests) can
validate against a single source of truth without re-deriving."""

DEFAULT_STACK = "plain"
"""Fallback when no manifest signal matches."""

_SHADCN_RADIX_PREFIX = "@radix-ui/"
_SHADCN_PACKAGE_NAMES: frozenset[str] = frozenset({"shadcn-ui", "shadcn"})
_FLUX_PACKAGE = "livewire/flux"
_LIVEWIRE_PACKAGE = "livewire/livewire"


@dataclass(frozen=True)
class StackResult:
    """Outcome of one detection pass.

    ``mtime`` is the latest mtime among the manifests actually consulted
    (``composer.json`` and ``package.json``), in POSIX seconds. Callers
    cache the result keyed on this value; a stale cache is invalidated
    by the next dispatch when the recorded mtime is older than what
    :func:`latest_manifest_mtime` returns.
    """

    frontend: str
    mtime: float


def detect_stack(project_root: Path) -> StackResult:
    """Inspect ``project_root`` and label the frontend stack.

    Parameters
    ----------
    project_root:
        Directory that should contain a ``composer.json`` or
        ``package.json`` at its top level. Other layouts (monorepos,
        nested workspaces) call this with the workspace root that
        carries the manifest you care about — the caller picks the
        scope, the detector does not walk upwards.

    Returns
    -------
    StackResult
        ``frontend`` is one of :data:`KNOWN_STACKS`; ``mtime`` is the
        latest manifest mtime among the files actually consulted, or
        ``0.0`` when no manifests exist (greenfield project).
    """
    composer = _read_json(project_root / "composer.json")
    package = _read_json(project_root / "package.json")
    components_json = (project_root / "components.json").is_file()
    mtime = latest_manifest_mtime(project_root)

    if _is_blade_livewire_flux(composer):
        return StackResult(frontend="blade-livewire-flux", mtime=mtime)

    if _is_react_shadcn(package, components_json):
        return StackResult(frontend="react-shadcn", mtime=mtime)

    if _has_vue(package):
        return StackResult(frontend="vue", mtime=mtime)

    return StackResult(frontend=DEFAULT_STACK, mtime=mtime)


def latest_manifest_mtime(project_root: Path) -> float:
    """Return the latest mtime across the manifests we consult.

    Used by the dispatcher's cache check: when the persisted
    ``state.stack.mtime`` no longer matches the live value, the cached
    label is invalidated and detection re-runs. Returns ``0.0`` when no
    manifest is present so a fresh greenfield repo produces a stable
    sentinel rather than a missing-file error.
    """
    candidates = ("composer.json", "package.json")
    mtimes = [
        (project_root / name).stat().st_mtime
        for name in candidates
        if (project_root / name).is_file()
    ]
    return max(mtimes) if mtimes else 0.0


def _read_json(path: Path) -> dict[str, object]:
    """Read a JSON manifest, returning ``{}`` on any error.

    Wrong-but-recoverable beats crash-mid-dispatch. Audit and the
    refine step will surface the real shape of the project; the
    detector's job is just to pick a routing label.
    """
    if not path.is_file():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


def _all_dependencies(manifest: dict[str, object], *keys: str) -> dict[str, object]:
    """Merge the dependency-style sections of a manifest into one map.

    composer.json uses ``require`` and ``require-dev``; package.json uses
    ``dependencies``, ``devDependencies``, ``peerDependencies``, and
    ``optionalDependencies``. We only care whether a name is present
    anywhere — version pinning is the audit step's concern.
    """
    merged: dict[str, object] = {}
    for key in keys:
        section = manifest.get(key)
        if isinstance(section, dict):
            merged.update(section)
    return merged


def _is_blade_livewire_flux(composer: dict[str, object]) -> bool:
    deps = _all_dependencies(composer, "require", "require-dev")
    return _LIVEWIRE_PACKAGE in deps and _FLUX_PACKAGE in deps


def _is_react_shadcn(package: dict[str, object], components_json: bool) -> bool:
    deps = _all_dependencies(
        package,
        "dependencies",
        "devDependencies",
        "peerDependencies",
        "optionalDependencies",
    )
    if "react" not in deps:
        return False
    has_radix = any(name.startswith(_SHADCN_RADIX_PREFIX) for name in deps)
    has_shadcn_pkg = any(name in _SHADCN_PACKAGE_NAMES for name in deps)
    return has_radix or has_shadcn_pkg or components_json


def _has_vue(package: dict[str, object]) -> bool:
    deps = _all_dependencies(
        package,
        "dependencies",
        "devDependencies",
        "peerDependencies",
        "optionalDependencies",
    )
    return "vue" in deps


__all__ = [
    "DEFAULT_STACK",
    "KNOWN_STACKS",
    "StackResult",
    "detect_stack",
    "latest_manifest_mtime",
]
