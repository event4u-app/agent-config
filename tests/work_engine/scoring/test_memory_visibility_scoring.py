"""Unit tests for ``work_engine.scoring.memory_visibility``.

Covers ``summarise_visibility`` semantics, ``format_line`` rendering
with the 5-id cap + ``…+N`` overflow, and the cadence/opt-out gate.
"""
from __future__ import annotations

import pytest

from work_engine.scoring.memory_visibility import (
    DEFAULT_ASKED_TYPES,
    format_line,
    should_emit,
    summarise_visibility,
)


def _hit(entry_id: str, mem_type: str = "domain-invariants") -> dict:
    return {"id": entry_id, "type": mem_type, "score": 1.0}


def test_empty_memory_yields_zero_asks() -> None:
    summary = summarise_visibility([])
    assert summary == {"asks": 0, "hits": 0, "ids": []}


def test_none_memory_yields_zero_asks() -> None:
    summary = summarise_visibility(None)
    assert summary == {"asks": 0, "hits": 0, "ids": []}


def test_summary_counts_distinct_types_as_hits() -> None:
    memory = [
        _hit("mem_1", "domain-invariants"),
        _hit("mem_2", "domain-invariants"),
        _hit("mem_3", "incident-learnings"),
    ]
    summary = summarise_visibility(memory)
    assert summary["asks"] == len(DEFAULT_ASKED_TYPES)
    assert summary["hits"] == 2
    assert summary["ids"] == ["mem_1", "mem_2", "mem_3"]


def test_summary_dedupes_ids_preserving_order() -> None:
    memory = [
        _hit("mem_1"),
        _hit("mem_1"),
        _hit("mem_2", "incident-learnings"),
    ]
    summary = summarise_visibility(memory)
    assert summary["ids"] == ["mem_1", "mem_2"]


def test_summary_skips_entries_without_id() -> None:
    memory = [{"type": "domain-invariants"}, _hit("mem_1")]
    summary = summarise_visibility(memory)
    assert summary["ids"] == ["mem_1"]


def test_summary_accepts_rule_id_field() -> None:
    summary = summarise_visibility([{"rule_id": "ID-7", "type": "x"}])
    assert summary["ids"] == ["ID-7"]


def test_format_line_basic_shape() -> None:
    line = format_line({"asks": 4, "hits": 2, "ids": ["a", "b"]})
    assert line == "\U0001F9E0 Memory: 2/4 \u00b7 ids=[a, b]"


def test_format_line_returns_none_when_no_asks() -> None:
    assert format_line({"asks": 0, "hits": 0, "ids": []}) is None


def test_format_line_empty_ids_brackets() -> None:
    line = format_line({"asks": 2, "hits": 0, "ids": []})
    assert line == "\U0001F9E0 Memory: 0/2 \u00b7 ids=[]"


def test_format_line_caps_at_five_ids_with_overflow_marker() -> None:
    ids = [f"mem_{i}" for i in range(7)]
    line = format_line({"asks": 4, "hits": 4, "ids": ids})
    assert line is not None
    assert "mem_0, mem_1, mem_2, mem_3, mem_4" in line
    assert "\u2026+2" in line
    assert "mem_5" not in line
    assert "mem_6" not in line


def test_format_line_overflow_only_when_above_cap() -> None:
    ids = [f"mem_{i}" for i in range(5)]
    line = format_line({"asks": 5, "hits": 5, "ids": ids})
    assert line is not None
    assert "\u2026+" not in line


@pytest.mark.parametrize(
    "profile, asks, expected",
    [
        ("standard", 1, True),
        ("standard", 0, False),
        ("verbose", 1, True),
        ("lean", 1, False),
        ("lean", 2, False),
        ("lean", 3, True),
        ("lean", 5, True),
    ],
)
def test_should_emit_cadence_table(profile: str, asks: int, expected: bool) -> None:
    summary = {"asks": asks, "hits": 0, "ids": []}
    assert should_emit(summary, cost_profile=profile) is expected


def test_should_emit_respects_visibility_off() -> None:
    summary = {"asks": 4, "hits": 2, "ids": ["a", "b"]}
    assert should_emit(summary, visibility_off=True) is False


def test_should_emit_default_profile_is_standard() -> None:
    summary = {"asks": 1, "hits": 1, "ids": ["a"]}
    assert should_emit(summary) is True
