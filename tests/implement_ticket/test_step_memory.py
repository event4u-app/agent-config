"""Tests for the ``memory`` step.

The step relies on ``memory_lookup.retrieve`` to do the actual work,
so these tests monkeypatch the ``retrieve`` function. We assert:

- SUCCESS outcome on every path (memory never blocks).
- The 4 allowed types are forwarded verbatim, no extras, no aliases.
- The 12-hit cap is enforced at the step boundary, not trusted from
  the underlying retrieval.
- Keys derive from ``files`` → title → acceptance criteria, in that
  order, with duplicates removed and stop-words dropped.
- Each hit lands on ``state.memory`` as a plain ``dict``.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import pytest

from implement_ticket import DeliveryState, Outcome
from implement_ticket.steps import memory as memory_step


@dataclass
class _FakeHit:
    """Minimal Hit stand-in — mirrors the ``as_dict`` contract."""

    id: str
    type: str
    source: str = "curated"
    path: str = "agents/memory/fake"
    score: float = 0.5

    def as_dict(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "type": self.type,
            "source": self.source,
            "path": self.path,
            "score": self.score,
        }


@pytest.fixture
def _capture_retrieve(monkeypatch):
    """Install a spy on ``memory_lookup.retrieve``.

    The spy records ``(types, keys, limit)`` from each call and
    returns whatever the test hands it. We import ``memory_lookup``
    locally so the fixture does not couple tests that don't need it
    to the side effect of pulling the module in.
    """
    import memory_lookup

    captured: dict[str, Any] = {}

    def _fake(types, keys, limit):
        captured["types"] = list(types)
        captured["keys"] = list(keys)
        captured["limit"] = limit
        return captured.get("returns", [])

    monkeypatch.setattr(memory_lookup, "retrieve", _fake)
    return captured


def _ticket(**overrides: Any) -> dict[str, Any]:
    base = {
        "id": "TICKET-9",
        "title": "Reduce webhook retry storm",
        "acceptance_criteria": [
            "Webhook retries back off exponentially after the third failure.",
        ],
    }
    base.update(overrides)
    return base


def test_memory_returns_success_and_records_hits(_capture_retrieve) -> None:
    _capture_retrieve["returns"] = [
        _FakeHit(id="inv-1", type="domain-invariants"),
        _FakeHit(id="adr-7", type="architecture-decisions"),
    ]
    state = DeliveryState(ticket=_ticket())

    result = memory_step.run(state)

    assert result.outcome is Outcome.SUCCESS
    assert [hit["id"] for hit in state.memory] == ["inv-1", "adr-7"]
    assert state.memory[0]["type"] == "domain-invariants"


def test_memory_forwards_only_the_four_allowed_types(_capture_retrieve) -> None:
    state = DeliveryState(ticket=_ticket())

    memory_step.run(state)

    assert _capture_retrieve["types"] == [
        "domain-invariants",
        "architecture-decisions",
        "incident-learnings",
        "historical-patterns",
    ]


def test_memory_enforces_twelve_hit_cap_at_step_boundary(_capture_retrieve) -> None:
    # Return 20 hits — the step must truncate to 12 regardless of what
    # the underlying retrieval hands back.
    _capture_retrieve["returns"] = [
        _FakeHit(id=f"inv-{i}", type="domain-invariants") for i in range(20)
    ]
    state = DeliveryState(ticket=_ticket())

    memory_step.run(state)

    assert len(state.memory) == memory_step.MAX_HITS == 12
    assert _capture_retrieve["limit"] == 12


def test_memory_keys_prefer_files_then_title_then_ac(_capture_retrieve) -> None:
    state = DeliveryState(
        ticket=_ticket(
            files=["app/Http/Webhook.php"],
            title="Reduce webhook retry storm",
            acceptance_criteria=["Retries back off after the third failure."],
        ),
    )

    memory_step.run(state)

    keys = _capture_retrieve["keys"]
    assert keys[0] == "app/Http/Webhook.php"
    # Title tokens come next, AC tokens last. Stop-words are stripped.
    assert "webhook" in keys
    assert "retry" in keys
    assert "the" not in keys  # stop-word dropped
    # Ordering is preserved, no duplicates.
    assert len(keys) == len(set(keys))


def test_memory_empty_hits_still_succeeds(_capture_retrieve) -> None:
    _capture_retrieve["returns"] = []
    state = DeliveryState(ticket=_ticket())

    result = memory_step.run(state)

    assert result.outcome is Outcome.SUCCESS
    assert state.memory == []


def test_memory_coerces_non_hit_objects(_capture_retrieve) -> None:
    _capture_retrieve["returns"] = [{"id": "raw-1", "type": "incident-learnings"}]
    state = DeliveryState(ticket=_ticket())

    memory_step.run(state)

    assert state.memory == [{"id": "raw-1", "type": "incident-learnings"}]
