"""``refine`` step — intent gate for the ``ui-trivial`` directive set.

Phase 2 Step 6 of ``agents/roadmaps/road-to-product-ui-track.md``:
``ui-trivial`` is reachable only when Phase 1's intent classifier (or
an explicit user override) labelled the work as ``ui-trivial``. Reaching
this slot through any other route is a routing error, not a user-facing
ambiguity.

The handler is deterministic and tiny: confirm the ticket carries the
expected intent label (or accept the default when ``directive_set`` is
already pinned), and return ``SUCCESS``. The hard safety floor lives at
the ``implement`` slot (``apply.py``); the audit-bypass decision is
re-validated there against the actual edit surface, not the prompt.
"""
from __future__ import annotations

from ...delivery_state import DeliveryState, Outcome, StepResult

EXPECTED_INTENT: str = "ui-trivial"
"""Intent label that gates entry into this directive set."""

AMBIGUITIES: tuple[dict[str, str], ...] = (
    {
        "code": "wrong_intent_for_trivial",
        "trigger": (
            "state.ticket['intent'] is set and not equal to 'ui-trivial' "
            "— routing landed on this set by mistake"
        ),
        "resolution": (
            "abort and re-run with the correct directive_set "
            "(populate_routing should select 'ui' or 'backend' instead)"
        ),
    },
)


def run(state: DeliveryState) -> StepResult:
    """Confirm the ticket's intent matches the trivial path.

    The ticket's ``intent`` is optional on v0 callers; absence is
    treated as a silent pass since the v0 path predates intent
    classification. v1 callers always carry an intent — a mismatch
    means the dispatcher routed incorrectly and we halt loudly so
    the wiring bug surfaces before any edit happens.
    """
    intent = (state.ticket or {}).get("intent")
    if intent is None or intent == EXPECTED_INTENT:
        return StepResult(outcome=Outcome.SUCCESS)

    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            "> Routing error \u2014 the ``ui-trivial`` directive set was "
            f"selected but the ticket's intent is `{intent}`.",
            "> 1. Reclassify \u2014 set `state.directive_set` from the "
            "intent label and re-invoke the engine",
            "> 2. Abort \u2014 drop this run",
        ],
        message=(
            f"intent={intent!r} but directive_set='ui-trivial'; "
            "routing must be reclassified before any edit"
        ),
    )


__all__ = ["AMBIGUITIES", "EXPECTED_INTENT", "run"]
