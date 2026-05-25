"""Detect module root directories from a project tree.

Phase B of road-to-configurable-modules. Lifts the multi-stack
detection table from ``commands/module/explore.md`` Step 1 into a
reusable, pure Python helper that the installer, onboarding wizard,
and ``/agents init`` flow all share.

Contract — pure, read-only, tolerant:

* :func:`detect_module_roots` walks the candidate paths once and
  reports every directory that *exists*. It never creates files,
  never recurses past the first level needed to score confidence,
  and silently skips paths it cannot read.
* The return shape is a list of :class:`ModuleCandidate` typed
  dicts ordered by descending confidence; callers may turn that
  list straight into numbered options.
* Confidence is a three-step ladder:

  - ``high`` — directory exists *and* its first level contains
    plausible module subdirectories for the stack.
  - ``medium`` — directory exists but is empty / unclear; still
    surfaced so the installer can ask the user.
  - Absent paths are skipped entirely; they never appear in the
    output.

No interactive logic, no settings I/O, no logging side-effects.
Settings wiring lives in ``scripts/install.py`` (Step 2) and the
GUI wizard (Step 3).
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

#: Directory entry names that never count as modules. Mirrors the
#: ``modules.skip_dirs`` default from
#: ``templates/agents/agent-project-settings.example.yml``.
_SKIP_DIRS: frozenset[str] = frozenset({
    ".module-template",
    ".example",
})


@dataclass(frozen=True)
class ModuleCandidate:
    """One detected module-root candidate.

    Attributes mirror the JSON shape callers ultimately persist into
    ``modules.root_paths`` (the ``path`` field) plus metadata used
    by the installer to phrase the numbered-options prompt.
    """

    path: str
    """Repo-relative POSIX path of the module root (e.g. ``app/Modules``)."""

    stack: str
    """Stack identifier — one of ``laravel-hmvc``, ``symfony-ddd``,
    ``node-monorepo``, ``python-src``, ``go-internal``, ``composer-src``."""

    namespace_template_guess: str
    """PHP-style namespace template with ``{ModuleName}`` placeholder
    (e.g. ``App\\Modules\\{ModuleName}``). Empty string for stacks
    without a PHP-style namespace (Node, Python, Go)."""

    confidence: str
    """One of ``high`` or ``medium`` per the ladder in the module
    docstring."""


# Detection rules — order encodes priority when two rules match the
# same directory. ``namespace_template`` is the value emitted as
# ``namespace_template_guess`` on a hit; empty for non-PHP stacks.
_RULES: tuple[tuple[str, str, str], ...] = (
    ("app/Modules", "laravel-hmvc", "App\\Modules\\{ModuleName}"),
    ("src/Module", "symfony-ddd", "App\\Module\\{ModuleName}"),
    ("packages", "node-monorepo", ""),
    ("apps", "node-monorepo", ""),
    ("modules", "node-monorepo", ""),
    ("src", "python-src", ""),
    ("internal", "go-internal", ""),
    ("cmd", "go-internal", ""),
)


def _list_module_subdirs(root: Path) -> list[Path]:
    """Return first-level subdirectories of ``root`` that look like modules."""
    try:
        entries = sorted(root.iterdir())
    except (OSError, PermissionError):
        return []
    out: list[Path] = []
    for entry in entries:
        if not entry.is_dir():
            continue
        if entry.name.startswith("."):
            continue
        if entry.name in _SKIP_DIRS:
            continue
        out.append(entry)
    return out


def _score_confidence(stack: str, subdirs: Iterable[Path]) -> str:
    """Return ``high`` when ``subdirs`` looks like a populated module root."""
    subdirs_list = list(subdirs)
    if not subdirs_list:
        return "medium"
    if stack in {"laravel-hmvc", "symfony-ddd"}:
        capitalized = [d for d in subdirs_list if d.name[:1].isupper()]
        return "high" if capitalized else "medium"
    if stack == "node-monorepo":
        with_pkg_json = [d for d in subdirs_list if (d / "package.json").is_file()]
        return "high" if with_pkg_json else "medium"
    if stack == "python-src":
        with_init = [d for d in subdirs_list if (d / "__init__.py").is_file()]
        return "high" if with_init else "medium"
    if stack == "go-internal":
        return "high" if subdirs_list else "medium"
    return "medium"


def detect_module_roots(project_root: Path) -> list[ModuleCandidate]:
    """Return module-root candidates discovered under ``project_root``.

    Pure read-only scan. Walks each rule in :data:`_RULES`, reports
    every directory that exists, and never recurses past the first
    level needed to score confidence. Order: ``high`` first, then
    ``medium``; rule order breaks ties. Absent paths never appear
    in the output.
    """
    project_root = Path(project_root)
    high: list[ModuleCandidate] = []
    medium: list[ModuleCandidate] = []
    for rel_path, stack, namespace_template in _RULES:
        abs_path = project_root / rel_path
        if not abs_path.is_dir():
            continue
        subdirs = _list_module_subdirs(abs_path)
        confidence = _score_confidence(stack, subdirs)
        candidate = ModuleCandidate(
            path=rel_path,
            stack=stack,
            namespace_template_guess=namespace_template,
            confidence=confidence,
        )
        if confidence == "high":
            high.append(candidate)
        else:
            medium.append(candidate)
    return high + medium
