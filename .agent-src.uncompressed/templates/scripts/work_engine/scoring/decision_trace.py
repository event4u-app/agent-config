"""Confidence-band + risk-class heuristics for decision-trace v1.

These heuristics back the JSON envelope emitted by
:class:`work_engine.hooks.builtin.DecisionTraceHook`. They live here
(under ``scoring/``) so the rules and the hook share a single source
of truth, and so unit tests can exercise the heuristics without
spinning up a dispatcher.

Confidence-band heuristic (per
``docs/contracts/decision-trace-v1.md``):

* ``high``   — ``memory.hits ≥ 2`` AND
  ``verify.first_try_passes == verify.claims`` AND no ambiguity flag.
* ``medium`` — ``memory.hits ≥ 1`` OR ``verify.first_try_passes ≥ 1``.
* ``low``    — otherwise.

Edge case: ``verify.claims == 0`` is **not** ``high`` by default; it
folds into ``medium`` if at least one memory hit landed, ``low``
otherwise.

Risk-class heuristic: maximum risk across the files the phase
touched. With no file-ownership matrix wired in yet, the
implementation defaults to ``low`` and exposes a ``files`` argument
so a future hook can pass concrete paths. If the phase touched any
files at all the heuristic returns ``medium`` so reviewers stay
nudged toward a closer look until the matrix lands.
"""
from __future__ import annotations

from typing import Any, Iterable

BAND_HIGH = "high"
BAND_MEDIUM = "medium"
BAND_LOW = "low"

RISK_HIGH = "high"
RISK_MEDIUM = "medium"
RISK_LOW = "low"


def derive_confidence_band(
    *,
    memory_hits: int,
    verify_claims: int,
    verify_first_try_passes: int,
    ambiguity_flag: bool,
) -> str:
    """Return ``high`` / ``medium`` / ``low`` per the v1 heuristic."""
    if (
        memory_hits >= 2
        and verify_claims > 0
        and verify_first_try_passes == verify_claims
        and not ambiguity_flag
    ):
        return BAND_HIGH
    if memory_hits >= 1 or verify_first_try_passes >= 1:
        return BAND_MEDIUM
    return BAND_LOW


def derive_risk_class(changes: Any) -> str:
    """Return the trace-level risk class.

    ``changes`` is the ``delivery.changes`` slice — a list of dicts in
    the canonical engine shape, or ``None`` for pure planning phases.
    Until the file-ownership matrix is wired in, "any change touched"
    maps to ``medium``; "no change" maps to ``low``. ``high`` is
    reserved for the future ownership-matrix lookup.
    """
    if not changes:
        return RISK_LOW
    if isinstance(changes, Iterable):
        try:
            count = sum(1 for _ in changes)
        except TypeError:
            return RISK_LOW
        return RISK_MEDIUM if count > 0 else RISK_LOW
    return RISK_LOW


def summarise_memory(
    memory: Any, *, limit: int = 32,
) -> dict[str, Any]:
    """Reduce ``state.memory`` into the trace-envelope ``memory`` slice.

    The engine stores memory entries as dicts with at least an ``id``
    or ``rule_id`` key plus arbitrary per-entry payload. The trace
    only carries ids — bodies stay behind the privacy floor.
    """
    if not memory:
        return {"asks": 0, "hits": 0, "ids": []}
    ids: list[str] = []
    asks = 0
    hits = 0
    for entry in memory:
        if not isinstance(entry, dict):
            continue
        asks += int(entry.get("asks", 1) or 0) or 1
        if entry.get("hit", True):
            hits += 1
            entry_id = entry.get("id") or entry.get("rule_id")
            if entry_id and len(ids) < limit:
                ids.append(str(entry_id))
    return {"asks": asks, "hits": hits, "ids": ids}


def summarise_verify(verify: Any) -> dict[str, int]:
    """Reduce ``state.verify`` into the trace-envelope ``verify`` slice.

    ``verify`` may be ``None`` (no verify run yet), a dict carrying
    ``claims`` / ``first_try_passes``, or a list of attempt records.
    Anything else collapses to zeros.
    """
    if verify is None:
        return {"claims": 0, "first_try_passes": 0}
    if isinstance(verify, dict):
        claims = int(verify.get("claims", 0) or 0)
        passes = int(verify.get("first_try_passes", 0) or 0)
        return {"claims": claims, "first_try_passes": passes}
    if isinstance(verify, list):
        claims = len(verify)
        passes = sum(
            1 for entry in verify
            if isinstance(entry, dict) and entry.get("first_try_pass")
        )
        return {"claims": claims, "first_try_passes": passes}
    return {"claims": 0, "first_try_passes": 0}


__all__ = [
    "BAND_HIGH",
    "BAND_MEDIUM",
    "BAND_LOW",
    "RISK_HIGH",
    "RISK_MEDIUM",
    "RISK_LOW",
    "derive_confidence_band",
    "derive_risk_class",
    "summarise_memory",
    "summarise_verify",
]
