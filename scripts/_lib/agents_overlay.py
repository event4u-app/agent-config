"""Resolve files under ``agents/<kind>/<name>.md`` via the cascade.

Phase 1 of road-to-portable-runtime-and-update-check. Companion to
``agent_settings.py``: where the settings loader merges YAML, this
resolves single-file overlays — overrides, contexts, decisions — to a
single deepest match across the in-project ancestor chain plus the
user-global directory (when the ``kind`` is whitelisted).

Resolution order (deepest wins, every layer optional):

  N. ``~/.event4u/agent-config/agents/<kind>/<name>.md`` (user-global; weakest;
                                                          ``kind`` must be in
                                                          ``USER_GLOBAL_OVERLAY_KINDS``;
                                                          legacy
                                                          ``~/.config/agent-config/agents/``
                                                          tree read as fallback)
N-1. ``<repo-root>/agents/<kind>/<name>.md``
N-2. ``<intermediate-dir>/agents/<kind>/<name>.md``      (optional)
  1. ``<CWD>/agents/<kind>/<name>.md``                   (deepest, wins)

Asymmetry: ``overrides/`` is the developer's personal layer and may
live user-global; ``contexts/`` and ``decisions/`` are project-shaped
and must not leak across projects, so the user-global layer is
silently skipped for them. Stateful subdirs (``state/``, ``memory/``,
``roadmaps/``, ``work_engine/``, ``council-*/``) are not cascade-eligible
at all and raise ``ValueError`` when passed as ``kind``.

Contract — pure, read-only, tolerant:

* Does not read file contents — returns the resolved ``Path`` only.
* Missing layer / missing file → silently skipped, never raises.
* Invalid ``kind`` → ``ValueError`` (programmer error, not user input).
* No file is ever created or written by this module.
"""
from __future__ import annotations

import logging
from pathlib import Path

from scripts._lib import user_global_paths
from scripts._lib.agent_settings import find_project_root

logger = logging.getLogger(__name__)

#: Subdirs of ``agents/`` that participate in the cascade. Every entry
#: is **additive** (single-file artefacts; deepest wins). Stateful or
#: session-scoped subdirs (``state/``, ``memory/``, ``roadmaps/``,
#: ``work_engine/``, ``.agent-prices.md``, ``council-*/``) are
#: deliberately excluded — they are project-rooted only.
CASCADE_ELIGIBLE_KINDS: frozenset[str] = frozenset({
    "overrides",
    "contexts",
    "decisions",
})

#: Subset of :data:`CASCADE_ELIGIBLE_KINDS` allowed to live at the
#: user-global layer (``~/.event4u/agent-config/agents/<kind>/``).
#: ``contexts/`` and ``decisions/`` are project-shaped and must not leak
#: across projects; only ``overrides/`` — the developer's personal
#: layer — is whitelisted.
USER_GLOBAL_OVERLAY_KINDS: frozenset[str] = frozenset({"overrides"})

#: Canonical write target under the new vendor namespace. The probe in
#: :func:`resolve_overlay` adds the legacy ``~/.config/agent-config/agents/``
#: tree as a read-only fallback for pre-2.4 installs.
USER_GLOBAL_AGENTS_DIR = user_global_paths.write_target("agents")
_LEGACY_USER_GLOBAL_AGENTS_DIR = user_global_paths.legacy_xdg_root() / "agents"


def resolve_overlay(name: str, kind: str, cwd: Path) -> Path | None:
    """Return the deepest existing ``agents/<kind>/<name>.md`` or ``None``.

    Walks the in-project ancestor chain from ``cwd`` to the ``.git``
    repo root (inclusive) and probes each layer for
    ``agents/<kind>/<name>.md``. Falls through to the user-global
    directory only when ``kind in USER_GLOBAL_OVERLAY_KINDS``. Returns
    the **deepest** existing file (highest precedence), or ``None`` if
    no layer carries the overlay.

    ``name`` is treated as a basename — no path traversal, no
    subdirectories. Callers that need nested layouts should encode the
    structure inside the overlay file, not the filename.
    """
    if kind not in CASCADE_ELIGIBLE_KINDS:
        raise ValueError(
            f"agents_overlay: kind {kind!r} not cascade-eligible "
            f"(allowed: {sorted(CASCADE_ELIGIBLE_KINDS)})",
        )

    # Candidate layers, shallowest → deepest. Last match wins.
    candidates: list[Path] = []

    if kind in USER_GLOBAL_OVERLAY_KINDS:
        # Legacy first, new last — deepest wins, so the new namespace
        # overrides the legacy path when both happen to exist mid-migration.
        candidates.append(_LEGACY_USER_GLOBAL_AGENTS_DIR / kind / f"{name}.md")
        candidates.append(USER_GLOBAL_AGENTS_DIR / kind / f"{name}.md")

    root = find_project_root(cwd)
    if root is not None:
        cwd_resolved = cwd.resolve()
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
        for layer_dir in chain:
            candidates.append(layer_dir / "agents" / kind / f"{name}.md")

    deepest: Path | None = None
    for candidate in candidates:
        if candidate.is_file():
            deepest = candidate
    return deepest
