"""End-to-end fixtures for the prompt path through ``backend.refine.run``.

R2 Phase 3 Step 4 — six prompt envelopes spanning the band spectrum
(2 high / 2 medium / 2 low) plus the first-pass delegation case. The
dispatcher branches on the engine-computed band, so these tests pin
the user-facing contract: which outcome each band emits, what the
halt looks like, and that high-band prompts proceed silently.

Fixtures are deliberately concrete (real prompts, real AC lists) so
the freeze-guard harness in Phase 5 can re-use them as Golden
Transcript GT-P1..GT-P4 inputs without re-deriving the band map.
"""
from __future__ import annotations

import pytest

from work_engine import DeliveryState, Outcome
from work_engine.delivery_state import is_agent_directive
from work_engine.directives.backend import refine
from work_engine.scoring import confidence as _confidence


# --- Prompt envelope helpers -------------------------------------------

def _prompt_state(
    raw: str,
    ac: list[str] | None = None,
    assumptions: list[str] | None = None,
    **extra,
) -> DeliveryState:
    """Build a DeliveryState carrying a prompt envelope on ``ticket``.

    Mirrors what ``cli._to_delivery`` produces for ``input.kind="prompt"``:
    the prompt envelope (raw + reconstructed_ac + assumptions) lives on
    ``state.ticket`` and the ticket-shape keys (id/title) are absent.
    """
    payload = {
        "raw": raw,
        "reconstructed_ac": list(ac or ()),
        "assumptions": list(assumptions or ()),
    }
    payload.update(extra)
    return DeliveryState(ticket=payload)


# --- First-pass delegation --------------------------------------------

class TestFirstPassDelegation:
    """Prompt arrives without reconstructed AC → delegate to refine-prompt."""

    def test_emits_agent_directive_when_ac_empty(self) -> None:
        state = _prompt_state(raw="Add a CSV export endpoint", ac=[])

        result = refine.run(state)

        assert result.outcome is Outcome.BLOCKED
        assert is_agent_directive(result.questions[0])
        assert "refine-prompt" in result.questions[0]
        assert any(q.startswith("> 1.") for q in result.questions)
        assert any(q.startswith("> 2.") for q in result.questions)


# --- Band fixtures: 2 high / 2 medium / 2 low -------------------------

_HIGH_1 = (
    "HIGH-1",
    "Add a CSV export endpoint to the audit log; stream up to 90 days "
    "and return 204 for empty ranges. File: app/Http/Controllers/AuditLogController.php",
    [
        "Export endpoint should return a streamed CSV for ranges up to 90 days.",
        "Empty ranges must return HTTP 204 with no body.",
        "Given a 30-day range, the response should be a streamed CSV.",
    ],
)
_HIGH_2 = (
    "HIGH-2",
    "Refactor `App\\Services\\BillingService` to extract retry logic into a separate class.",
    [
        "Retry logic must live in a dedicated class.",
        "BillingService should depend on the new class via constructor injection.",
        "Given a transient failure, the service should retry up to 3 times.",
    ],
)
_MED_1 = (
    "MED-1",
    "Improve performance and also clean up logs",
    ["queries should be faster"],
)
_MED_2 = (
    "MED-2",
    "Migrate the schema",
    ["a column is added"],
)
# Low-band fixtures must carry at least one reconstructed AC — empty AC
# triggers first-pass delegation in `_run_prompt` before scoring runs.
# Reaching the `low` band with non-zero AC requires another dimension to
# drop (irreversible keyword or stack/data implied without a target).
_LOW_1 = (
    "LOW-1",
    "Drop the production database",
    ["nothing remains"],
)
_LOW_2 = (
    "LOW-2",
    "Run a migration",
    ["done"],
)


@pytest.mark.parametrize("name,raw,ac", [_HIGH_1, _HIGH_2])
class TestHighBand:
    def test_emits_success_silently(self, name: str, raw: str, ac: list[str]) -> None:
        state = _prompt_state(raw=raw, ac=ac)

        result = refine.run(state)

        assert result.outcome is Outcome.SUCCESS, f"{name} should be SUCCESS"
        assert result.questions == []

    def test_records_breakdown_on_ticket(self, name: str, raw: str, ac: list[str]) -> None:
        state = _prompt_state(raw=raw, ac=ac)

        refine.run(state)

        confidence = state.ticket["confidence"]
        assert confidence["band"] == "high"
        assert confidence["score"] >= _confidence.BAND_HIGH_MIN
        assert set(confidence["dimensions"]) == set(_confidence.DIMENSION_NAMES)

    def test_mirrors_reconstructed_ac_to_acceptance_criteria(
        self, name: str, raw: str, ac: list[str],
    ) -> None:
        # Downstream gates (analyze, plan, implement) read
        # ``state.ticket['acceptance_criteria']``. Prompt envelopes carry AC
        # under ``reconstructed_ac``; refine MUST mirror it on SUCCESS so the
        # analyze gate doesn't block with "ticket lost its acceptance criteria".
        state = _prompt_state(raw=raw, ac=ac)

        refine.run(state)

        mirrored = state.ticket["acceptance_criteria"]
        assert mirrored == list(ac), f"{name} AC mirror diverged from reconstructed_ac"
        # Independent list — mutating the mirror must not corrupt the prompt slot.
        mirrored.append("__sentinel__")
        assert state.ticket["reconstructed_ac"] == list(ac)


