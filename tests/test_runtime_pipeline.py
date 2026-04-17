"""Tests for runtime_pipeline.py — end-to-end execution flow."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))

from runtime_pipeline import run_pipeline, PipelineResult
from runtime_session import RuntimeSession


@pytest.fixture
def root():
    return Path(__file__).resolve().parent.parent


@pytest.fixture
def session(root):
    return RuntimeSession.create(root)


class TestPipelineResult:
    """Test the PipelineResult dataclass."""

    def test_success_result(self):
        r = PipelineResult(skill_name="test", status="success")
        assert r.is_success is True

    def test_failure_result(self):
        r = PipelineResult(skill_name="test", status="blocked")
        assert r.is_success is False

    def test_default_status(self):
        r = PipelineResult(skill_name="test")
        assert r.status == "pending"


class TestRunPipeline:
    """Test the full pipeline execution."""

    def test_tagged_skill_succeeds(self, root):
        """A skill with execution metadata should complete successfully."""
        result = run_pipeline("quality-tools", root)
        assert result.status == "success"
        assert result.events_emitted >= 3  # dispatched, started, completed
        assert result.duration_ms > 0

    def test_nonexistent_skill_returns_not_found(self, root):
        """A non-existent skill should return not_found."""
        result = run_pipeline("nonexistent-skill-xyz", root)
        assert result.status == "not_found"
        assert result.error is not None
        assert "not found" in result.error.message.lower()

    def test_untagged_skill_returns_not_found(self, root):
        """A skill without execution metadata should not be found in registry."""
        result = run_pipeline("laravel", root)
        assert result.status in ("not_found", "blocked")

    def test_pipeline_emits_events(self, root, session):
        """Pipeline should emit events through the session."""
        assert session.event_count == 0
        run_pipeline("quality-tools", root, session)
        assert session.event_count >= 3

    def test_pipeline_records_feedback(self, root, session):
        """Pipeline should record outcomes in feedback collector."""
        assert session.outcome_count == 0
        run_pipeline("quality-tools", root, session)
        assert session.outcome_count == 1

    def test_multiple_runs_accumulate(self, root, session):
        """Multiple pipeline runs should accumulate in the same session."""
        run_pipeline("quality-tools", root, session)
        run_pipeline("nonexistent", root, session)
        assert session.outcome_count == 2
        assert session.event_count >= 4

    def test_dispatch_result_populated(self, root):
        """Successful dispatch should populate dispatch_result."""
        result = run_pipeline("quality-tools", root)
        assert result.dispatch_result is not None
        assert result.dispatch_result.request.execution_type == "assisted"

    def test_execution_proposal_populated(self, root):
        """Successful execution should populate execution_proposal."""
        result = run_pipeline("quality-tools", root)
        assert result.execution_proposal is not None


class TestRuntimeSession:
    """Test RuntimeSession creation and properties."""

    def test_create_session(self, root):
        session = RuntimeSession.create(root)
        assert session.event_count == 0
        assert session.outcome_count == 0

    def test_session_root(self, root):
        session = RuntimeSession.create(root)
        assert session.root == root

    def test_default_root(self):
        session = RuntimeSession.create()
        assert session.root == Path(".")
