"""Resolver-level tests for :mod:`work_engine.resolvers.prompt`.

R2 Phase 2 contract: the prompt resolver wraps a raw user prompt as a
schema-valid :class:`Input` envelope with placeholder slots for the
refiner to fill on the rebound. The resolver is intentionally thin —
it normalises and rejects empty input, nothing else. Quality judgement
is the ``refine-prompt`` skill's job (Phase 3), surfaced through a
confidence band; the resolver only guards the bare minimum so an empty
payload cannot reach the dispatcher.
"""
from __future__ import annotations

import pytest

from work_engine.resolvers.prompt import (
    KIND,
    PromptResolverError,
    build_envelope,
)
from work_engine.state import (
    DEFAULT_DIRECTIVE_SET,
    DEFAULT_INTENT,
    KNOWN_INPUT_KINDS,
    SCHEMA_VERSION,
    Input,
    WorkState,
    from_dict,
    to_dict,
)


class TestEnvelopeShape:
    def test_kind_constant_matches_schema_enum(self) -> None:
        # The resolver's wire value must always be a member of the
        # schema's accepted-kinds set; drift here would mean the
        # resolver builds envelopes the schema rejects.
        assert KIND == "prompt"
        assert KIND in KNOWN_INPUT_KINDS

    def test_envelope_carries_raw_and_empty_refinement_slots(self) -> None:
        envelope = build_envelope("fix the login test")

        assert isinstance(envelope, Input)
        assert envelope.kind == "prompt"
        assert envelope.data == {
            "raw": "fix the login test",
            "reconstructed_ac": [],
            "assumptions": [],
        }

    def test_envelope_preserves_whitespace_and_casing(self) -> None:
        # Refiner reads original spacing/casing for goal-clarity scoring,
        # so the resolver must not normalise either.
        raw = "  Make the Login Page faster  "
        envelope = build_envelope(raw)

        assert envelope.data["raw"] == raw

    def test_envelope_round_trips_through_state(self) -> None:
        # End-to-end check: a resolver-built envelope plugs into a
        # WorkState and survives the schema's serialise/deserialise
        # cycle without losing any field.
        envelope = build_envelope("clarify the README installation steps")
        state = WorkState(
            input=envelope,
            intent=DEFAULT_INTENT,
            directive_set=DEFAULT_DIRECTIVE_SET,
        )

        rebuilt = from_dict(to_dict(state))

        assert rebuilt.input == envelope
        assert rebuilt.version == SCHEMA_VERSION


class TestRejection:
    def test_rejects_non_string(self) -> None:
        with pytest.raises(PromptResolverError, match="must be a string"):
            build_envelope(None)  # type: ignore[arg-type]

    def test_rejects_empty_string(self) -> None:
        with pytest.raises(PromptResolverError, match="empty or whitespace-only"):
            build_envelope("")

    def test_rejects_whitespace_only(self) -> None:
        with pytest.raises(PromptResolverError, match="empty or whitespace-only"):
            build_envelope("   \n\t  ")

    def test_rejects_int(self) -> None:
        with pytest.raises(PromptResolverError, match="must be a string"):
            build_envelope(42)  # type: ignore[arg-type]
