"""Producer-side helpers for the memory-visibility line.

Implements the v1 line shape from
``docs/contracts/memory-visibility-v1.md``:

    🧠 Memory: <hits>/<asks> · ids=[<comma-separated-ids>]

The semantics matched to the work-engine model:

* The ``memory`` step retrieves across the four allowed memory types
  (``MEMORY_TYPES`` in ``directives.backend.memory``). Each type is
  one ``ask`` from the visibility-line perspective.
* ``hits`` counts distinct types that returned at least one entry.
* ``ids`` is the deduped list of returned entry ids preserving the
  retrieval order encoded in ``state.memory``.

Privacy floor: this module never emits entry bodies, summaries,
``path``/``source`` fields, or anything beyond ``id`` and ``type``.
The privacy regression test (``tests/contracts/test_memory_
visibility_redaction.py``) keeps this guarantee enforced.
"""
from __future__ import annotations

from typing import Any, Iterable

ICON = "\U0001F9E0"  # 🧠
DEFAULT_MAX_INLINE_IDS = 5
DEFAULT_ASKED_TYPES = (
    "domain-invariants",
    "architecture-decisions",
    "incident-learnings",
    "historical-patterns",
)


def summarise_visibility(
    memory: Any,
    *,
    asked_types: Iterable[str] = DEFAULT_ASKED_TYPES,
) -> dict[str, Any]:
    """Reduce ``state.memory`` into the visibility-line slice.

    ``memory`` is the list of hit dicts produced by
    ``directives.backend.memory``. Returns ``{"asks", "hits", "ids"}``
    with privacy-safe values only.
    """
    asked = tuple(asked_types)
    if not memory or not isinstance(memory, list):
        return {"asks": 0, "hits": 0, "ids": []}
    asks = len(asked)
    seen_types: set[str] = set()
    ids: list[str] = []
    seen_ids: set[str] = set()
    for entry in memory:
        if not isinstance(entry, dict):
            continue
        type_value = entry.get("type")
        if isinstance(type_value, str):
            seen_types.add(type_value)
        entry_id = entry.get("id") or entry.get("rule_id")
        if not isinstance(entry_id, (str, int)):
            continue
        sid = str(entry_id)
        if sid in seen_ids:
            continue
        seen_ids.add(sid)
        ids.append(sid)
    hits = len(seen_types) if seen_types else (1 if ids else 0)
    return {"asks": asks, "hits": hits, "ids": ids}


def format_line(
    summary: dict[str, Any],
    *,
    max_inline_ids: int = DEFAULT_MAX_INLINE_IDS,
) -> str | None:
    """Render the visibility line; return ``None`` when ``asks == 0``.

    Cap inline ids at ``max_inline_ids`` and append ``…+N`` when the
    list is longer. Returning ``None`` enforces the contract clause
    "If ``asks == 0``, the engine MUST suppress the line entirely".
    """
    asks = int(summary.get("asks", 0) or 0)
    if asks <= 0:
        return None
    hits = int(summary.get("hits", 0) or 0)
    raw_ids = summary.get("ids") or []
    ids = [str(i) for i in raw_ids if isinstance(i, (str, int))]
    if max_inline_ids < 0:
        max_inline_ids = 0
    inline = ids[:max_inline_ids]
    overflow = len(ids) - len(inline)
    rendered_ids = ", ".join(inline)
    if overflow > 0:
        suffix = ", " if rendered_ids else ""
        rendered_ids = f"{rendered_ids}{suffix}\u2026+{overflow}"
    return f"{ICON} Memory: {hits}/{asks} \u00b7 ids=[{rendered_ids}]"


def should_emit(
    summary: dict[str, Any],
    *,
    cost_profile: str = "standard",
    visibility_off: bool = False,
) -> bool:
    """Apply the cadence + opt-out gates from the contract."""
    if visibility_off:
        return False
    asks = int(summary.get("asks", 0) or 0)
    if asks <= 0:
        return False
    profile = (cost_profile or "standard").strip().lower()
    if profile == "lean":
        return asks >= 3
    return True


__all__ = [
    "DEFAULT_ASKED_TYPES",
    "DEFAULT_MAX_INLINE_IDS",
    "ICON",
    "format_line",
    "should_emit",
    "summarise_visibility",
]
