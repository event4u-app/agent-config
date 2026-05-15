"""Confidence-gate heuristics — step-9 P13."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council.confidence_gate import (  # noqa: E402
    extract_confidence,
    is_refusal,
    is_split_response,
    should_escalate,
)


# ── extract_confidence ──────────────────────────────────────────────────────


def test_extract_confidence_explicit_marker_float() -> None:
    assert extract_confidence("Verdict: ship.\nConfidence: 0.92") == pytest.approx(0.92)


def test_extract_confidence_explicit_marker_percent() -> None:
    assert extract_confidence("All clear. confidence: 85%") == pytest.approx(0.85)


def test_extract_confidence_no_hedges_returns_full() -> None:
    text = "The patch fixes the issue. The regression test in tests/foo passes."
    assert extract_confidence(text) == 1.0


def test_extract_confidence_hedge_density_lowers_score() -> None:
    text = "Maybe this works. I think it's probably ok. Perhaps not sure though."
    score = extract_confidence(text)
    assert score is not None and score < 0.5


def test_extract_confidence_empty_returns_none() -> None:
    assert extract_confidence("") is None
    assert extract_confidence("   \n") is None


def test_extract_confidence_marker_overrides_hedges() -> None:
    text = "Maybe this is fine but I'm not sure.\nConfidence: 0.95"
    assert extract_confidence(text) == pytest.approx(0.95)


# ── is_split_response ───────────────────────────────────────────────────────


def test_split_option_a_vs_b() -> None:
    assert is_split_response("Either Option A: revert. Or Option B: patch forward.")


def test_split_two_verdict_blocks() -> None:
    text = "Verdict: ship\n---\nVerdict: hold\n"
    assert is_split_response(text)


def test_split_german_variants() -> None:
    assert is_split_response("Variante 1 wäre konservativ; Variante 2 wäre schneller.")


def test_not_split_single_verdict() -> None:
    assert not is_split_response("Verdict: ship. All checks green.")


# ── is_refusal ──────────────────────────────────────────────────────────────


def test_refusal_english() -> None:
    assert is_refusal("I cannot decide without more context.")
    assert is_refusal("I don't know.")
    assert is_refusal("This is unclear from the diff alone.")


def test_refusal_german() -> None:
    assert is_refusal("Kann ich nicht entscheiden ohne mehr Kontext.")
    assert is_refusal("Weiß ich nicht.")


def test_refusal_empty_treated_as_refusal() -> None:
    assert is_refusal("")
    assert is_refusal(None)  # type: ignore[arg-type]


def test_not_refusal_strong_answer() -> None:
    assert not is_refusal("Ship it. The test in tests/foo.py exercises the regression.")


# ── should_escalate ─────────────────────────────────────────────────────────


def test_escalate_on_empty() -> None:
    d = should_escalate("", floor=0.7)
    assert d.escalate and d.reason == "refusal"


def test_escalate_on_refusal_before_other_checks() -> None:
    d = should_escalate("I cannot decide.", floor=0.7)
    assert d.escalate and d.reason == "refusal"


def test_escalate_on_split() -> None:
    d = should_escalate(
        "This is a long enough answer to clear the short-response cutoff.\n"
        "Option A: revert. Option B: patch forward.",
        floor=0.7,
    )
    assert d.escalate and d.reason == "split"


def test_escalate_on_short_response() -> None:
    d = should_escalate("Yes.", floor=0.7)
    assert d.escalate and d.reason == "short_response"


def test_escalate_on_low_confidence_marker() -> None:
    d = should_escalate(
        "The patch addresses the regression test in tests/foo.\n"
        "Confidence: 0.40",
        floor=0.7,
    )
    assert d.escalate and d.reason == "low_confidence"
    assert d.confidence == pytest.approx(0.40)


def test_no_escalate_high_confidence() -> None:
    d = should_escalate(
        "The fix is correct. The regression test in tests/foo.py covers it.\n"
        "Confidence: 0.92",
        floor=0.7,
    )
    assert not d.escalate
    assert d.reason == "ok"
    assert d.confidence == pytest.approx(0.92)


def test_no_escalate_implicit_high_confidence() -> None:
    text = (
        "The fix updates the validator. The regression test asserts the new "
        "error message. Both PHPStan and ECS pass."
    )
    d = should_escalate(text, floor=0.7)
    assert not d.escalate
    assert d.reason == "ok"