@pytest.mark.parametrize("name,raw,ac", [_MED_1, _MED_2])
class TestMediumBand:
    def test_emits_partial_with_assumptions_report(
        self, name: str, raw: str, ac: list[str],
    ) -> None:
        state = _prompt_state(raw=raw, ac=ac)

        result = refine.run(state)

        assert result.outcome is Outcome.PARTIAL, f"{name} should be PARTIAL"
        joined = "\n".join(result.questions)
        assert "**medium**" in joined
        assert "Reconstructed AC" in joined
        assert "Assumptions" in joined
        # Numbered options for the user round-trip.
        assert any(q.startswith("> 1.") for q in result.questions)
        assert any(q.startswith("> 2.") for q in result.questions)
        assert any(q.startswith("> 3.") for q in result.questions)

    def test_confirmation_flag_releases_to_success(
        self, name: str, raw: str, ac: list[str],
    ) -> None:
        state = _prompt_state(raw=raw, ac=ac, confidence_confirmed=True)

        result = refine.run(state)

        assert result.outcome is Outcome.SUCCESS, f"{name} should release on confirm"
        # Same mirror contract as TestHighBand — medium-confirmed SUCCESS must
        # also project ``reconstructed_ac`` into ``acceptance_criteria`` so
        # the downstream ``analyze`` gate sees a populated slot.
        assert state.ticket["acceptance_criteria"] == list(ac)


@pytest.mark.parametrize("name,raw,ac", [_LOW_1, _LOW_2])
class TestLowBand:
    def test_emits_blocked_with_one_question(
        self, name: str, raw: str, ac: list[str],
    ) -> None:
        state = _prompt_state(raw=raw, ac=ac)

        result = refine.run(state)

        assert result.outcome is Outcome.BLOCKED, f"{name} should be BLOCKED"
        joined = "\n".join(result.questions)
        assert "**low**" in joined
        assert "Weakest dimension" in joined
        # Confirmation flag does NOT release low band — only high/medium.
        state.ticket["confidence_confirmed"] = True
        again = refine.run(state)
        assert again.outcome is Outcome.BLOCKED

    def test_low_band_lists_weakest_dimension_name(
        self, name: str, raw: str, ac: list[str],
    ) -> None:
        state = _prompt_state(raw=raw, ac=ac)

        result = refine.run(state)

        joined = "\n".join(result.questions)
        assert any(d in joined for d in _confidence.DIMENSION_NAMES)


# --- P4.4: Iron-Law lock on the single-question low-band halt ---------

