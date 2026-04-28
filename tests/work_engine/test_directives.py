"""Tests for the ``@agent-directive:`` formatting + detection helpers.

The directive prefix is public contract — changing it breaks every
agent that has learned to recognise it — so the tests lock down both
the exact string and the round-trip between ``agent_directive`` and
``is_agent_directive``.
"""
from __future__ import annotations

from work_engine import (
    AGENT_DIRECTIVE_PREFIX,
    agent_directive,
    is_agent_directive,
)


def test_prefix_is_the_documented_value() -> None:
    assert AGENT_DIRECTIVE_PREFIX == "@agent-directive:"


def test_agent_directive_emits_bare_name_when_no_payload() -> None:
    assert agent_directive("implement-plan") == "@agent-directive: implement-plan"


def test_agent_directive_renders_payload_as_key_value_pairs() -> None:
    line = agent_directive("run-tests", scope="targeted", filter="UserTest")

    assert line.startswith("@agent-directive: run-tests ")
    # Order of kwargs is preserved (Python 3.7+), so the assertion is exact.
    assert line == "@agent-directive: run-tests scope=targeted filter=UserTest"


def test_agent_directive_coerces_non_string_values() -> None:
    line = agent_directive("retry", attempt=3, backoff_ms=500)

    assert "attempt=3" in line
    assert "backoff_ms=500" in line


def test_is_agent_directive_recognises_emitted_lines() -> None:
    assert is_agent_directive(agent_directive("implement-plan"))
    assert is_agent_directive(
        agent_directive("run-tests", scope="targeted"),
    )


def test_is_agent_directive_tolerates_leading_whitespace() -> None:
    # Real-world rendering may indent the directive inside a blockquote.
    assert is_agent_directive("   @agent-directive: implement-plan")


def test_is_agent_directive_rejects_user_facing_numbered_options() -> None:
    assert not is_agent_directive("> 1. Continue")
    assert not is_agent_directive("> Ticket missing acceptance criteria.")


def test_is_agent_directive_rejects_non_string_input() -> None:
    assert not is_agent_directive(None)  # type: ignore[arg-type]
    assert not is_agent_directive(42)  # type: ignore[arg-type]
    assert not is_agent_directive(["@agent-directive: implement-plan"])  # type: ignore[arg-type]
