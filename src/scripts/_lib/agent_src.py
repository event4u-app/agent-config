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

import re
from pathlib import Path
from typing import Iterator

ROOT = Path(__file__).resolve().parents[3]
LEGACY_SRC = ROOT / ".agent-src.uncondensed"
PACKAGES = ROOT / "packages"
PACKAGE_CORE = PACKAGES / "core"

# 6.0.0-D flat shared library (road-to-6.0.0-d-structural-restructure). Skills
# and rules move out of the per-pack ``packages/*/.agent-src.uncondensed/`` trees
# into one flat, shared namespace. Unlike a ``.agent-src.uncondensed/`` root —
# where the logical path equals ``relative_to(root)`` — these roots map onto a
# fixed logical prefix (``skills/`` / ``rules/``) because the physical directory
# is already the category. See :func:`_root_specs`.
SRC = ROOT / "src"
SRC_SKILLS = SRC / "skills"
SRC_RULES = SRC / "rules"

# 6.0.0-D Phase 4 (Step 10): commands move out of the per-pack
# ``packages/*/.agent-src.uncondensed/commands/`` trees into pack-physical
# ``src/domains/<pack>/<subpath>/command.md``. Unlike skills/rules (whose
# physical category == logical category), a command's LOGICAL identity is
# preserved exactly: ``src/domains/<pack>/<subpath>/command.md`` maps to
# ``commands/<subpath>.md`` — the ``<pack>`` segment is stripped and the
# always-``command.md`` leaf is replaced by the subpath. This keeps
# condensation hashes, the ``.agent-src/commands/`` projection, discovery,
# and every cross-reference byte-stable across the move (council-converged,
# 2026-06-03: preserve-logical-identity for the structural step; the
# invocation-name rename is Step 12). The mapping is PATH-based, not
# frontmatter ``name:``-based, so the 5 ``agents/user/*`` outliers (whose
# ``name`` hyphenates the last two segments) move losslessly.
SRC_DOMAINS = SRC / "domains"
_SRC_DOMAINS_PREFIX = "src/domains/"


def _domains_command_logical(p: Path) -> str | None:
    """Map a physical ``src/domains`` command file to its logical path.

    ``src/domains/<pack>/<subpath...>/command.md`` → ``commands/<subpath...>.md``.
    Returns ``None`` for anything that is not a ``command.md`` leaf with at
    least one verb segment after the pack (so a bare ``src/domains/<pack>/``
    or a ``pack.yaml``/``README.md`` is ignored). The ``command.md`` leaf is
    the activation gate the council asked for: an empty/command-less domains
    tree yields nothing.
    """
    try:
        rel = p.relative_to(SRC_DOMAINS).as_posix()
    except ValueError:
        return None
    parts = rel.split("/")
    if len(parts) < 3 or parts[-1] != "command.md":
        return None
    subpath = "/".join(parts[1:-1])  # drop <pack> and the command.md leaf
    return f"commands/{subpath}.md"


def _iter_domains_commands() -> Iterator[tuple[Path, str]]:
    """Yield ``(physical_path, logical_relpath)`` for every domains command.

    Deterministic order. Naturally inert until ``src/domains/*/**/command.md``
    files exist (the activation gate).
    """
    if not SRC_DOMAINS.is_dir():
        return
    for p in sorted(SRC_DOMAINS.rglob("command.md")):
        if not p.is_file():
            continue
        logical = _domains_command_logical(p)
        if logical is not None:
            yield p, logical


# --- Canonical command-slug derivation (ADR-044 amendment, 2026-06-04) --------
#
# The slug a command projects to (``.agent-src/commands/<slug>.md``, then the
# ``.claude`` / ``.cursor`` invocation name) is derived from the SOURCE PATH:
# the ``<pack>`` segment is stripped and the remaining subpath is hyphenated
# (A1). A pack MAY opt into a slug prefix via ``slug_prefix:`` in its
# ``pack.yaml`` (A3) — then every command in that pack projects as
# ``<prefix>-<subpath>`` (e.g. the ``git`` pack with ``slug_prefix: git`` →
# ``git/commit`` → ``git-commit``). Default = no prefix; product-surface packs
# (``meta`` → ``council``/``research``) keep the bare subpath. Frontmatter
# ``name:`` is display-only and NEVER the slug source. This is the single source
# of truth every consumer (condense, discovery, collision lint) routes through.

_SLUG_PREFIX_RE = re.compile(
    r'^slug_prefix:\s*"?([a-z][a-z0-9-]*)"?\s*$', re.MULTILINE
)
_slug_prefix_cache: dict[str, str] = {}


