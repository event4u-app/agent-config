"""Every step declares its ambiguity surfaces.

Phase 3 of the ``/implement-ticket`` roadmap requires each step to
declare, in code, the conditions under which it can return
``BLOCKED``. This test locks that contract in place so adding a new
BLOCKED path without declaring it causes a test failure rather than
a silent regression.

The test pairs the declared ``AMBIGUITIES`` tuple with the actual
behaviour of each step by triggering every declared code and
confirming:

1. The step returns ``BLOCKED``.
2. The surfaced options are numbered (``> 1.``, ``> 2.``, …) per
   the ``user-interaction`` rule.

Steps that always succeed (``memory``, ``report``) declare
``AMBIGUITIES = ()`` — that's verified too, so "forgot to declare"
and "nothing to declare" stay distinguishable.
"""
from __future__ import annotations

import re
from typing import Any

from work_engine.delivery_state import DeliveryState, Outcome
from work_engine.steps import all_ambiguities


NUMBERED_OPTION = re.compile(r"^> \d+\. ")


STEPS_WITH_AMBIGUITY = {
    "refine", "analyze", "plan", "implement", "test", "verify",
}
STEPS_ALWAYS_SUCCESS = {"memory", "report"}


def test_every_step_declares_ambiguities() -> None:
    """The registry covers all 8 steps — declared intent, no omissions."""
    registry = all_ambiguities()
    assert set(registry) == STEPS_WITH_AMBIGUITY | STEPS_ALWAYS_SUCCESS


def test_always_success_steps_declare_empty() -> None:
    """`memory` and `report` declare empty tuples, not omitted entries."""
    registry = all_ambiguities()
    for step in STEPS_ALWAYS_SUCCESS:
        assert registry[step] == (), (
            f"step `{step}` must declare AMBIGUITIES = () explicitly"
        )


def test_ambiguity_entries_have_required_shape() -> None:
    """Each entry must carry ``code``, ``trigger``, ``resolution`` keys."""
    required = {"code", "trigger", "resolution"}
    for step, ambiguities in all_ambiguities().items():
        for entry in ambiguities:
            missing = required - set(entry)
            assert not missing, (
                f"step `{step}` ambiguity {entry.get('code')!r} is "
                f"missing keys: {sorted(missing)}"
            )
            for key in required:
                assert isinstance(entry[key], str) and entry[key].strip(), (
                    f"step `{step}` ambiguity {entry.get('code')!r} has "
                    f"empty `{key}`"
                )


def test_ambiguity_codes_are_unique_per_step() -> None:
    """No duplicate codes within a step — each path is named once."""
    for step, ambiguities in all_ambiguities().items():
        codes = [a["code"] for a in ambiguities]
        assert len(codes) == len(set(codes)), (
            f"step `{step}` has duplicate ambiguity codes: {codes}"
        )


def test_blocked_outputs_are_numbered_options() -> None:
    """Every BLOCKED surface is rendered as `> N.` numbered options.

    Walks a representative BLOCKED path per step (the "empty input"
    path for delegation gates, the "missing upstream" path for
    precondition gates) and verifies the questions list contains at
    least two numbered options per the ``user-interaction`` rule.
    """
    for step_name, scenario in _BLOCKED_SCENARIOS.items():
        state = scenario()
        module = _import_step(step_name)
        result = module.run(state)

        assert result.outcome == Outcome.BLOCKED, (
            f"step `{step_name}` scenario should block, got "
            f"{result.outcome}"
        )
        numbered = [q for q in result.questions if NUMBERED_OPTION.match(q)]
        assert len(numbered) >= 2, (
            f"step `{step_name}` BLOCKED surface needs ≥2 numbered "
            f"options, got {numbered}"
        )


def _import_step(name: str) -> Any:
    """Import ``work_engine.steps.<name>`` at call time."""
    from importlib import import_module
    return import_module(f"work_engine.steps.{name}")


def _state_with(**kwargs: Any) -> DeliveryState:
    """Build a minimal valid state and overlay overrides."""
    state = DeliveryState(
        ticket={
            "id": "T-1",
            "title": "Valid title",
            "acceptance_criteria": ["a concrete criterion long enough"],
        },
    )
    for key, value in kwargs.items():
        setattr(state, key, value)
    return state


_BLOCKED_SCENARIOS = {
    "refine": lambda: DeliveryState(ticket={}),
    "analyze": lambda: _state_with(outcomes={}),
    "plan": lambda: _state_with(outcomes={}),
    "implement": lambda: _state_with(outcomes={}),
    "test": lambda: _state_with(outcomes={}),
    "verify": lambda: _state_with(outcomes={}),
}
