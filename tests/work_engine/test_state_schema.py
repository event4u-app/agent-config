"""Schema-level invariants for the v1 ``WorkState`` wire format.

Covers round-trip stability, validation rejects, and the legacy slice
preservation contract that Phase 3 relies on when it lifts the steps
across.
"""
from __future__ import annotations

import json

import pytest

from work_engine.state import (
    DEFAULT_DIRECTIVE_SET,
    DEFAULT_INTENT,
    KNOWN_DIRECTIVE_SETS,
    KNOWN_INPUT_KINDS,
    SCHEMA_VERSION,
    Input,
    SchemaError,
    WorkState,
    dump,
    from_dict,
    load,
    to_dict,
)


def _build_state(**overrides) -> WorkState:
    defaults = dict(
        input=Input(kind="ticket", data={"id": "GT-1", "title": "demo"}),
        intent=DEFAULT_INTENT,
        directive_set=DEFAULT_DIRECTIVE_SET,
        outcomes={"refine": "success"},
        questions=["@agent-directive: create-plan ticket=GT-1"],
        report="",
    )
    defaults.update(overrides)
    return WorkState(**defaults)


class TestRoundTrip:
    def test_to_dict_emits_envelope_first(self) -> None:
        state = _build_state()
        payload = to_dict(state)

        assert list(payload.keys())[:4] == [
            "version",
            "input",
            "intent",
            "directive_set",
        ]
        assert payload["version"] == SCHEMA_VERSION
        assert payload["input"] == {
            "kind": "ticket",
            "data": {"id": "GT-1", "title": "demo"},
        }

    def test_round_trip_preserves_state(self) -> None:
        state = _build_state(
            persona="qa",
            memory=[{"id": "M1", "summary": "prior"}],
            plan=[{"title": "step", "detail": "do thing"}],
            outcomes={"refine": "success", "memory": "success"},
        )

        rebuilt = from_dict(to_dict(state))

        assert rebuilt == state

    def test_dump_and_load_use_canonical_filename(self, tmp_path) -> None:
        state = _build_state()
        target = tmp_path / "nested" / ".work-state.json"

        dump(state, target)
        rebuilt = load(target)

        assert rebuilt == state
        # Canonical layout: pretty-printed, terminating newline, ordered.
        text = target.read_text(encoding="utf-8")
        assert text.endswith("\n")
        assert text.startswith("{\n  \"version\":")


class TestEnvelopeValidation:
    def test_rejects_unknown_input_kind(self) -> None:
        payload = {
            "version": SCHEMA_VERSION,
            "input": {"kind": "screenshot", "data": {}},
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
        }

        with pytest.raises(SchemaError, match="unknown input.kind"):
            from_dict(payload)

    def test_rejects_unknown_directive_set(self) -> None:
        payload = {
            "version": SCHEMA_VERSION,
            "input": {"kind": "ticket", "data": {"id": "X"}},
            "intent": DEFAULT_INTENT,
            "directive_set": "infrastructure",
        }

        with pytest.raises(SchemaError, match="unknown directive_set"):
            from_dict(payload)

    def test_rejects_missing_version(self) -> None:
        payload = {
            "input": {"kind": "ticket", "data": {"id": "X"}},
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
        }

        with pytest.raises(SchemaError, match="version must be 1"):
            from_dict(payload)

    def test_rejects_input_without_object_shape(self) -> None:
        payload = {
            "version": SCHEMA_VERSION,
            "input": "ticket",
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
        }

        with pytest.raises(SchemaError, match="state.input must be a JSON object"):
            from_dict(payload)

    def test_rejects_input_data_non_object(self) -> None:
        payload = {
            "version": SCHEMA_VERSION,
            "input": {"kind": "ticket", "data": ["not", "an", "object"]},
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
        }

        with pytest.raises(SchemaError, match="state.input.data must be a JSON object"):
            from_dict(payload)

    def test_to_dict_rejects_in_memory_drift(self) -> None:
        state = _build_state()
        state.directive_set = "frontend"  # not in KNOWN_DIRECTIVE_SETS

        with pytest.raises(SchemaError, match="unknown directive_set"):
            to_dict(state)

    def test_known_enum_constants(self) -> None:
        # Lock the public enum surface so a future code change that
        # narrows it cannot happen silently.
        assert KNOWN_INPUT_KINDS == frozenset({"ticket"})
        assert KNOWN_DIRECTIVE_SETS == frozenset(
            {"backend", "ui", "ui-trivial", "mixed"},
        )


class TestUnknownTopLevelKeysAreTolerated:
    def test_extra_keys_are_dropped(self) -> None:
        # Forward-compat: an older reader against a newer file should
        # not crash on a freshly-introduced field.
        payload = {
            "version": SCHEMA_VERSION,
            "input": {"kind": "ticket", "data": {}},
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
            "future_field": {"some": "value"},
        }

        rebuilt = from_dict(payload)

        assert rebuilt == _build_state(
            input=Input(kind="ticket", data={}),
            outcomes={},
            questions=[],
        )
        # Re-serialising drops the unknown key — readers cannot relay
        # forward-only fields without explicit schema support.
        assert "future_field" not in to_dict(rebuilt)
