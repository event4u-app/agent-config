"""Trace-builder scenarios for ``agent-config explain last`` (Phase 4 #1).

Covers the six fixture shapes the roadmap calls out:

* ``work-state.success.json``         — happy path, five Phase-2 slots filled.
* ``work-state.halt-hook.json``       — halt projects into ``trace.halt``.
* ``work-state.council-attached.json``— sidecar discovery via mtime window.
* ``work-state.video-from-script.json``— ``directive_set=video`` → provider slot.
* ``work-state.no-memory.json``       — schema-tolerant ``memory == None``.
* missing state                       — :class:`StateLoadError` with exit 1.

Each test uses the conftest fixtures (``project_root`` + ``copy_state``) so
the run is hermetic — the synthetic project root carries a router, preset,
and profile but never references the host repo.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from scripts._cli.explain_last import build_trace
from scripts._cli.explain_last.state_loader import StateLoadError


def test_success_populates_five_phase2_slots(
    project_root: Path,
    copy_state,
) -> None:
    state_file = copy_state("work-state.success.json")
    trace = build_trace(project_root, state_file)
    assert trace["version"] == 1
    assert trace["subject"] == "work"
    assert trace["run_id"] == "run-success-001"
    # Phase-2 slots filled (council remains null without sidecar attach).
    assert trace["inputs"] is not None
    assert trace["inputs"]["profile"] == "developer"
    assert trace["inputs"]["preset"] == "balanced"
    assert trace["route"] is not None
    assert trace["route"]["persona"] == "senior-engineer"
    assert "direct-answers" in trace["route"]["kernel_rules"]
    assert trace["memory"] is not None
    assert len(trace["memory"]) == 2
    assert trace["memory"][0]["entry_id"] == "mem-header-pattern"
    assert len(trace["assumptions"]) == 2
    assert trace["assumptions"][0]["accepted"] is True
    # Phase-3 slots dormant for a clean run.
    assert trace["halt"] is None
    assert trace["provider"] is None


def test_halt_path_populates_halt_slot(
    project_root: Path,
    copy_state,
) -> None:
    state_file = copy_state("work-state.halt-hook.json")
    trace = build_trace(project_root, state_file)
    assert trace["subject"] == "implement-ticket"
    assert trace["run_id"] == "PROJ-1234"
    halt = trace["halt"]
    assert halt is not None
    assert "verify failed" in halt["reason"]
    assert halt["step"] == "post-verify"
    assert len(halt["surface"]) == 2
    assert halt["surface"][0].startswith("❌")


def test_council_attached_populates_council_slot(
    project_root: Path,
    copy_state,
    attach_council,
) -> None:
    state_file = copy_state("work-state.council-attached.json")
    attach_council(state_file)
    trace = build_trace(project_root, state_file)
    council = trace["council"]
    assert council is not None
    assert len(council) == 2
    member_ids = {m["member_id"] for m in council}
    assert "anthropic/claude-opus-4.7" in member_ids
    assert "openai/gpt-5-pro" in member_ids
    # Cost-metadata stripped per security-engineer council fix.
    for member in council:
        assert "cost_usd" not in member
        assert "input_tokens" not in member
        assert "output_tokens" not in member


def test_video_run_populates_provider_slot(
    project_root: Path,
    copy_state,
) -> None:
    state_file = copy_state("work-state.video-from-script.json")
    trace = build_trace(project_root, state_file)
    assert trace["subject"] == "video"
    provider = trace["provider"]
    assert provider is not None
    assert provider["id"] == "veo-3"
    assert "quality lens" in provider["selection_reason"]


def test_no_memory_branch_returns_null(
    project_root: Path,
    copy_state,
) -> None:
    state_file = copy_state("work-state.no-memory.json")
    trace = build_trace(project_root, state_file)
    # Schema accepts null for memory; renderer drops the section.
    assert trace["memory"] is None
    assert trace["assumptions"] == []
    assert trace["halt"] is None
    assert trace["provider"] is None


def test_missing_state_raises_with_exit_code_one(
    project_root: Path,
) -> None:
    target = project_root / ".work-state.json"
    with pytest.raises(StateLoadError) as exc:
        build_trace(project_root, target)
    assert exc.value.exit_code == 1
    assert "not found" in str(exc.value)


def test_trace_serialises_as_valid_json(
    project_root: Path,
    copy_state,
) -> None:
    state_file = copy_state("work-state.success.json")
    trace = build_trace(project_root, state_file)
    encoded = json.dumps(trace, sort_keys=True)
    assert json.loads(encoded) == trace
