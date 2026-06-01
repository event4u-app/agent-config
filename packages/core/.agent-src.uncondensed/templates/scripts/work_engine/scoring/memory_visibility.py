"""Producer-side helpers for the memory-visibility line.

Implements the v1 line shape from
``docs/contracts/memory-visibility-v1.md``:

    🧠 Memory: <hits>/<asks> · ids=[<comma-separated-ids>]
    🧠 Memory: <hits>/<asks> · ids=[<...>] · affected: <keys>

The optional ``· affected: <keys>`` trailing segment surfaces which
closed-list decision-trace keys diverged because memory was
consulted — see ``docs/contracts/decision-trace-v1.md`` "Memory
consequence keys".

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

from .decision_trace import derive_confidence_band, derive_risk_class

ICON = "\U0001F9E0"  # 🧠
DEFAULT_MAX_INLINE_IDS = 5
DEFAULT_ASKED_TYPES = (
    "domain-invariants",
    "architecture-decisions",
    "incident-learnings",
    "historical-patterns",
)

CONSEQUENCE_KEYS: tuple[str, ...] = (
    "confidence_band",
    "risk_class",
    "applied_rules",
    "test_plan",
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


def _normalise_key_value(value: Any) -> Any:
    """Return a comparable shape for a consequence-key value.

    List-shaped keys (``applied_rules``, ``test_plan``) compare as
    sorted tuples so order is not a divergence; scalar keys
    (``confidence_band``, ``risk_class``) compare as-is.
    """
    if isinstance(value, list):
        return tuple(sorted(str(item) for item in value))
    return value


def diff_consequence_keys(
    trace_with: dict[str, Any], trace_without: dict[str, Any],
) -> list[str]:
    """Return sorted keys whose values diverge between two traces.

    Iterates the closed ``CONSEQUENCE_KEYS`` list defined in
    ``docs/contracts/decision-trace-v1.md``. A key is considered
    *diverged* when its normalised value differs between the two
    traces. Per the contract, when both sides are ``None`` the key
    is suppressed from the diff entirely.
    """
    affected: list[str] = []
    for key in CONSEQUENCE_KEYS:
        a = trace_with.get(key)
        b = trace_without.get(key)
        if a is None and b is None:
            continue
        if _normalise_key_value(a) != _normalise_key_value(b):
            affected.append(key)
    return sorted(affected)


def compute_affected(
    *,
    memory_hits: int,
    verify_claims: int = 0,
    verify_first_try_passes: int = 0,
    ambiguity_flag: bool = False,
    changes: Any = None,
    applied_rules: list[str] | None = None,
    test_plan: list[str] | None = None,
) -> list[str] | None:
    """Compute the ``affected`` consequence keys for the visibility line.

    Returns:
        * ``None`` when no memory was consulted (``memory_hits <= 0``)
          — caller MUST omit the ``· affected: …`` segment.
        * ``[]`` when memory was consulted but no closed-list key
          diverged — caller MUST render ``· affected: none``.
        * sorted list of keys otherwise.

    The counterfactual trace is "what the heuristics would have
    emitted if ``memory_hits`` had been ``0``". v1 covers
    ``confidence_band`` and ``risk_class`` via the existing scoring
    helpers; ``applied_rules`` and ``test_plan`` pass through
    unchanged because they are not yet memory-derived in the
    engine — the keys stay in the closed list so the diff
    infrastructure is in place when they wire in.
    """
    if memory_hits <= 0:
        return None
    trace_with = {
        "confidence_band": derive_confidence_band(
            memory_hits=memory_hits,
            verify_claims=verify_claims,
            verify_first_try_passes=verify_first_try_passes,
            ambiguity_flag=ambiguity_flag,
        ),
        "risk_class": derive_risk_class(changes),
        "applied_rules": list(applied_rules) if applied_rules else None,
        "test_plan": list(test_plan) if test_plan else None,
    }
    trace_without = {
        "confidence_band": derive_confidence_band(
            memory_hits=0,
            verify_claims=verify_claims,
            verify_first_try_passes=verify_first_try_passes,
            ambiguity_flag=ambiguity_flag,
        ),
        "risk_class": derive_risk_class(changes),
        "applied_rules": list(applied_rules) if applied_rules else None,
        "test_plan": list(test_plan) if test_plan else None,
    }
    return diff_consequence_keys(trace_with, trace_without)


def format_line(
    summary: dict[str, Any],
    *,
    max_inline_ids: int = DEFAULT_MAX_INLINE_IDS,
    affected: list[str] | None = None,
) -> str | None:
    """Render the visibility line; return ``None`` when ``asks == 0``.

    Cap inline ids at ``max_inline_ids`` and append ``…+N`` when the
    list is longer. Returning ``None`` enforces the contract clause
    "If ``asks == 0``, the engine MUST suppress the line entirely".

    When ``affected`` is not ``None``, append the
    ``· affected: <keys>`` trailing segment from
    ``docs/contracts/memory-visibility-v1.md``: empty list renders as
    ``affected: none`` (consulted but no key diverged);
    non-empty list renders the comma-separated keys.
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
    line = f"{ICON} Memory: {hits}/{asks} \u00b7 ids=[{rendered_ids}]"
    if affected is not None:
        rendered_affected = ",".join(affected) if affected else "none"
        line = f"{line} \u00b7 affected: {rendered_affected}"
    return line


def format_changed_decisions_block(
    ids: Iterable[str], affected: Iterable[str] | None,
) -> str | None:
    """Render the end-of-run "Memory changed decisions" report block.

    Per ``docs/contracts/memory-visibility-v1.md``: lists
    ``<id> → <key>`` rows derived from the same diff source as the
    visibility line's ``affected`` segment. Returns ``None`` when
    no key diverged (``affected`` empty / ``None``) so the caller
    suppresses the block entirely.

    Attribution in v1 is aggregate: each consulted id pairs with
    each affected key. Per-id attribution is captured as a
    follow-up risk in the roadmap Risk register.
    """
    if not affected:
        return None
    affected_list = sorted(affected)
    id_list = [str(i) for i in ids if isinstance(i, (str, int))]
    if not id_list:
        return None
    lines = ["Memory changed decisions:"]
    for entry_id in id_list:
        for key in affected_list:
            lines.append(f"- {entry_id} \u2192 {key}")
    return "\n".join(lines)


def should_emit(
    summary: dict[str, Any],
    *,
    memory_cadence: str = "always",
    visibility_off: bool = False,
) -> bool:
    """Apply the cadence + opt-out gates from the contract.

    ``memory_cadence`` is the ``memory.cadence`` cadence key:

    * ``always`` (default) — emit whenever ``asks >= 1``.
    * ``auto`` — emit only when ``asks >= 3`` (reduces noise on
      shallow-retrieval steps).
    * ``never`` — suppress the line entirely.

    ``visibility_off`` is the legacy ``memory.visibility: off`` master
    switch and still wins over any ``memory_cadence`` value.
    """
    if visibility_off:
        return False
    asks = int(summary.get("asks", 0) or 0)
    if asks <= 0:
        return False
    status = (memory_cadence or "always").strip().lower()
    if status == "never":
        return False
    if status == "auto":
        return asks >= 3
    return True


__all__ = [
    "CONSEQUENCE_KEYS",
    "DEFAULT_ASKED_TYPES",
    "DEFAULT_MAX_INLINE_IDS",
    "ICON",
    "compute_affected",
    "diff_consequence_keys",
    "format_changed_decisions_block",
    "format_line",
    "should_emit",
    "summarise_visibility",
]