def pack_slug_prefix(pack_id: str) -> str:
    """Return the ``slug_prefix`` declared in ``src/domains/<pack>/pack.yaml``.

    Empty string when the pack has no prefix (the default) or no manifest.
    Cached per pack id. Read with a minimal line scan so this lightweight lib
    stays YAML-dependency-free (the manifest is generator-written, flat keys).
    """
    if pack_id in _slug_prefix_cache:
        return _slug_prefix_cache[pack_id]
    prefix = ""
    manifest = SRC_DOMAINS / pack_id / "pack.yaml"
    if manifest.is_file():
        m = _SLUG_PREFIX_RE.search(manifest.read_text(encoding="utf-8"))
        if m:
            prefix = m.group(1)
    _slug_prefix_cache[pack_id] = prefix
    return prefix


def command_slug(physical_path: Path) -> str | None:
    """Canonical flat slug for a ``src/domains`` command file.

    ``src/domains/<pack>/<subpath>/command.md`` → ``<subpath hyphenated>``,
    pack-prefixed when the pack declares ``slug_prefix`` (A3). Returns ``None``
    for anything that is not a domains ``command.md`` leaf.
    """
    logical = _domains_command_logical(physical_path)  # commands/<subpath>.md
    if logical is None:
        return None
    base = "-".join(Path(logical[len("commands/"):]).with_suffix("").parts)
    if not base:
        return None
    try:
        pack_id = physical_path.relative_to(SRC_DOMAINS).parts[0]
    except ValueError:
        return base
    prefix = pack_slug_prefix(pack_id)
    if prefix and base != prefix and not base.startswith(prefix + "-"):
        return f"{prefix}-{base}"
    return base

# Repo-relative POSIX path prefixes that anchor an artefact source tree.
# Order: legacy first (kept until the move lands), then packages/*. Each
# entry is the prefix that gets stripped to obtain the logical path.
_LEGACY_PREFIX = ".agent-src.uncondensed/"
_PACKAGE_SUFFIX = "/.agent-src.uncondensed/"
_SRC_SKILLS_PREFIX = "src/skills/"
_SRC_RULES_PREFIX = "src/rules/"


def _root_specs() -> list[tuple[Path, str]]:
    """Every active ``(physical_root, logical_prefix)`` artefact source.

    The logical path of a file under ``physical_root`` is
    ``logical_prefix + file.relative_to(physical_root)``. For the legacy and
    ``packages/*/`` ``.agent-src.uncondensed/`` roots the prefix is empty —
    the directory already contains ``skills/`` / ``rules/`` / ``commands/``
    subtrees. For the 6.0.0-D flat library roots (``src/skills``,
    ``src/rules``) the prefix is the category (``skills/`` / ``rules/``)
    because the directory IS the category.

    Order is stable: legacy first, then ``packages/`` entries sorted
    alphabetically, then the flat library roots. ``resolve_logical`` and
    ``logical_relpath`` walk this order and return the first hit, so a
    logical path present in more than one root (the move window) resolves
    to the earliest — callers ensure no genuine duplicate post-move.
    """
    specs: list[tuple[Path, str]] = []
    if LEGACY_SRC.exists():
        specs.append((LEGACY_SRC, ""))
    if PACKAGES.exists():
        for pkg in sorted(PACKAGES.iterdir()):
            sub = pkg / ".agent-src.uncondensed"
            if sub.is_dir():
                specs.append((sub, ""))
    if SRC_SKILLS.is_dir():
        specs.append((SRC_SKILLS, "skills/"))
    if SRC_RULES.is_dir():
        specs.append((SRC_RULES, "rules/"))
    return specs


def artefact_roots() -> list[Path]:
    """Every existing **container** directory under which the per-category
    subdirectories (``skills/`` / ``rules/`` / ``commands/`` / …) live.

    This is the "category-append" view used by the many scanners that do
    ``root / "skills"`` / ``root / "rules"`` etc. It returns at most one
    ``.agent-src.uncondensed/`` root (legacy), one per ``packages/*/``
    subdirectory, and — once the 6.0.0-D flat library exists — the ``src/``
    container (so ``src / "skills"`` → ``src/skills`` resolves for those
    callers). Order is stable: legacy, ``packages/`` sorted, then ``src``.

    NOTE: ``src`` is the CONTAINER, not a leaf — its logical mapping is the
    per-category prefix in :func:`_root_specs`, NOT ``relative_to(src)``.
    Callers that compute logical paths or rglob a whole root must use
    :func:`iter_all_sources` / :func:`iter_artefacts` / :func:`logical_relpath`,
    which walk :func:`_root_specs` (the leaf view) and never over-collect
    ``src/app`` / ``src/domains`` non-artefact subtrees.
    """
    roots: list[Path] = []
    if LEGACY_SRC.exists():
        roots.append(LEGACY_SRC)
    if PACKAGES.exists():
        for pkg in sorted(PACKAGES.iterdir()):
            sub = pkg / ".agent-src.uncondensed"
            if sub.is_dir():
                roots.append(sub)
    if SRC_SKILLS.is_dir() or SRC_RULES.is_dir():
        roots.append(SRC)
    return roots


