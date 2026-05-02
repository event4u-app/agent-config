"""Council session persistence (D2)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council.clients import CouncilResponse  # noqa: E402
from scripts.ai_council.session import SessionManifest, save  # noqa: E402


def _r(provider: str, text: str = "ok", error: str | None = None) -> CouncilResponse:
    return CouncilResponse(
        provider=provider, model=f"{provider}-stub", text=text,
        input_tokens=10, output_tokens=20, latency_ms=100, error=error,
    )


def test_save_writes_three_artefacts(tmp_path: Path) -> None:
    manifest = SessionManifest(
        mode="prompt", artefact="<inline>",
        original_ask="critique this", members=["anthropic/claude-x"],
    )
    session_dir = save(
        manifest=manifest,
        responses=[_r("anthropic")],
        sessions_dir=tmp_path,
        timestamp="2026-05-02T20-00-00Z",
    )
    assert session_dir == tmp_path / "2026-05-02T20-00-00Z"
    assert (session_dir / "manifest.json").exists()
    assert (session_dir / "response.md").exists()
    assert (session_dir / "raw-text.md").exists()


def test_manifest_json_contract(tmp_path: Path) -> None:
    manifest = SessionManifest(
        mode="roadmap", artefact="agents/roadmaps/foo.md",
        original_ask="ship it?",
        members=["anthropic/claude-x", "openai/gpt-x"],
        cost_usd_estimated=0.04,
        cost_usd_actual=0.038,
        extra={"trace_id": "abc"},
    )
    session_dir = save(
        manifest=manifest,
        responses=[_r("anthropic"), _r("openai")],
        sessions_dir=tmp_path,
    )
    payload = json.loads((session_dir / "manifest.json").read_text())
    assert payload["mode"] == "roadmap"
    assert payload["artefact"] == "agents/roadmaps/foo.md"
    assert payload["original_ask"] == "ship it?"
    assert payload["members"] == ["anthropic/claude-x", "openai/gpt-x"]
    assert payload["cost_usd_estimated"] == pytest.approx(0.04)
    assert payload["cost_usd_actual"] == pytest.approx(0.038)
    assert payload["rounds"] == 1
    assert payload["trace_id"] == "abc"
    assert len(payload["responses_per_round"]) == 1
    assert len(payload["responses_per_round"][0]) == 2


def test_raw_text_layout_single_round(tmp_path: Path) -> None:
    session_dir = save(
        manifest=SessionManifest(
            mode="prompt", artefact="<inline>", original_ask="x",
            members=["anthropic/claude-x"],
        ),
        responses=[_r("anthropic", text="hello world")],
        sessions_dir=tmp_path,
    )
    raw = (session_dir / "raw-text.md").read_text()
    assert "round 1 · anthropic/anthropic-stub" in raw
    assert "hello world" in raw


def test_multi_round_flat_list_is_treated_as_round_one(tmp_path: Path) -> None:
    session_dir = save(
        manifest=SessionManifest(
            mode="prompt", artefact="<inline>", original_ask="x",
            members=["anthropic/claude-x"], rounds=1,
        ),
        responses=[_r("anthropic")],
        sessions_dir=tmp_path,
    )
    payload = json.loads((session_dir / "manifest.json").read_text())
    assert len(payload["responses_per_round"]) == 1


def test_multi_round_iterable_records_each_round(tmp_path: Path) -> None:
    rounds = [
        [_r("anthropic", text="r1-anthropic"), _r("openai", text="r1-openai")],
        [_r("anthropic", text="r2-anthropic"), _r("openai", text="r2-openai")],
    ]
    session_dir = save(
        manifest=SessionManifest(
            mode="diff", artefact="HEAD~1..HEAD", original_ask="safe?",
            members=["anthropic/claude-x", "openai/gpt-x"], rounds=2,
        ),
        responses=rounds,
        sessions_dir=tmp_path,
    )
    payload = json.loads((session_dir / "manifest.json").read_text())
    assert payload["rounds"] == 2
    assert len(payload["responses_per_round"]) == 2
    raw = (session_dir / "raw-text.md").read_text()
    assert "round 1 · anthropic/anthropic-stub" in raw
    assert "round 2 · anthropic/anthropic-stub" in raw
    assert "r1-anthropic" in raw
    assert "r2-openai" in raw


def test_response_md_uses_last_round(tmp_path: Path) -> None:
    rounds = [
        [_r("anthropic", text="initial")],
        [_r("anthropic", text="refined-after-debate")],
    ]
    session_dir = save(
        manifest=SessionManifest(
            mode="prompt", artefact="<inline>", original_ask="x",
            members=["anthropic/claude-x"], rounds=2,
        ),
        responses=rounds,
        sessions_dir=tmp_path,
    )
    response_md = (session_dir / "response.md").read_text()
    assert "refined-after-debate" in response_md
    assert "initial" not in response_md


def test_error_response_serialised(tmp_path: Path) -> None:
    session_dir = save(
        manifest=SessionManifest(
            mode="prompt", artefact="<inline>", original_ask="x",
            members=["anthropic/claude-x"],
        ),
        responses=[_r("anthropic", text="", error="cost_budget_exceeded")],
        sessions_dir=tmp_path,
    )
    payload = json.loads((session_dir / "manifest.json").read_text())
    assert payload["responses_per_round"][0][0]["error"] == "cost_budget_exceeded"
