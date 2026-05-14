"""Unit tests for ``work_engine.scoring.decision_engine``.

Covers the schema parser (defaults, unknown-key rejection, type
validation) and the gate evaluator (per-phase routing, conflict
isolation, action resolution, non-TTY fallback).

Contract: ``docs/contracts/decision-engine-gates.md``.
"""
from __future__ import annotations

import pytest

from work_engine.scoring.decision_engine import (
    ALLOWED_KEYS,
    GATE_PRIORITY,
    DecisionEngineConfigError,
    DecisionEngineSettings,
    GateDecision,
    evaluate_gates,
    parse,
)


# -- parse() -------------------------------------------------------------

def test_parse_none_returns_defaults() -> None:
    s = parse(None)
    assert s == DecisionEngineSettings()
    assert s.surface_traces is False
    assert s.min_confidence == "off"
    assert s.block_on_risk == "off"
    assert s.require_memory_hits is False
    assert s.on_block == "stop"
    assert s.ask_timeout_seconds == 30
    assert s.on_block_fallback == "stop"
    assert s.any_gate_active is False


def test_parse_empty_dict_returns_defaults() -> None:
    assert parse({}) == DecisionEngineSettings()


def test_parse_rejects_non_mapping() -> None:
    with pytest.raises(DecisionEngineConfigError, match="must be a mapping"):
        parse("not a mapping")


def test_parse_rejects_unknown_keys() -> None:
    with pytest.raises(DecisionEngineConfigError, match="unknown key"):
        parse({"surface_traces": True, "not_a_real_key": 1})


def test_allowed_keys_match_schema() -> None:
    assert ALLOWED_KEYS == frozenset({
        "surface_traces",
        "min_confidence",
        "block_on_risk",
        "require_memory_hits",
        "on_block",
        "ask_timeout_seconds",
        "on_block_fallback",
    })


@pytest.mark.parametrize("value,expected", [
    ("low", "low"),
    ("MEDIUM", "medium"),
    ("High", "high"),
    ("off", "off"),
])
def test_parse_level_normalises_case(value: str, expected: str) -> None:
    assert parse({"min_confidence": value}).min_confidence == expected


def test_parse_rejects_invalid_level() -> None:
    with pytest.raises(DecisionEngineConfigError, match="min_confidence"):
        parse({"min_confidence": "extreme"})


def test_parse_rejects_non_string_level() -> None:
    with pytest.raises(DecisionEngineConfigError, match="block_on_risk"):
        parse({"block_on_risk": 3})


def test_parse_accepts_boolean_false_as_off_sentinel() -> None:
    """YAML 1.1 parses unquoted ``off`` as ``False``; the parser must
    treat it as the off sentinel so authors don't have to quote."""
    s = parse({"min_confidence": False, "block_on_risk": False})
    assert s.min_confidence == "off"
    assert s.block_on_risk == "off"
    assert s.any_gate_active is False


def test_parse_rejects_boolean_true_as_level() -> None:
    with pytest.raises(DecisionEngineConfigError, match="boolean True"):
        parse({"min_confidence": True})


def test_parse_rejects_invalid_on_block() -> None:
    with pytest.raises(DecisionEngineConfigError, match="on_block"):
        parse({"on_block": "explode"})


def test_parse_rejects_invalid_fallback() -> None:
    with pytest.raises(DecisionEngineConfigError, match="on_block_fallback"):
        parse({"on_block_fallback": "ask"})


def test_parse_rejects_negative_timeout() -> None:
    with pytest.raises(DecisionEngineConfigError, match="ask_timeout_seconds"):
        parse({"ask_timeout_seconds": -1})


def test_parse_rejects_bool_for_int() -> None:
    with pytest.raises(DecisionEngineConfigError, match="ask_timeout_seconds"):
        parse({"ask_timeout_seconds": True})


@pytest.mark.parametrize("raw,expected", [
    ("true", True), ("yes", True), ("on", True), ("1", True),
    ("false", False), ("no", False), ("off", False), ("0", False),
    (True, True), (False, False),
])
def test_parse_coerces_bool(raw, expected: bool) -> None:
    assert parse({"surface_traces": raw}).surface_traces is expected


def test_parse_full_block_roundtrip() -> None:
    s = parse({
        "surface_traces": True,
        "min_confidence": "medium",
        "block_on_risk": "high",
        "require_memory_hits": True,
        "on_block": "ask",
        "ask_timeout_seconds": 60,
        "on_block_fallback": "warn",
    })
    assert s.surface_traces is True
    assert s.min_confidence == "medium"
    assert s.block_on_risk == "high"
    assert s.require_memory_hits is True
    assert s.on_block == "ask"
    assert s.ask_timeout_seconds == 60
    assert s.on_block_fallback == "warn"
    assert s.any_gate_active is True


# -- evaluate_gates() ---------------------------------------------------

def test_evaluate_no_gates_returns_none() -> None:
    s = DecisionEngineSettings()
    assert evaluate_gates(
        s, phase="plan",
        confidence_band="low", risk_class="high", memory_hits=0,
    ) is None


