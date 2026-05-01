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
        # narrows it cannot happen silently. R2 widened the input-kind
        # enum with ``prompt``; R3 Phase 1 added ``diff`` and ``file``
        # for the UI-improve track. Capability tuples (per-set
        # ``SUPPORTED_KINDS``) stay narrow until the matching directive
        # set wires the kind end to end.
        assert KNOWN_INPUT_KINDS == frozenset({"ticket", "prompt", "diff", "file"})
        assert KNOWN_DIRECTIVE_SETS == frozenset(
            {"backend", "ui", "ui-trivial", "mixed"},
        )

    def test_prompt_envelope_round_trips(self) -> None:
        # R2 envelope: kind=prompt, data carries raw + empty
        # reconstructed_ac + assumptions slots that the refiner fills
        # later. Round-trip must preserve byte-for-byte.
        state = _build_state(
            input=Input(
                kind="prompt",
                data={
                    "raw": "fix the failing login test",
                    "reconstructed_ac": [],
                    "assumptions": [],
                },
            ),
            outcomes={},
            questions=[],
        )

        rebuilt = from_dict(to_dict(state))

        assert rebuilt == state
        assert rebuilt.input.kind == "prompt"
        assert rebuilt.input.data["raw"] == "fix the failing login test"
        assert rebuilt.input.data["reconstructed_ac"] == []
        assert rebuilt.input.data["assumptions"] == []

    def test_prompt_envelope_with_confidence_round_trips(self) -> None:
        # R2 Phase 3 Step 3 — the refine step writes the confidence
        # breakdown into ``input.data["confidence"]`` so the report
        # renderer can include it without re-scoring. The schema treats
        # ``input.data`` as opaque, so this round-trip is a guard
        # against accidental future filtering of "unknown" data keys.
        state = _build_state(
            input=Input(
                kind="prompt",
                data={
                    "raw": "Add a CSV export endpoint",
                    "reconstructed_ac": ["Endpoint must stream CSV."],
                    "assumptions": ["Audit log fits the existing CSV writer."],
                    "confidence": {
                        "band": "high",
                        "score": 0.9,
                        "dimensions": {
                            "goal_clarity": 2,
                            "scope_boundary": 2,
                            "ac_evidence": 1,
                            "stack_data": 2,
                            "reversibility": 2,
                        },
                        "reasons": ["goal_clarity=2: ..."],
                        "ui_intent": False,
                    },
                    "confidence_confirmed": False,
                },
            ),
            outcomes={"refine": "success"},
            questions=[],
        )

        rebuilt = from_dict(to_dict(state))

        assert rebuilt == state
        assert rebuilt.input.data["confidence"]["band"] == "high"
        assert rebuilt.input.data["confidence_confirmed"] is False


class TestStackEnvelope:
    """``state.stack`` is the R3-Phase-1 cache slot for the detected frontend.

    Schema rules: ``None`` is the default (detector has not run yet);
    when present, ``frontend`` must be a non-empty string and ``mtime``
    a number.
    """

    def test_default_stack_is_none(self) -> None:
        state = _build_state()
        assert state.stack is None
        assert to_dict(state)["stack"] is None

    def test_stack_round_trips(self) -> None:
        state = _build_state(
            stack={"frontend": "react-shadcn", "mtime": 1700000000.0},
        )

        rebuilt = from_dict(to_dict(state))

        assert rebuilt.stack == {
            "frontend": "react-shadcn",
            "mtime": 1700000000.0,
        }

    def test_rejects_stack_with_empty_frontend(self) -> None:
        payload = {
            "version": SCHEMA_VERSION,
            "input": {"kind": "ticket", "data": {}},
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
            "stack": {"frontend": "", "mtime": 0},
        }

        with pytest.raises(SchemaError, match="state.stack.frontend"):
            from_dict(payload)

    def test_rejects_stack_with_non_numeric_mtime(self) -> None:
        payload = {
            "version": SCHEMA_VERSION,
            "input": {"kind": "ticket", "data": {}},
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
            "stack": {"frontend": "vue", "mtime": "yesterday"},
        }

        with pytest.raises(SchemaError, match="state.stack.mtime"):
            from_dict(payload)

    def test_rejects_stack_that_is_not_an_object(self) -> None:
        payload = {
            "version": SCHEMA_VERSION,
            "input": {"kind": "ticket", "data": {}},
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
            "stack": ["not", "an", "object"],
        }

        with pytest.raises(SchemaError, match="state.stack must be a JSON object"):
            from_dict(payload)


