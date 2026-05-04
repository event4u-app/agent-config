"""Tests for scripts/capture_showcase_session.py — Phase 1.2 deliverable.

Smoke-coverage for the four outcome metrics defined in
agents/contexts/outcome-baseline.md, the frontmatter emitter, and the
CLI subcommands. Exercises stdin capture and metrics reading.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / "scripts" / "capture_showcase_session.py"

sys.path.insert(0, str(ROOT / "scripts"))
import capture_showcase_session as css  # noqa: E402


SAMPLE_BODY = """## User
Implement feature X.

## Agent
Working on it now.

<tool_use name="view">{"path": "foo.py"}</tool_use>

memory_retrieve hits=3 misses=1

Done — feature X is complete.

## User
das passt nicht, missing tests.

## Agent
Sorry, adding tests now.

<tool_use name="save-file">{"path":"foo_test.py"}</tool_use>

Ready for review.
"""


def test_tool_call_count_counts_tool_use_blocks():
    assert css._metric_tool_call_count(SAMPLE_BODY) == 2


def test_tool_call_count_zero_when_empty():
    assert css._metric_tool_call_count("") == 0


def test_reply_chars_returns_mean_across_agent_turns():
    mean = css._metric_reply_chars(SAMPLE_BODY)
    assert mean is not None
    assert mean > 0


def test_reply_chars_returns_none_when_no_split():
    # No turn markers → single agent block, but still counts as one turn
    # so we get a number, not None
    out = css._metric_reply_chars("just some text")
    assert out is not None


def test_memory_hit_ratio_uses_visibility_v1_format():
    ratio, notes = css._metric_memory_hit_ratio(SAMPLE_BODY)
    assert ratio == 0.75
    assert notes == []


def test_memory_hit_ratio_returns_none_when_no_calls():
    ratio, notes = css._metric_memory_hit_ratio("plain text")
    assert ratio is None
    assert "no memory_retrieve calls found" in notes


def test_verify_pass_rate_handles_correction():
    ratio, _ = css._metric_verify_pass_rate(SAMPLE_BODY)
    # 2 done-claims, 1 followed by correction → 0.5 pass rate
    assert ratio == 0.5


def test_verify_pass_rate_none_without_done_claims():
    ratio, notes = css._metric_verify_pass_rate("## User\nhi\n\n## Agent\nhello")
    assert ratio is None
    assert any("done-claim" in n for n in notes)


def test_split_body_strips_existing_frontmatter():
    full = "---\nslug: x\n---\nbody here"
    assert css._split_body(full) == "body here"


def test_split_body_passes_through_when_no_frontmatter():
    assert css._split_body("body only") == "body only"


def test_render_frontmatter_emits_valid_yaml_shape():
    fm = css._render_frontmatter({
        "slug": "demo",
        "metrics": {"tool_call_count": 3, "reply_chars_mean": 250.0},
    })
    assert fm.startswith("---\n")
    assert fm.rstrip().endswith("---")
    assert '"demo"' in fm
    assert "tool_call_count: 3" in fm


def test_capture_writes_session_with_frontmatter(tmp_path: Path,
                                                  monkeypatch: pytest.MonkeyPatch):
    monkeypatch.setattr(css, "SESSIONS_DIR", tmp_path / "sessions")
    src = tmp_path / "raw.log"
    src.write_text(SAMPLE_BODY, encoding="utf-8")
    rc = css.main([
        "capture",
        "--input", str(src),
        "--slug", "test_session",
        "--task-class", "implement-ticket",
        "--host", "augment",
        "--model", "test-model",
        "--force",
    ])
    assert rc == 0
    out = (tmp_path / "sessions" / "test_session.log").read_text(encoding="utf-8")
    assert out.startswith("---\n")
    assert "tool_call_count: 2" in out
    assert "## User" in out  # body preserved


def test_metrics_subcommand_runs_against_captured_session(tmp_path: Path):
    session = tmp_path / "x.log"
    session.write_text(SAMPLE_BODY, encoding="utf-8")
    result = subprocess.run(
        [sys.executable, str(SCRIPT), "metrics",
         "--session", str(session), "--format", "json"],
        capture_output=True, text=True, check=True,
    )
    payload = json.loads(result.stdout)
    assert payload["tool_call_count"] == 2
    assert payload["memory_hit_ratio"] == 0.75
    assert payload["verify_pass_rate"] == 0.5