def test_min_confidence_fires_on_plan() -> None:
    s = DecisionEngineSettings(min_confidence="medium")
    decision = evaluate_gates(
        s, phase="plan",
        confidence_band="low", risk_class=None, memory_hits=0,
        is_interactive=lambda: True,
    )
    assert isinstance(decision, GateDecision)
    assert decision.gate_id == "min_confidence"
    assert decision.phase == "plan"
    assert decision.action == "stop"


def test_min_confidence_silent_when_band_at_floor() -> None:
    s = DecisionEngineSettings(min_confidence="medium")
    assert evaluate_gates(
        s, phase="plan",
        confidence_band="medium", risk_class=None, memory_hits=0,
        is_interactive=lambda: True,
    ) is None


def test_min_confidence_does_not_fire_outside_plan() -> None:
    s = DecisionEngineSettings(min_confidence="high")
    for phase in ("refine", "implement", "test", "verify", "report"):
        assert evaluate_gates(
            s, phase=phase,
            confidence_band="low", risk_class=None, memory_hits=0,
        ) is None


def test_block_on_risk_fires_on_implement() -> None:
    s = DecisionEngineSettings(block_on_risk="medium")
    decision = evaluate_gates(
        s, phase="implement",
        confidence_band=None, risk_class="high", memory_hits=0,
        is_interactive=lambda: True,
    )
    assert decision is not None
    assert decision.gate_id == "block_on_risk"
    assert decision.phase == "implement"


def test_block_on_risk_silent_below_ceiling() -> None:
    s = DecisionEngineSettings(block_on_risk="high")
    assert evaluate_gates(
        s, phase="implement",
        confidence_band=None, risk_class="medium", memory_hits=0,
    ) is None


def test_require_memory_hits_fires_on_refine() -> None:
    s = DecisionEngineSettings(require_memory_hits=True)
    decision = evaluate_gates(
        s, phase="refine",
        confidence_band=None, risk_class=None, memory_hits=0,
        is_interactive=lambda: True,
    )
    assert decision is not None
    assert decision.gate_id == "require_memory_hits"


def test_require_memory_hits_silent_with_hits() -> None:
    s = DecisionEngineSettings(require_memory_hits=True)
    assert evaluate_gates(
        s, phase="refine",
        confidence_band=None, risk_class=None, memory_hits=2,
    ) is None


def test_gate_priority_locked() -> None:
    """The priority order is documentary now but locked for future
    additions; assert the wire form so a reorder is caught by tests."""
    assert GATE_PRIORITY == (
        "block_on_risk",
        "require_memory_hits",
        "min_confidence",
    )


def test_cross_phase_gates_dont_interfere() -> None:
    """All three gates active; each phase only sees its own gate."""
    s = DecisionEngineSettings(
        min_confidence="high",
        block_on_risk="low",
        require_memory_hits=True,
    )
    plan = evaluate_gates(
        s, phase="plan",
        confidence_band="low", risk_class="high", memory_hits=0,
        is_interactive=lambda: True,
    )
    assert plan is not None and plan.gate_id == "min_confidence"
    refine = evaluate_gates(
        s, phase="refine",
        confidence_band="low", risk_class="high", memory_hits=0,
        is_interactive=lambda: True,
    )
    assert refine is not None and refine.gate_id == "require_memory_hits"
    impl = evaluate_gates(
        s, phase="implement",
        confidence_band="low", risk_class="high", memory_hits=0,
        is_interactive=lambda: True,
    )
    assert impl is not None and impl.gate_id == "block_on_risk"


# -- action resolution / TTY ---------------------------------------------

def test_action_warn_short_circuits_interactivity() -> None:
    s = DecisionEngineSettings(min_confidence="medium", on_block="warn")
    decision = evaluate_gates(
        s, phase="plan",
        confidence_band="low", risk_class=None, memory_hits=0,
        is_interactive=lambda: False,
    )
    assert decision is not None
    assert decision.action == "warn"


def test_action_stop_short_circuits_interactivity() -> None:
    s = DecisionEngineSettings(min_confidence="medium", on_block="stop")
    decision = evaluate_gates(
        s, phase="plan",
        confidence_band="low", risk_class=None, memory_hits=0,
        is_interactive=lambda: False,
    )
    assert decision is not None
    assert decision.action == "stop"


def test_action_ask_in_interactive_context() -> None:
    s = DecisionEngineSettings(min_confidence="medium", on_block="ask")
    decision = evaluate_gates(
        s, phase="plan",
        confidence_band="low", risk_class=None, memory_hits=0,
        is_interactive=lambda: True,
    )
    assert decision is not None
    assert decision.action == "ask"


def test_action_ask_collapses_to_timeout_in_ci() -> None:
    s = DecisionEngineSettings(min_confidence="medium", on_block="ask")
    decision = evaluate_gates(
        s, phase="plan",
        confidence_band="low", risk_class=None, memory_hits=0,
        is_interactive=lambda: False,
    )
    assert decision is not None
    assert decision.action == "ask_timeout"


def test_default_interactivity_honours_ci_env(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("CI", "true")
    s = DecisionEngineSettings(min_confidence="medium", on_block="ask")
    decision = evaluate_gates(
        s, phase="plan",
        confidence_band="low", risk_class=None, memory_hits=0,
    )
    assert decision is not None
    assert decision.action == "ask_timeout"