class TestUiAuditEnvelope:
    """``state.ui_audit`` is the R3-Phase-2 inventory written by the audit skill.

    Schema rules: ``None`` is the default (audit has not run). When
    present, ``greenfield`` (if set) must be a bool and
    ``greenfield_decision`` (if set) must be one of the three
    documented choices. Other keys are content the schema does not
    police.
    """

    def test_default_ui_audit_is_none(self) -> None:
        state = _build_state()
        assert state.ui_audit is None
        assert to_dict(state)["ui_audit"] is None

    def test_ui_audit_round_trips(self) -> None:
        audit = {
            "components": [{"path": "components/Button.tsx", "name": "Button"}],
            "design_system": "shadcn",
            "design_tokens": {"colors": {"primary": "#000"}},
            "shadcn_inventory": {
                "version": None,
                "style": "default",
                "primitives": ["Button"],
            },
            "patterns": {"forms": [], "tables": []},
            "candidates": [],
            "greenfield": False,
            "greenfield_decision": None,
        }
        state = _build_state(ui_audit=audit)

        rebuilt = from_dict(to_dict(state))

        assert rebuilt.ui_audit == audit

    def test_greenfield_decision_round_trips(self) -> None:
        for decision in ("scaffold", "bare", "external_reference"):
            state = _build_state(
                ui_audit={"greenfield": True, "greenfield_decision": decision},
            )
            rebuilt = from_dict(to_dict(state))
            assert rebuilt.ui_audit["greenfield_decision"] == decision

    def test_rejects_non_bool_greenfield(self) -> None:
        payload = {
            "version": SCHEMA_VERSION,
            "input": {"kind": "ticket", "data": {}},
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
            "ui_audit": {"greenfield": "yes"},
        }

        with pytest.raises(SchemaError, match="ui_audit.greenfield"):
            from_dict(payload)

    def test_rejects_unknown_greenfield_decision(self) -> None:
        payload = {
            "version": SCHEMA_VERSION,
            "input": {"kind": "ticket", "data": {}},
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
            "ui_audit": {"greenfield": True, "greenfield_decision": "freestyle"},
        }

        with pytest.raises(SchemaError, match="greenfield_decision"):
            from_dict(payload)

    def test_rejects_ui_audit_that_is_not_an_object(self) -> None:
        payload = {
            "version": SCHEMA_VERSION,
            "input": {"kind": "ticket", "data": {}},
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
            "ui_audit": ["not", "an", "object"],
        }

        with pytest.raises(SchemaError, match="state.ui_audit must be a JSON object"):
            from_dict(payload)


class TestContractEnvelope:
    """``state.contract`` is the R3-Phase-4 sentinel written by ``mixed.contract``.

    Schema rules: ``None`` is the default (contract has not run).
    When present, ``data_model`` and ``api_surface`` (if set) must be
    lists, and ``contract_confirmed`` (if set) must be a bool. The
    mixed UI step's gate reads ``contract_confirmed is True`` so
    schema-level shape integrity is load-bearing.
    """

    def test_default_contract_is_none(self) -> None:
        state = _build_state()
        assert state.contract is None
        assert to_dict(state)["contract"] is None

    def test_contract_round_trips(self) -> None:
        contract = {
            "data_model": [{"entity": "Booking", "fields": ["id", "status"]}],
            "api_surface": [{"method": "POST", "path": "/bookings"}],
            "contract_confirmed": True,
        }
        state = _build_state(contract=contract)

        rebuilt = from_dict(to_dict(state))

        assert rebuilt.contract == contract

    def test_rejects_non_list_data_model(self) -> None:
        payload = {
            "version": SCHEMA_VERSION,
            "input": {"kind": "ticket", "data": {}},
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
            "contract": {"data_model": "Booking"},
        }
        with pytest.raises(SchemaError, match="contract.data_model"):
            from_dict(payload)

    def test_rejects_non_bool_contract_confirmed(self) -> None:
        payload = {
            "version": SCHEMA_VERSION,
            "input": {"kind": "ticket", "data": {}},
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
            "contract": {"contract_confirmed": "yes"},
        }
        with pytest.raises(SchemaError, match="contract_confirmed"):
            from_dict(payload)

    def test_rejects_contract_that_is_not_an_object(self) -> None:
        payload = {
            "version": SCHEMA_VERSION,
            "input": {"kind": "ticket", "data": {}},
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
            "contract": ["not", "an", "object"],
        }
        with pytest.raises(SchemaError, match="state.contract must be a JSON object"):
            from_dict(payload)


