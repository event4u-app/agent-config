"""Locate artefact source roots across the monorepo physical layout.

Phase 4 of the monorepo migration (ADR-017) physically moves source
artefacts out of the flat ``.agent-src.uncompressed/`` directory into
``packages/core/.agent-src.uncompressed/`` and
``packages/pack-*/.agent-src.uncompressed/`` trees. This helper hides
that decision from every scanner so they keep working pre-move and
post-move with the same call shape.

Contract:

- ``artefact_roots()`` returns every directory that contains source
  ``.md`` artefacts. Pre-move that is ``.agent-src.uncompressed/`` at
  the repo root. Post-move it is every ``packages/*/.agent-src.uncompressed/``.
  Both can coexist during the migration window.
- ``iter_artefacts()`` yields every source ``.md`` path under those roots.
- ``logical_relpath(p)`` returns the artefact's stable identity path
  (e.g. ``skills/laravel/SKILL.md``), independent of which physical
  root contains it. This is what manifests, hash maps, and projections
  use as the artefact key.
- ``strip_source_prefix(p)`` returns the same as ``logical_relpath``
  but accepts repo-relative POSIX strings (used by the compressor's
  output-path computation and the LEGACY_SRC_PREFIX logic).
"""
from __future__ import annotations

from pathlib import Path
from typing import Iterator

ROOT = Path(__file__).resolve().parents[2]
LEGACY_SRC = ROOT / ".agent-src.uncompressed"
PACKAGES = ROOT / "packages"

# Repo-relative POSIX path prefixes that anchor an artefact source tree.
# Order: legacy first (kept until the move lands), then packages/*. Each
# entry is the prefix that gets stripped to obtain the logical path.
_LEGACY_PREFIX = ".agent-src.uncompressed/"
_PACKAGE_SUFFIX = "/.agent-src.uncompressed/"


def artefact_roots() -> list[Path]:
    """Every existing directory that contains source ``.md`` artefacts.

    Returns at most one ``.agent-src.uncompressed/`` root (legacy) plus
    one root per ``packages/*/`` subdirectory that exposes its own
    ``.agent-src.uncompressed/`` tree. Order is stable: legacy first,
    then ``packages/`` entries sorted alphabetically.
    """
    roots: list[Path] = []
    if LEGACY_SRC.exists():
        roots.append(LEGACY_SRC)
    if PACKAGES.exists():
        for pkg in sorted(PACKAGES.iterdir()):
            sub = pkg / ".agent-src.uncompressed"
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


def logical_relpath(path: Path) -> str:
    """Return the artefact's logical identity path (POSIX, no prefix).

    Examples:
        ``.agent-src.uncompressed/skills/laravel/SKILL.md``
            → ``skills/laravel/SKILL.md``
        ``packages/pack-laravel/.agent-src.uncompressed/skills/laravel/SKILL.md``
            → ``skills/laravel/SKILL.md``
        ``packages/core/.agent-src.uncompressed/rules/scope-control.md``
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
    """Strip the ``.agent-src.uncompressed/`` anchor from a repo-relative path.

    Accepts both the legacy flat layout and the monorepo packages layout.
    Returns ``None`` if the path is not under any source root.

    Examples:
        ``".agent-src.uncompressed/rules/foo.md"`` → ``"rules/foo.md"``
        ``"packages/core/.agent-src.uncompressed/rules/foo.md"`` → ``"rules/foo.md"``
        ``"packages/pack-laravel/.agent-src.uncompressed/skills/x/SKILL.md"``
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
