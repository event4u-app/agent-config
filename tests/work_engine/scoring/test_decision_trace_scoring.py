"""Heuristic tests for ``work_engine.scoring.decision_trace``.

The contract under test lives in
``docs/contracts/decision-trace-v1.md`` § *Confidence-band heuristic*
and § *Risk-class heuristic*.
"""
from __future__ import annotations

import pytest

from work_engine.scoring.decision_trace import (
    derive_confidence_band,
    derive_risk_class,
    summarise_memory,
    summarise_verify,
)


@pytest.mark.parametrize(
    "memory_hits, claims, passes, ambiguity, expected",
    [
        (2, 2, 2, False, "high"),
        (3, 1, 1, False, "high"),
        (2, 2, 2, True, "medium"),
        (1, 1, 1, False, "medium"),
        (1, 0, 0, False, "medium"),
        (0, 1, 1, False, "medium"),
        (0, 0, 0, False, "low"),
        (2, 0, 0, False, "medium"),
        (2, 2, 1, False, "medium"),
    ],
)
def test_band_matrix(
    memory_hits: int,
    claims: int,
    passes: int,
    ambiguity: bool,
    expected: str,
) -> None:
    assert (
        derive_confidence_band(
            memory_hits=memory_hits,
            verify_claims=claims,
            verify_first_try_passes=passes,
            ambiguity_flag=ambiguity,
        )
        == expected
    )


def test_band_high_blocked_when_zero_claims_zero_hits() -> None:
    """`verify.claims == 0` is *not* high by default."""
    assert (
        derive_confidence_band(
            memory_hits=0,
            verify_claims=0,
            verify_first_try_passes=0,
            ambiguity_flag=False,
        )
        == "low"
    )


def test_risk_low_when_no_changes() -> None:
    assert derive_risk_class(None) == "low"
    assert derive_risk_class([]) == "low"


def test_risk_medium_when_changes_present() -> None:
    assert derive_risk_class([{"path": "a"}]) == "medium"


def test_summarise_memory_counts_hits_and_collects_ids() -> None:
    memory = [
        {"id": "m1", "hit": True},
        {"id": "m2", "hit": False},
        {"rule_id": "m3", "hit": True},
    ]
    result = summarise_memory(memory)
    assert result["hits"] == 2
    assert result["ids"] == ["m1", "m3"]
    assert result["asks"] >= 3


def test_summarise_memory_caps_ids() -> None:
    memory = [{"id": f"m{i}", "hit": True} for i in range(50)]
    assert len(summarise_memory(memory, limit=8)["ids"]) == 8


def test_summarise_memory_handles_empty_inputs() -> None:
    assert summarise_memory(None) == {"asks": 0, "hits": 0, "ids": []}
    assert summarise_memory([]) == {"asks": 0, "hits": 0, "ids": []}


def test_summarise_verify_dict_form() -> None:
    assert summarise_verify({"claims": 3, "first_try_passes": 2}) == {
        "claims": 3,
        "first_try_passes": 2,
    }


def test_summarise_verify_list_form() -> None:
    attempts = [
        {"first_try_pass": True},
        {"first_try_pass": False},
        {"first_try_pass": True},
    ]
    assert summarise_verify(attempts) == {"claims": 3, "first_try_passes": 2}


def test_summarise_verify_handles_none() -> None:
    assert summarise_verify(None) == {"claims": 0, "first_try_passes": 0}