class TestStitchEnvelope:
    """``state.stitch`` is the R3-Phase-4 integration verdict from ``mixed.stitch``.

    Schema rules: ``None`` is the default (stitch has not run). When
    present, ``scenarios`` (if set) must be a list, ``verdict`` (if
    set) must be one of ``success``/``blocked``/``partial``, and
    ``integration_confirmed`` (if set) must be a bool.
    """

    def test_default_stitch_is_none(self) -> None:
        state = _build_state()
        assert state.stitch is None
        assert to_dict(state)["stitch"] is None

    def test_stitch_round_trips(self) -> None:
        stitch = {
            "scenarios": [{"name": "fill-form-and-submit", "result": "pass"}],
            "verdict": "success",
            "integration_confirmed": True,
        }
        state = _build_state(stitch=stitch)

        rebuilt = from_dict(to_dict(state))

        assert rebuilt.stitch == stitch

    def test_rejects_unknown_verdict(self) -> None:
        payload = {
            "version": SCHEMA_VERSION,
            "input": {"kind": "ticket", "data": {}},
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
            "stitch": {"verdict": "kinda-ok"},
        }
        with pytest.raises(SchemaError, match="stitch.verdict"):
            from_dict(payload)

    def test_rejects_non_list_scenarios(self) -> None:
        payload = {
            "version": SCHEMA_VERSION,
            "input": {"kind": "ticket", "data": {}},
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
            "stitch": {"scenarios": {"name": "x"}},
        }
        with pytest.raises(SchemaError, match="stitch.scenarios"):
            from_dict(payload)

    def test_rejects_stitch_that_is_not_an_object(self) -> None:
        payload = {
            "version": SCHEMA_VERSION,
            "input": {"kind": "ticket", "data": {}},
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
            "stitch": "not-an-object",
        }
        with pytest.raises(SchemaError, match="state.stitch must be a JSON object"):
            from_dict(payload)


class TestUiAuditA11yBaseline:
    """``state.ui_audit.a11y_baseline`` is the R4 pre-existing-violations cache.

    Schema rule: when present, must be a list. Content shape is
    enforced by the review handler, not the schema.
    """

    def test_a11y_baseline_round_trips(self) -> None:
        baseline = [
            {"rule": "color-contrast", "selector": "header h1", "severity": "moderate"},
        ]
        state = _build_state(ui_audit={"a11y_baseline": baseline})
        rebuilt = from_dict(to_dict(state))
        assert rebuilt.ui_audit["a11y_baseline"] == baseline

    def test_rejects_non_list_a11y_baseline(self) -> None:
        payload = {
            "version": SCHEMA_VERSION,
            "input": {"kind": "ticket", "data": {}},
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
            "ui_audit": {"a11y_baseline": "not-a-list"},
        }

        with pytest.raises(SchemaError, match="ui_audit.a11y_baseline"):
            from_dict(payload)


class TestUiReviewA11yEnvelope:
    """``state.ui_review.a11y`` is the R4 a11y findings envelope.

    Schema rules: when present, must be a JSON object. ``violations``
    (if set) must be a list, ``severity_floor`` (if set) must be one
    of the four documented levels, ``accepted_violations`` (if set)
    must be a list. Content shape is enforced by the review handler.
    """

    def test_a11y_envelope_round_trips(self) -> None:
        a11y = {
            "violations": [
                {"rule": "label", "selector": "input#email", "severity": "serious"},
            ],
            "severity_floor": "moderate",
            "baseline_compared": True,
            "accepted_violations": [],
        }
        state = _build_state(ui_review={"a11y": a11y})
        rebuilt = from_dict(to_dict(state))
        assert rebuilt.ui_review["a11y"] == a11y

    def test_rejects_a11y_that_is_not_an_object(self) -> None:
        payload = {
            "version": SCHEMA_VERSION,
            "input": {"kind": "ticket", "data": {}},
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
            "ui_review": {"a11y": ["bad"]},
        }

        with pytest.raises(SchemaError, match="state.ui_review.a11y must be a JSON object"):
            from_dict(payload)

    def test_rejects_non_list_violations(self) -> None:
        payload = {
            "version": SCHEMA_VERSION,
            "input": {"kind": "ticket", "data": {}},
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
            "ui_review": {"a11y": {"violations": "not-a-list"}},
        }

        with pytest.raises(SchemaError, match="a11y.violations must be a list"):
            from_dict(payload)

    def test_rejects_unknown_severity_floor(self) -> None:
        payload = {
            "version": SCHEMA_VERSION,
            "input": {"kind": "ticket", "data": {}},
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
            "ui_review": {"a11y": {"severity_floor": "nuclear"}},
        }

        with pytest.raises(SchemaError, match="severity_floor must be one of"):
            from_dict(payload)

    def test_rejects_non_list_accepted_violations(self) -> None:
        payload = {
            "version": SCHEMA_VERSION,
            "input": {"kind": "ticket", "data": {}},
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
            "ui_review": {"a11y": {"accepted_violations": "none"}},
        }

        with pytest.raises(SchemaError, match="accepted_violations must be a list"):
            from_dict(payload)