@pytest.mark.parametrize("name,raw,ac", [_LOW_1, _LOW_2])
class TestLowBandSingleQuestion:
    """Regression guard for the `ask-when-uncertain` Iron Law.

    The low-band halt MUST emit exactly one clarifying question and
    exactly one numbered-options block. If a future refactor adds a
    second `?` line, splits the dimension diagnostic into a second
    question, or stacks two option blocks, this test fails — surfacing
    the contract before the engine reaches a user.
    """

    def test_emits_exactly_one_question_mark_line(
        self, name: str, raw: str, ac: list[str],
    ) -> None:
        state = _prompt_state(raw=raw, ac=ac)

        result = refine.run(state)

        # A "question line" is a `> ...?` line that is NOT a numbered option
        # (numbered options can carry `?` in their explanations but they are
        # selectors, not the clarifying question itself).
        question_lines = [
            q for q in result.questions
            if q.endswith("?") and not q.lstrip("> ").startswith(
                ("1.", "2.", "3.", "4.", "5."),
            )
        ]
        assert len(question_lines) == 1, (
            f"{name}: low-band halt must emit exactly one clarifying "
            f"question; got {len(question_lines)}: {question_lines!r}"
        )

    def test_emits_exactly_one_numbered_options_block(
        self, name: str, raw: str, ac: list[str],
    ) -> None:
        state = _prompt_state(raw=raw, ac=ac)

        result = refine.run(state)

        option_starts = [
            q for q in result.questions
            if q.startswith(("> 1.", "> 2.", "> 3."))
        ]
        # A single block: options numbered 1..N consecutively, no gap, no
        # restart. The current contract uses `1. answer` + `2. abort`, so
        # we lock a contiguous range and reject any duplicate `1.`.
        firsts = [q for q in option_starts if q.startswith("> 1.")]
        assert len(firsts) == 1, (
            f"{name}: expected one numbered-options block; saw "
            f"{len(firsts)} `> 1.` lines: {firsts!r}"
        )
        # And no answer prompt past 3 — keeps the user's choice tight.
        assert not any(
            q.startswith(("> 4.", "> 5.")) for q in result.questions
        ), f"{name}: low-band halt must keep the option list ≤ 3"

    def test_message_field_does_not_smuggle_extra_question(
        self, name: str, raw: str, ac: list[str],
    ) -> None:
        """The `message` is operator-facing log text, not a user question.

        Locks that nobody adds a second `?` via the message channel as a
        workaround for the questions-list constraint.
        """
        state = _prompt_state(raw=raw, ac=ac)

        result = refine.run(state)

        assert "?" not in (result.message or ""), (
            f"{name}: message must not carry a clarifying question; "
            f"got: {result.message!r}"
        )


# --- UI-intent rejection -----------------------------------------------

class TestUiIntentRejection:
    """Prompts flagged as UI work are rejected with an R3 pointer.

    R2 Phase 5 Step 2 (GT-P4): the backend dispatch track cannot ship
    UI-shaped prompts cleanly. The refine gate must block before band
    routing — even a high-band UI prompt halts here.
    """

    def test_ui_keyword_blocks_regardless_of_band(self) -> None:
        # Strong scope + AC + verb → would otherwise score high; the UI
        # keyword (`tailwind`, `dark mode`) must override that.
        raw = (
            "Redesign the dashboard with a dark mode tailwind theme — "
            "update layout and button spacing for mobile view."
        )
        ac = [
            "Should support dark mode toggle",
            "Must apply tailwind responsive classes",
            "Given mobile viewport, then the layout reflows",
        ]
        state = _prompt_state(raw=raw, ac=ac)

        result = refine.run(state)

        assert result.outcome is Outcome.BLOCKED
        assert any(
            "UI work" in q or "UI dispatch" in q
            for q in result.questions
        ), f"halt must surface UI-work language; got {result.questions!r}"
        assert any(
            "road-to-product-ui-track" in q for q in result.questions
        ), "halt must point at the R3 roadmap"
        # No agent directive — the orchestrator should NOT auto-recurse
        # into refine-prompt; the user must re-frame or park.
        assert not any(
            is_agent_directive(q) for q in result.questions
        )

    def test_ui_prompt_records_band_and_ui_intent_on_state(self) -> None:
        raw = "Polish the signup form — change button color to indigo."
        ac = ["Should swap primary button colour to indigo-600"]
        state = _prompt_state(raw=raw, ac=ac)

        refine.run(state)

        confidence = state.ticket["confidence"]
        assert confidence["ui_intent"] is True
        # Band is still computed and surfaced for telemetry, even though
        # the UI gate fires before band routing.
        assert confidence["band"] in {"high", "medium", "low"}

    def test_ui_intent_message_carries_band_and_score(self) -> None:
        raw = "Tweak the checkout page tailwind padding."
        state = _prompt_state(raw=raw, ac=["Should reduce padding to p-2"])

        result = refine.run(state)

        assert "UI-intent" in (result.message or "")
        assert "R3" in (result.message or "")

    def test_non_ui_prompt_does_not_trigger_ui_halt(self) -> None:
        """Sanity guard — control case must NOT reach the UI halt path."""
        raw = "Refactor the billing service to extract a TaxCalculator."
        ac = [
            "Should expose TaxCalculator::compute(amount, region)",
            "Must replace inline tax math in InvoiceService",
            "Given a US region, then 7% sales tax is applied",
        ]
        state = _prompt_state(raw=raw, ac=ac)

        result = refine.run(state)

        assert state.ticket["confidence"]["ui_intent"] is False
        # Either SUCCESS (high band) or PARTIAL/BLOCKED on band, but
        # never the UI halt.
        for q in result.questions:
            assert "UI work" not in q
            assert "road-to-product-ui-track" not in q