def iter_artefacts(suffix: str = ".md") -> Iterator[Path]:
    """Yield every artefact file under every active source root.

    Walks :func:`_root_specs` (the leaf view) so the 6.0.0-D flat library
    is covered without over-collecting ``src/app`` / ``src/domains``.
    Deterministic order; deduplicated on logical path so a file present in
    two roots during the move window is yielded once. Symlinks and
    non-files are skipped.
    """
    seen: set[str] = set()
    for root, prefix in _root_specs():
        for p in sorted(root.rglob(f"*{suffix}")):
            if not p.is_file():
                continue
            rel = prefix + p.relative_to(root).as_posix()
            if rel in seen:
                continue
            seen.add(rel)
            yield p
    if suffix == ".md":
        for p, rel in _iter_domains_commands():
            if rel in seen:
                continue
            seen.add(rel)
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
    for root, prefix in _root_specs():
        for p in sorted(root.rglob("*")):
            if not p.is_file():
                continue
            try:
                rel = prefix + p.relative_to(root).as_posix()
            except ValueError:
                continue
            if rel in seen:
                continue
            seen.add(rel)
            yield p, rel
    for p, rel in _iter_domains_commands():
        if rel in seen:
            continue
        seen.add(rel)
        yield p, rel


def iter_commands() -> Iterator[Path]:
    """Yield every command source file across all layouts.

    Covers the legacy / ``packages/*/.agent-src.uncondensed/commands/`` trees
    AND the 6.0.0-D ``src/domains/<pack>/<subpath>/command.md`` homes,
    deduplicated on the logical command path (``commands/<subpath>.md``) so a
    command present in two layouts during the move window is yielded once
    (packages-tree wins, matching the rest of this module's first-win order).
    The category-append scanners (``root / "commands"``) cannot see the
    domains homes — ``src/domains`` is not a ``root / "commands"`` container —
    so any scanner that needs the full command set must use this helper.
    """
    seen: set[str] = set()
    for root, prefix in _root_specs():
        if prefix:  # flat skills/rules roots carry no commands subtree
            continue
        base = root / "commands"
        if not base.is_dir():
            continue
        for p in sorted(base.rglob("*.md")):
            if not p.is_file():
                continue
            rel = "commands/" + p.relative_to(base).as_posix()
            if rel in seen:
                continue
            seen.add(rel)
            yield p
    for p, rel in _iter_domains_commands():
        if rel in seen:
            continue
        seen.add(rel)
        yield p


def resolve_logical(logical_rel: str) -> Path | None:
    """Return the physical path that backs ``logical_rel``, or ``None``.

    Walks :func:`_root_specs` in order and returns the first hit. A flat
    library root only matches a logical path under its prefix
    (``skills/`` / ``rules/``); the suffix after the prefix is the path
    inside that physical root.
    """
    rel = logical_rel.replace("\\", "/").lstrip("/")
    for root, prefix in _root_specs():
        if prefix:
            if not rel.startswith(prefix):
                continue
            p = root / rel[len(prefix):]
        else:
            p = root / rel
        if p.exists():
            return p
    # 6.0.0-D domains commands: a logical ``commands/<subpath>.md`` is backed
    # by ``src/domains/<pack>/<subpath>/command.md``. The pack is not encoded
    # in the logical path, so glob the domains tree for the matching leaf.
    if rel.startswith("commands/") and rel.endswith(".md") and SRC_DOMAINS.is_dir():
        subpath = rel[len("commands/"):-len(".md")]
        for pack_dir in sorted(SRC_DOMAINS.iterdir()):
            cand = pack_dir / subpath / "command.md"
            if cand.is_file():
                return cand
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
    for root, prefix in _root_specs():
        try:
            return prefix + p.relative_to(root.resolve()).as_posix()
        except ValueError:
            continue
    # 6.0.0-D domains command (src/domains/<pack>/<subpath>/command.md).
    domains_logical = _domains_command_logical(p)
    if domains_logical is not None:
        return domains_logical
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
    # 6.0.0-D flat library: the physical category prefix maps to the logical
    # category. ``src/skills/x/SKILL.md`` → ``skills/x/SKILL.md``.
    if posix.startswith(_SRC_SKILLS_PREFIX):
        return "skills/" + posix[len(_SRC_SKILLS_PREFIX):]
    if posix.startswith(_SRC_RULES_PREFIX):
        return "rules/" + posix[len(_SRC_RULES_PREFIX):]
    # 6.0.0-D domains command: src/domains/<pack>/<subpath>/command.md
    # → commands/<subpath>.md (pack stripped, command.md leaf → subpath).
    if posix.startswith(_SRC_DOMAINS_PREFIX) and posix.endswith("/command.md"):
        rest = posix[len(_SRC_DOMAINS_PREFIX):]  # <pack>/<subpath>/command.md
        parts = rest.split("/")
        if len(parts) >= 3:
            return "commands/" + "/".join(parts[1:-1]) + ".md"
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
