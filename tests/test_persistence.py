"""Tests for persistence.py and event_schema.py."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from event_schema import (
    PipelineEvent, create_pipeline_event, validate_event, validate_or_raise,
    ValidationError, REQUIRED_FIELDS,
)
from persistence import (
    save_events, save_feedback, save_tool_audit,
    load_metrics, load_feedback, load_tool_audit, clear_reports,
)


@pytest.fixture
def tmp_root(tmp_path):
    """Create a temp root with reports dir."""
    return tmp_path


class TestEventSchema:

    def test_create_event(self):
        e = create_pipeline_event("skill_dispatched", "test-skill", "assisted")
        assert e.event_type == "skill_dispatched"
        assert e.skill_name == "test-skill"
        assert e.execution_type == "assisted"
        assert e.timestamp is not None

    def test_validate_valid_event(self):
        e = create_pipeline_event("skill_dispatched", "test", "assisted")
        errors = validate_event(e.to_dict())
        assert errors == []

    def test_validate_missing_field(self):
        errors = validate_event({"event_type": "test"})
        assert len(errors) > 0
        assert any("timestamp" in e for e in errors)

    def test_validate_or_raise_valid(self):
        e = create_pipeline_event("test", "skill", "manual")
        validate_or_raise(e.to_dict())  # should not raise

    def test_validate_or_raise_invalid(self):
        with pytest.raises(ValidationError):
            validate_or_raise({})

    def test_duration_ms_validation(self):
        event = create_pipeline_event("test", "skill", "manual", duration_ms=42.5)
        d = event.to_dict()
        assert validate_event(d) == []

        d["duration_ms"] = "not_a_number"
        errors = validate_event(d)
        assert len(errors) > 0


class TestPersistence:

    def test_save_and_load_events(self, tmp_root):
        events = [
            create_pipeline_event("skill_dispatched", "s1", "assisted"),
            create_pipeline_event("execution_completed", "s1", "assisted"),
        ]
        saved = save_events(events, tmp_root)
        assert saved == 2

        loaded = load_metrics(tmp_root)
        assert len(loaded) == 2
        assert loaded[0]["skill_name"] == "s1"

    def test_append_events(self, tmp_root):
        e1 = [create_pipeline_event("test", "s1", "manual")]
        e2 = [create_pipeline_event("test", "s2", "assisted")]
        save_events(e1, tmp_root)
        save_events(e2, tmp_root)

        loaded = load_metrics(tmp_root)
        assert len(loaded) == 2

    def test_save_and_load_feedback(self, tmp_root):
        outcomes = [
            {"skill_name": "s1", "outcome": "success", "duration_ms": 100},
            {"skill_name": "s2", "outcome": "failure", "duration_ms": 200},
        ]
        saved = save_feedback(outcomes, tmp_root)
        assert saved == 2

        loaded = load_feedback(tmp_root)
        assert len(loaded) == 2
        assert "persisted_at" in loaded[0]

    def test_save_and_load_tool_audit(self, tmp_root):
        entries = [
            {"tool": "github", "action": "read_pr", "status": "success"},
        ]
        saved = save_tool_audit(entries, tmp_root)
        assert saved == 1

        loaded = load_tool_audit(tmp_root)
        assert len(loaded) == 1
        assert loaded[0]["tool"] == "github"

    def test_clear_reports(self, tmp_root):
        save_events([create_pipeline_event("test", "s1", "manual")], tmp_root)
        save_feedback([{"skill": "s1"}], tmp_root)
        save_tool_audit([{"tool": "github"}], tmp_root)

        clear_reports(tmp_root)

        assert load_metrics(tmp_root) == []
        assert load_feedback(tmp_root) == []
        assert load_tool_audit(tmp_root) == []

    def test_load_empty(self, tmp_root):
        assert load_metrics(tmp_root) == []
        assert load_feedback(tmp_root) == []
        assert load_tool_audit(tmp_root) == []

    def test_rejects_invalid_event(self, tmp_root):
        """Events missing required fields are rejected."""
        bad_event = PipelineEvent(
            timestamp=None, event_type=None, skill_name=None,
            execution_type=None, outcome=None
        )
        with pytest.raises(ValidationError):
            save_events([bad_event], tmp_root)
