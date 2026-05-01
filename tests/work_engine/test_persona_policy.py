"""Tests for the ``persona_policy`` module.

Locks the three shipped personas and the default-on-miss
semantics. The step handlers trust these flags; renaming a
persona or changing a default is a contract change.
"""
from __future__ import annotations

import pytest

from work_engine import (
    DEFAULT_PERSONA,
    PersonaPolicy,
    known_personas,
    resolve_policy,
)


def test_known_personas_lists_the_three_shipped_names() -> None:
    assert known_personas() == ("senior-engineer", "qa", "advisory")


def test_senior_engineer_allows_everything_and_does_not_widen() -> None:
    policy = resolve_policy("senior-engineer")

    assert policy.name == "senior-engineer"
    assert policy.allows_implement is True
    assert policy.allows_test is True
    assert policy.allows_verify is True
    assert policy.widen_tests is False
    assert policy.suggests_next_commands is True


def test_qa_allows_everything_but_widens_tests() -> None:
    policy = resolve_policy("qa")

    assert policy.name == "qa"
    assert policy.allows_implement is True
    assert policy.allows_test is True
    assert policy.allows_verify is True
    assert policy.widen_tests is True
    assert policy.suggests_next_commands is True


def test_advisory_blocks_implementation_and_suppresses_commands() -> None:
    policy = resolve_policy("advisory")

    assert policy.name == "advisory"
    assert policy.allows_implement is False
    assert policy.allows_test is False
    assert policy.allows_verify is False
    assert policy.widen_tests is False
    assert policy.suggests_next_commands is False


def test_unknown_persona_falls_back_to_default() -> None:
    policy = resolve_policy("product-owner")

    assert policy.name == DEFAULT_PERSONA == "senior-engineer"


def test_empty_persona_falls_back_to_default() -> None:
    policy = resolve_policy("")

    assert policy.name == DEFAULT_PERSONA


def test_none_persona_falls_back_to_default() -> None:
    """``DeliveryState.persona`` is typed ``str`` but tests sometimes pass None."""
    policy = resolve_policy(None)

    assert policy.name == DEFAULT_PERSONA


def test_policy_is_frozen() -> None:
    """The policy is configuration; mutation mid-run must be rejected."""
    policy = resolve_policy("senior-engineer")

    with pytest.raises(Exception):  # FrozenInstanceError at runtime
        policy.allows_implement = False  # type: ignore[misc]


def test_resolve_returns_the_same_singleton_per_name() -> None:
    """Repeated lookups return the same instance — safe to cache at call sites."""
    first = resolve_policy("qa")
    second = resolve_policy("qa")

    assert first is second


def test_persona_policy_is_importable_at_package_root() -> None:
    """The dataclass itself is exposed for consumers that type their own state."""
    assert PersonaPolicy is not None
    assert PersonaPolicy(name="custom").allows_implement is True
