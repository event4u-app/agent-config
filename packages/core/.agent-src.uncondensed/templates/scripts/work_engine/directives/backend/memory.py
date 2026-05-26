"""``memory`` step — bounded retrieval over the four allowed types.

Contract (see
``docs/contracts/implement-ticket-flow.md#memory-retrieval-contract``):

- Four allowed types: ``domain-invariants``, ``architecture-decisions``,
  ``incident-learnings``, ``historical-patterns``.
- Hard cap of **12** hits total across the four types.
- Keys derive from the ticket — title tokens plus acceptance-criterion
  tokens plus any already-known ``files`` hint. Tokenisation is
  deliberately naive (whitespace split, lower-cased) so the retrieval
  shape stays reproducible in tests.
- Step always returns ``SUCCESS``. Zero hits is a valid outcome
  ("nothing in memory touches this ticket") — the ``report`` step
  drops the memory section when that happens rather than padding.

The step stores each hit as a plain ``dict`` on ``state.memory`` so
consumers outside Python (the delivery report, JSON log lines) can
round-trip the structure without pickling dataclasses.
"""
from __future__ import annotations

import re
from typing import Any, Iterable

from ...delivery_state import DeliveryState, Outcome, StepResult

MEMORY_TYPES: tuple[str, ...] = (
    "domain-invariants",
    "architecture-decisions",
    "incident-learnings",
    "historical-patterns",
)
"""The four types allowed by the flow contract. No aliases, no extras."""

MAX_HITS: int = 12
"""Hard cap per the roadmap — never raise without amending the contract."""

AMBIGUITIES: tuple[dict[str, str], ...] = ()
"""Memory retrieval always succeeds — zero hits is a valid outcome.

Declared empty so the aggregate registry in ``steps/__init__.py``
can round-trip every step's surfaces without a special case.
"""

_WORD = re.compile(r"[A-Za-z][A-Za-z0-9_\-]{2,}")
_STOPWORDS = frozenset(
    {
        "the", "and", "for", "with", "from", "into", "that", "this",
        "should", "must", "when", "then", "will", "have", "has",
        "are", "was", "were", "can", "could", "would", "shall",
        "also", "which", "where", "while", "make", "made", "use",
        "used", "using", "user", "users", "test", "tests",
    },
)


def run(state: DeliveryState) -> StepResult:
    """Populate ``state.memory`` with up to :data:`MAX_HITS` hits."""
    retrieve = _resolve_retrieve()
    keys = _keys_from_ticket(state.ticket)
    hits = retrieve(list(MEMORY_TYPES), keys, MAX_HITS)

    # ``retrieve`` returns ``Hit`` dataclasses; coerce to dicts so the
    # state is serialisation-ready for the report step and metrics log.
    state.memory = [_as_dict(h) for h in hits[:MAX_HITS]]
    return StepResult(outcome=Outcome.SUCCESS)


def _resolve_retrieve():
    """Import ``memory_lookup.retrieve`` lazily so tests can monkeypatch it.

    Importing at module load time would freeze the reference before
    tests can swap in a fake, which is the standard gotcha with the
    ``from X import Y`` form. Deferring the import keeps the step
    patchable from a single attribute (``memory_lookup.retrieve``).
    """
    import memory_lookup  # noqa: WPS433 — deliberately late import

    return memory_lookup.retrieve


def _keys_from_ticket(ticket: dict[str, Any]) -> list[str]:
    """Derive retrieval keys from the ticket.

    Three sources, in priority order so callers reading the log can
    reconstruct why a hit scored: explicit ``files`` hints first,
    then title tokens, then acceptance-criterion tokens. Duplicates
    are removed while preserving first-seen order.
    """
    keys: list[str] = []
    _extend_unique(keys, _as_str_list(ticket.get("files")))
    _extend_unique(keys, _tokenise(ticket.get("title")))
    for ac in _as_str_list(ticket.get("acceptance_criteria")):
        _extend_unique(keys, _tokenise(ac))
    return keys


def _tokenise(value: Any) -> Iterable[str]:
    """Return lower-cased content words from ``value`` (empty when absent)."""
    if not isinstance(value, str):
        return []
    return [
        match.group(0).lower()
        for match in _WORD.finditer(value)
        if match.group(0).lower() not in _STOPWORDS
    ]


def _as_str_list(value: Any) -> list[str]:
    """Coerce ``value`` to a list of non-empty strings."""
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, str) and item.strip()]


def _extend_unique(target: list[str], source: Iterable[str]) -> None:
    """Append items from ``source`` to ``target`` skipping duplicates."""
    seen = set(target)
    for item in source:
        if item in seen:
            continue
        target.append(item)
        seen.add(item)


def _as_dict(hit: Any) -> dict[str, Any]:
    """Coerce a ``Hit`` (or pre-dict test fake) into a plain dict."""
    as_dict = getattr(hit, "as_dict", None)
    if callable(as_dict):
        return as_dict()
    if isinstance(hit, dict):
        return dict(hit)
    # Fallback path — should not happen in production, but keeps the
    # step from crashing if a fixture returns a raw namespace object.
    return {"entry": repr(hit)}
