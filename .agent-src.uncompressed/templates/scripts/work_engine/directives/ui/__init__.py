"""UI directive set — Phase 1 routing stub.

Phase 1 of ``agents/roadmaps/road-to-product-ui-track.md`` lands the
intent classifier and routes UI-shaped inputs (``ui-build``,
``ui-improve``) to ``directive_set="ui"``. The actual handlers
(``audit`` → ``design`` → ``apply`` → ``review`` → ``polish``) are
Phase 2 / Phase 3 work.

Until those phases ship, this stub keeps the routing pipeline honest:
the dispatcher loads the set, walks into ``refine``, and the step
emits a clean ``BLOCKED`` halt with three numbered options pointing
at the deferred audit/design/apply track. This preserves the
"clean refusal halt" contract that GT-P4 locks in CI — much better
than a config-error exit that hides the routing decision.

When Phase 2 lands the real ``audit.py``/``design.py``/etc., this
file is replaced with the full step wiring per the
:mod:`work_engine.directives.backend` shape.
"""
from __future__ import annotations

from collections.abc import Mapping
from typing import Any

from ...delivery_state import DeliveryState, Outcome, Step, StepResult

DIRECTIVE_SET_NAME = "ui"
"""External name carried in ``state.directive_set`` for this set."""

ROADMAP = "agents/roadmaps/road-to-product-ui-track.md"
"""Roadmap that promotes this stub to a working directive bundle."""

SUPPORTED_KINDS: tuple[str, ...] = ("ticket", "prompt", "diff", "file")
"""Input kinds the routed-to stub accepts.

Phase 1 wires every UI-classifiable input shape (ticket prose,
free-form prompt, ``diff`` / ``file`` improve-this-screen envelopes)
through to this set so the deferral halt fires consistently. Phase 2's
real ``audit.py`` keeps the same tuple.
"""

AMBIGUITIES: tuple[dict[str, str], ...] = (
    {
        "code": "ui_track_stub",
        "trigger": "input classified as UI work; UI directive set is a Phase 1 stub",
        "resolution": "wait for road-to-product-ui-track Phase 2/3, re-frame as backend, or abort",
    },
)


def _stub_refine(state: DeliveryState) -> StepResult:
    """Halt with a clean UI-track-deferred refusal.

    Phase 1 only routes; the audit / design / apply handlers land in
    later phases. The refusal carries three numbered options so the
    surface matches the GT-P4 contract ("user decides — re-frame, park,
    or abort") without inventing handlers that don't exist yet.
    """
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            "> Input routed to UI directive set — track is a Phase 1 stub.",
            (
                "> Audit / design / apply / review / polish land in later phases of "
                f"`{ROADMAP}`; until they ship, the engine cannot drive UI work end to end."
            ),
            "> 1. Re-frame as a backend-only prompt — I'll re-score and proceed",
            "> 2. Park this prompt — wait for the UI track and re-invoke `/work` then",
            "> 3. Abort — drop this input",
        ],
    )


def _stub_unreachable(name: str) -> Step:
    """Build a placeholder step that should never be reached.

    The dispatcher halts at ``refine`` (the first step), so handlers
    further down the flow never run. We still need *something* in the
    ``get_steps()`` mapping because :func:`work_engine.dispatcher.dispatch`
    asserts every entry of ``STEP_ORDER`` is wired before walking.
    Returning a clearly named handler that raises if invoked surfaces
    an obvious bug if the dispatcher ever advances past ``refine``
    against this stub.
    """

    def _handler(state: DeliveryState) -> StepResult:  # pragma: no cover - guard
        raise NotImplementedError(
            f"work_engine.directives.ui.{name} is a Phase 1 stub; "
            f"{ROADMAP} Phase 2/3 must land before {name} can run.",
        )

    _handler.__name__ = f"_stub_{name}"
    return _handler


def get_steps() -> Mapping[str, Step]:
    """Return the eight-step mapping the dispatcher walks.

    Only ``refine`` carries real behavior in Phase 1: it halts with the
    deferred-track refusal. The seven downstream steps are
    raise-on-call placeholders kept solely to satisfy the dispatcher's
    completeness check.
    """
    return {
        "refine": _stub_refine,
        "memory": _stub_unreachable("memory"),
        "analyze": _stub_unreachable("analyze"),
        "plan": _stub_unreachable("plan"),
        "implement": _stub_unreachable("implement"),
        "test": _stub_unreachable("test"),
        "verify": _stub_unreachable("verify"),
        "report": _stub_unreachable("report"),
    }


def all_ambiguities() -> dict[str, tuple[dict[str, str], ...]]:
    """Per-step ambiguity declarations.

    Mirrors :func:`work_engine.directives.backend.all_ambiguities`.
    Only ``refine`` declares an ambiguity in Phase 1 — the deferred
    track itself.
    """
    empty: tuple[dict[str, str], ...] = ()
    return {
        "refine": AMBIGUITIES,
        "memory": empty,
        "analyze": empty,
        "plan": empty,
        "implement": empty,
        "test": empty,
        "verify": empty,
        "report": empty,
    }


__all__ = [
    "AMBIGUITIES",
    "DIRECTIVE_SET_NAME",
    "ROADMAP",
    "SUPPORTED_KINDS",
    "all_ambiguities",
    "get_steps",
]