class TestUiReviewPreviewEnvelope:
    """``state.ui_review.preview`` is the R4 visual-preview envelope."""

    def test_preview_envelope_round_trips(self) -> None:
        preview = {
            "screenshot_path": "tmp/preview.png",
            "dom_dump_path": "tmp/preview.html",
            "render_ok": True,
            "error": None,
        }
        state = _build_state(ui_review={"preview": preview})
        rebuilt = from_dict(to_dict(state))
        assert rebuilt.ui_review["preview"] == preview

    def test_rejects_preview_that_is_not_an_object(self) -> None:
        payload = {
            "version": SCHEMA_VERSION,
            "input": {"kind": "ticket", "data": {}},
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
            "ui_review": {"preview": "screenshot.png"},
        }

        with pytest.raises(SchemaError, match="preview must be a JSON object"):
            from_dict(payload)

    def test_rejects_non_bool_render_ok(self) -> None:
        payload = {
            "version": SCHEMA_VERSION,
            "input": {"kind": "ticket", "data": {}},
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
            "ui_review": {"preview": {"render_ok": "yes"}},
        }

        with pytest.raises(SchemaError, match="preview.render_ok must be a boolean"):
            from_dict(payload)


class TestUiPolishExtensionUsed:
    """``state.ui_polish.extension_used`` is the R4 one-shot extension flag."""

    def test_extension_used_round_trips(self) -> None:
        state = _build_state(ui_polish={"rounds": 2, "extension_used": True})
        rebuilt = from_dict(to_dict(state))
        assert rebuilt.ui_polish["extension_used"] is True

    def test_rejects_non_bool_extension_used(self) -> None:
        payload = {
            "version": SCHEMA_VERSION,
            "input": {"kind": "ticket", "data": {}},
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
            "ui_polish": {"extension_used": "yes"},
        }

        with pytest.raises(SchemaError, match="extension_used must be a boolean"):
            from_dict(payload)

    def test_rejects_rounds_three_without_extension(self) -> None:
        """Schema mirror — round 3 only legal when extension_used=True."""
        payload = {
            "version": SCHEMA_VERSION,
            "input": {"kind": "ticket", "data": {}},
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
            "ui_polish": {"rounds": 3, "extension_used": False},
        }

        with pytest.raises(SchemaError, match=r"rounds must be in \[0, 2\]"):
            from_dict(payload)

    def test_accepts_rounds_three_with_extension(self) -> None:
        """R4 Phase 2 — round 3 is legal once the one-shot extension fired."""
        state = _build_state(
            ui_polish={"rounds": 3, "extension_used": True},
        )
        rebuilt = from_dict(to_dict(state))
        assert rebuilt.ui_polish["rounds"] == 3
        assert rebuilt.ui_polish["extension_used"] is True

    def test_rejects_rounds_four_even_with_extension(self) -> None:
        """Hard cap — extension grants exactly one extra round, not two."""
        payload = {
            "version": SCHEMA_VERSION,
            "input": {"kind": "ticket", "data": {}},
            "intent": DEFAULT_INTENT,
            "directive_set": DEFAULT_DIRECTIVE_SET,
            "ui_polish": {"rounds": 4, "extension_used": True},
        }

        with pytest.raises(SchemaError, match=r"rounds must be in \[0, 3\]"):
            from_dict(payload)


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
