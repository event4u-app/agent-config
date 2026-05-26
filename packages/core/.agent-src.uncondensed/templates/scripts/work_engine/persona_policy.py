"""Persona policy — behavioural parameters resolved from ``state.persona``.

Three personas ship today, each keyed by the string already carried
on ``DeliveryState.persona`` (see
``docs/contracts/implement-ticket-flow.md#personas``):

``senior-engineer``
    Default. Runs every step. No test widening.
``qa``
    Runs every step but widens the ``test`` scope to the full suite
    (``scope=full`` in the ``run-tests`` directive) so regressions
    outside the changed paths are caught.
``advisory``
    Plan-only mode. ``implement``, ``test``, and ``verify`` short-
    circuit to SUCCESS without doing work — the flow produces a
    delivery report whose value is the plan itself, and next-command
    suggestions are suppressed (nothing was committed).

Unknown persona names fall back to ``senior-engineer`` rather than
raising, so a mistyped value never aborts a run mid-flight. The
caller is responsible for validating the string at the state-
construction boundary if strict behaviour is needed.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

DEFAULT_PERSONA = "senior-engineer"
"""Name used when ``state.persona`` is empty or unrecognised."""


@dataclass(frozen=True)
class PersonaPolicy:
    """Behavioural flags read by individual step handlers.

    Frozen so a step cannot mutate the policy mid-run by accident —
    policy is resolved once and treated as read-only configuration.
    """

    name: str
    allows_implement: bool = True
    allows_test: bool = True
    allows_verify: bool = True
    widen_tests: bool = False
    suggests_next_commands: bool = True


_POLICIES: dict[str, PersonaPolicy] = {
    "senior-engineer": PersonaPolicy(name="senior-engineer"),
    "qa": PersonaPolicy(name="qa", widen_tests=True),
    "advisory": PersonaPolicy(
        name="advisory",
        allows_implement=False,
        allows_test=False,
        allows_verify=False,
        suggests_next_commands=False,
    ),
}


def resolve_policy(persona: Any) -> PersonaPolicy:
    """Return the policy for ``persona``; fall back to the default on miss.

    ``persona`` is typed ``Any`` because it originates from
    ``DeliveryState.persona`` which the dataclass declares as ``str``
    but does not enforce — a caller may set it to ``None`` while
    wiring up a partial state in tests.
    """
    if isinstance(persona, str) and persona in _POLICIES:
        return _POLICIES[persona]
    return _POLICIES[DEFAULT_PERSONA]


def known_personas() -> tuple[str, ...]:
    """Return the persona names shipped today, in insertion order."""
    return tuple(_POLICIES.keys())


__all__ = [
    "DEFAULT_PERSONA",
    "PersonaPolicy",
    "known_personas",
    "resolve_policy",
]
