"""Phase 3 deferral halt for the UI directive set.

Phase 2 of ``agents/roadmaps/road-to-product-ui-track.md`` lands the
audit gate at the ``refine`` slot; the design / apply / review /
polish handlers (and their dispatcher slots) are Phase 3 work. Until
those phases ship, this stub keeps the post-audit halt contract
honest: once ``refine`` (the audit gate) returns ``SUCCESS``, the
dispatcher advances to the next slot, which lands here and halts
with three numbered options pointing at the deferred track.

This preserves the "audit completes cleanly, downstream halts loudly"
contract the goldens lock in CI — much better than a NotImplementedError
that hides the routing decision.
"""
from __future__ import annotations

from ...delivery_state import DeliveryState, Outcome, StepResult

ROADMAP = "agents/roadmaps/road-to-product-ui-track.md"
"""Roadmap that promotes this stub to working design / apply / review / polish."""

AMBIGUITIES: tuple[dict[str, str], ...] = (
    {
        "code": "ui_design_apply_stub",
        "trigger": "audit gate succeeded; design / apply / review / polish are Phase 3 stubs",
        "resolution": "wait for road-to-product-ui-track Phase 3, "
        "park this run, or abort",
    },
)
"""Declared ambiguity surfaces for this stub."""


def run(state: DeliveryState) -> StepResult:
    """Halt with a clean Phase 3 deferral.

    Audit findings live in ``state.ui_audit`` for whoever picks the
    work up later. Three numbered options match the Phase 1 surface
    so callers see a consistent "user decides" shape.
    """
    return StepResult(
        outcome=Outcome.BLOCKED,
        questions=[
            "> UI audit complete \u2014 design / apply / review / polish "
            "land in Phase 3 of the UI track.",
            (
                "> Findings are recorded in `state.ui_audit`; until the "
                f"design dispatch ships in `{ROADMAP}` Phase 3, the "
                "engine cannot turn them into rendered components."
            ),
            "> 1. Park this run — wait for Phase 3 and re-invoke `/work` then",
            "> 2. Continue manually \u2014 hand `state.ui_audit` to a "
            "designer / engineer outside the engine",
            "> 3. Abort — drop this UI request",
        ],
        message=(
            "UI audit complete; design / apply / review / polish are "
            "Phase 3 stubs (road-to-product-ui-track)."
        ),
    )


__all__ = ["AMBIGUITIES", "ROADMAP", "run"]
