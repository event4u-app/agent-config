"""Locate artefact source roots across the monorepo physical layout.

Phase 4 of the monorepo migration (ADR-017) physically moves source
artefacts out of the flat ``.agent-src.uncondensed/`` directory into
``packages/core/.agent-src.uncondensed/`` and
``packages/pack-*/.agent-src.uncondensed/`` trees. This helper hides
that decision from every scanner so they keep working pre-move and
post-move with the same call shape.

Contract:

- ``artefact_roots()`` returns every directory that contains source
  ``.md`` artefacts. Pre-move that is ``.agent-src.uncondensed/`` at
  the repo root. Post-move it is every ``packages/*/.agent-src.uncondensed/``.
  Both can coexist during the migration window.
- ``iter_artefacts()`` yields every source ``.md`` path under those roots.
- ``logical_relpath(p)`` returns the artefact's stable identity path
  (e.g. ``skills/laravel/SKILL.md``), independent of which physical
  root contains it. This is what manifests, hash maps, and projections
  use as the artefact key.
- ``strip_source_prefix(p)`` returns the same as ``logical_relpath``
  but accepts repo-relative POSIX strings (used by the condenseor's
  output-path computation and the LEGACY_SRC_PREFIX logic).
"""
from __future__ import annotations

from pathlib import Path
from typing import Iterator

ROOT = Path(__file__).resolve().parents[2]
LEGACY_SRC = ROOT / ".agent-src.uncondensed"
PACKAGES = ROOT / "packages"
PACKAGE_CORE = PACKAGES / "core"

# Repo-relative POSIX path prefixes that anchor an artefact source tree.
# Order: legacy first (kept until the move lands), then packages/*. Each
# entry is the prefix that gets stripped to obtain the logical path.
_LEGACY_PREFIX = ".agent-src.uncondensed/"
_PACKAGE_SUFFIX = "/.agent-src.uncondensed/"


def artefact_roots() -> list[Path]:
    """Every existing directory that contains source ``.md`` artefacts.

    Returns at most one ``.agent-src.uncondensed/`` root (legacy) plus
    one root per ``packages/*/`` subdirectory that exposes its own
    ``.agent-src.uncondensed/`` tree. Order is stable: legacy first,
    then ``packages/`` entries sorted alphabetically.
    """
    roots: list[Path] = []
    if LEGACY_SRC.exists():
        roots.append(LEGACY_SRC)
    if PACKAGES.exists():
        for pkg in sorted(PACKAGES.iterdir()):
            sub = pkg / ".agent-src.uncondensed"
            if sub.is_dir():
                roots.append(sub)
    return roots


def iter_artefacts(suffix: str = ".md") -> Iterator[Path]:
    """Yield every artefact file under every active source root.

    Files are returned in deterministic order: roots in the order from
    ``artefact_roots()``, files within each root sorted by path. Symlinks
    and non-files are skipped.
    """
    for root in artefact_roots():
        for p in sorted(root.rglob(f"*{suffix}")):
            if p.is_file():
                yield p


def iter_all_sources() -> Iterator[tuple[Path, str]]:
    """Yield ``(physical_path, logical_relpath)`` for every file under every root.

    Same deterministic order as :func:`iter_artefacts` but covers *all*
    files (md and non-md) and pre-computes the logical relative path.
    If a logical path appears in multiple roots (legacy + packages/ during
    the move window) the first wins — caller is responsible for ensuring
    that does not happen post-move.
    """
    seen: set[str] = set()
    for root in artefact_roots():
        for p in sorted(root.rglob("*")):
            if not p.is_file():
                continue
            try:
                rel = p.relative_to(root).as_posix()
            except ValueError:
                continue
            if rel in seen:
                continue
            seen.add(rel)
            yield p, rel


def resolve_logical(logical_rel: str) -> Path | None:
    """Return the physical path that backs ``logical_rel``, or ``None``.

    Walks :func:`artefact_roots` in order and returns the first hit.
    """
    rel = logical_rel.replace("\\", "/").lstrip("/")
    for root in artefact_roots():
        p = root / rel
        if p.exists():
            return p
    return None


def logical_relpath(path: Path) -> str:
    """Return the artefact's logical identity path (POSIX, no prefix).

    Examples:
        ``.agent-src.uncondensed/skills/laravel/SKILL.md``
            → ``skills/laravel/SKILL.md``
        ``packages/pack-laravel/.agent-src.uncondensed/skills/laravel/SKILL.md``
            → ``skills/laravel/SKILL.md``
        ``packages/core/.agent-src.uncondensed/rules/scope-control.md``
            → ``rules/scope-control.md``

    Raises ``ValueError`` if ``path`` is not under any known source root.
    """
    p = path.resolve() if path.is_absolute() else (ROOT / path).resolve()
    for root in artefact_roots():
        try:
            return p.relative_to(root.resolve()).as_posix()
        except ValueError:
            continue
    raise ValueError(f"path is not under any artefact root: {path}")


def strip_source_prefix(rel: str) -> str | None:
    """Strip the ``.agent-src.uncondensed/`` anchor from a repo-relative path.

    Accepts both the legacy flat layout and the monorepo packages layout.
    Returns ``None`` if the path is not under any source root.

    Examples:
        ``".agent-src.uncondensed/rules/foo.md"`` → ``"rules/foo.md"``
        ``"packages/core/.agent-src.uncondensed/rules/foo.md"`` → ``"rules/foo.md"``
        ``"packages/pack-laravel/.agent-src.uncondensed/skills/x/SKILL.md"``
            → ``"skills/x/SKILL.md"``
        ``"docs/architecture.md"`` → ``None``
    """
    posix = rel.replace("\\", "/")
    if posix.startswith(_LEGACY_PREFIX):
        return posix[len(_LEGACY_PREFIX):]
    if posix.startswith("packages/"):
        idx = posix.find(_PACKAGE_SUFFIX)
        if idx != -1:
            return posix[idx + len(_PACKAGE_SUFFIX):]
    return None


def is_artefact_path(rel: str) -> bool:
    """``True`` if a repo-relative POSIX path sits under any source root."""
    return strip_source_prefix(rel) is not None


def resolve_package_core_path(relative_target: str) -> Path:
    """Return the canonical ``packages/core/<relative_target>`` path.

    The single resolution point for every gate that enforces something
    against a fixed ``packages/core/`` target. A future move of the
    ``packages/core/`` tree updates :data:`PACKAGE_CORE` here — one
    resolver — instead of N hard-coded ``REPO_ROOT / "packages" / "core"``
    constants scattered across gate scripts (the ``aab5755`` silent-no-op
    class this eliminates).

    Pure resolver: deterministic, **no filesystem I/O**. ``agent_src`` is
    imported by scanners that must stay usable in the legacy-only and
    pack-only layouts (see :func:`artefact_roots`), so this MUST NOT
    assert existence at import or call time — a packages/core existence
    check here would break those layouts. Callers that need existence
    check it themselves; ``scripts/check_gate_paths.py`` is the single
    gate that asserts the enforced targets resolve under ``packages/core/``.

    Examples:
        ``resolve_package_core_path(".agent-src.uncondensed")``
            → ``<repo>/packages/core/.agent-src.uncondensed``
        ``resolve_package_core_path(".agent-src.uncondensed/commands")``
            → ``<repo>/packages/core/.agent-src.uncondensed/commands``
        ``resolve_package_core_path("")`` → ``<repo>/packages/core``
    """
    rel = relative_target.replace("\\", "/").lstrip("/")
    return PACKAGE_CORE / rel if rel else PACKAGE_CORE
