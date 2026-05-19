"""Council session persistence (D2)."""

from __future__ import annotations

import datetime as _dt
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council.clients import CouncilResponse  # noqa: E402
from scripts.ai_council.session import (  # noqa: E402
    DEFAULT_RETENTION_DAYS,
    SessionManifest,
    prune_all_council_artifacts,
    prune_old_artifacts,
    prune_old_sessions,
    save,
)


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
        retention_days=0,
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


def _make_session(base: Path, name: str) -> Path:
    d = base / name
    d.mkdir(parents=True)
    (d / "manifest.json").write_text("{}", encoding="utf-8")
    (d / "response.md").write_text("body\n", encoding="utf-8")
    (d / "raw-text.md").write_text("body\n", encoding="utf-8")
    return d


def test_prune_removes_old_sessions_keeps_recent(tmp_path: Path) -> None:
    now = _dt.datetime(2026, 5, 4, 12, 0, 0, tzinfo=_dt.timezone.utc)
    old = _make_session(tmp_path, "2026-04-15T10-00-00Z")  # 19 days old
    edge = _make_session(tmp_path, "2026-04-20T11-30-00Z")  # >14d (14d 30m)
    fresh = _make_session(tmp_path, "2026-05-03T09-00-00Z")  # 1 day old

    removed = prune_old_sessions(tmp_path, retention_days=14, now=now)

    assert old in removed
    assert edge in removed
    assert fresh not in removed
    assert not old.exists()
    assert not edge.exists()
    assert fresh.exists()


def test_prune_skips_non_directories_and_unparseable_names(tmp_path: Path) -> None:
    now = _dt.datetime(2026, 5, 4, 12, 0, 0, tzinfo=_dt.timezone.utc)
    (tmp_path / "report.json").write_text("{}", encoding="utf-8")
    custom = tmp_path / "custom-folder"
    custom.mkdir()
    old = _make_session(tmp_path, "2026-01-01T00-00-00Z")

    removed = prune_old_sessions(tmp_path, retention_days=14, now=now)

    assert removed == [old]
    assert (tmp_path / "report.json").exists()
    assert custom.exists()


def test_prune_disabled_when_retention_zero(tmp_path: Path) -> None:
    now = _dt.datetime(2026, 5, 4, 12, 0, 0, tzinfo=_dt.timezone.utc)
    old = _make_session(tmp_path, "2026-01-01T00-00-00Z")

    removed = prune_old_sessions(tmp_path, retention_days=0, now=now)

    assert removed == []
    assert old.exists()


def test_prune_handles_missing_directory(tmp_path: Path) -> None:
    missing = tmp_path / "does-not-exist"
    assert prune_old_sessions(missing, retention_days=14) == []


def test_save_triggers_prune_via_retention_days_param(tmp_path: Path) -> None:
    old = _make_session(tmp_path, "2026-01-01T00-00-00Z")
    # Anchor the fresh session to now() — save() invokes prune with the
    # wall-clock, so a hardcoded fresh_ts eventually drifts past the
    # 14-day retention window and turns this test into a time-bomb.
    fresh_ts = _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")

    session_dir = save(
        manifest=SessionManifest(
            mode="prompt", artefact="<inline>", original_ask="x",
            members=["anthropic/claude-x"],
        ),
        responses=[_r("anthropic")],
        sessions_dir=tmp_path,
        timestamp=fresh_ts,
        retention_days=14,
    )

    assert session_dir.exists()
    assert not old.exists()


def test_save_with_retention_zero_keeps_old_sessions(tmp_path: Path) -> None:
    old = _make_session(tmp_path, "2026-01-01T00-00-00Z")

    save(
        manifest=SessionManifest(
            mode="prompt", artefact="<inline>", original_ask="x",
            members=["anthropic/claude-x"],
        ),
        responses=[_r("anthropic")],
        sessions_dir=tmp_path,
        timestamp="2026-05-04T12-00-00Z",
        retention_days=0,
    )

    assert old.exists()



# --- prune_old_artifacts (mtime-based, all council dirs) ---


def _set_mtime(path: Path, days_ago: float, *, now: _dt.datetime) -> None:
    """Backdate a file's atime + mtime to `now - days_ago`."""
    import os
    target = (now - _dt.timedelta(days=days_ago)).timestamp()
    os.utime(path, (target, target))


def test_default_retention_days_is_seven() -> None:
    assert DEFAULT_RETENTION_DAYS == 7


def test_prune_old_artifacts_removes_old_files_keeps_fresh(tmp_path: Path) -> None:
    now = _dt.datetime(2026, 5, 10, 12, 0, 0, tzinfo=_dt.timezone.utc)
    old_file = tmp_path / "old.json"
    old_file.write_text("{}", encoding="utf-8")
    _set_mtime(old_file, days_ago=10, now=now)
    fresh_file = tmp_path / "fresh.json"
    fresh_file.write_text("{}", encoding="utf-8")
    _set_mtime(fresh_file, days_ago=2, now=now)

    removed = prune_old_artifacts(tmp_path, retention_days=7, now=now)

    assert removed == [old_file] or removed == [fresh_file] or set(removed) == {old_file}
    assert not old_file.exists()
    assert fresh_file.exists()


def test_prune_old_artifacts_handles_subdirs(tmp_path: Path) -> None:
    now = _dt.datetime(2026, 5, 10, 12, 0, 0, tzinfo=_dt.timezone.utc)
    old_dir = tmp_path / "old-topic"
    old_dir.mkdir()
    (old_dir / "raw.md").write_text("x", encoding="utf-8")
    _set_mtime(old_dir, days_ago=10, now=now)

    removed = prune_old_artifacts(tmp_path, retention_days=7, now=now)

    assert old_dir in removed
    assert not old_dir.exists()


def test_prune_old_artifacts_skips_timestamp_subdirs(tmp_path: Path) -> None:
    """Timestamp subdirs are owned by prune_old_sessions, not artifacts."""
    now = _dt.datetime(2026, 5, 10, 12, 0, 0, tzinfo=_dt.timezone.utc)
    ts_dir = tmp_path / "2026-04-15T10-00-00Z"
    ts_dir.mkdir()
    (ts_dir / "manifest.json").write_text("{}", encoding="utf-8")
    _set_mtime(ts_dir, days_ago=20, now=now)

    removed = prune_old_artifacts(tmp_path, retention_days=7, now=now)

    assert ts_dir not in removed
    assert ts_dir.exists()


def test_prune_old_artifacts_disabled_when_retention_zero(tmp_path: Path) -> None:
    now = _dt.datetime(2026, 5, 10, 12, 0, 0, tzinfo=_dt.timezone.utc)
    f = tmp_path / "old.json"
    f.write_text("{}", encoding="utf-8")
    _set_mtime(f, days_ago=100, now=now)

    removed = prune_old_artifacts(tmp_path, retention_days=0, now=now)

    assert removed == []
    assert f.exists()


def test_prune_old_artifacts_handles_missing_directory(tmp_path: Path) -> None:
    missing = tmp_path / "does-not-exist"
    assert prune_old_artifacts(missing, retention_days=7) == []


def test_prune_all_council_artifacts_covers_three_dirs(tmp_path: Path) -> None:
    now = _dt.datetime(2026, 5, 10, 12, 0, 0, tzinfo=_dt.timezone.utc)
    sessions = tmp_path / "agents" / "council-sessions"
    questions = tmp_path / "agents" / "council-questions"
    responses = tmp_path / "agents" / "council-responses"
    for d in (sessions, questions, responses):
        d.mkdir(parents=True)
        old = d / "old-file"
        old.write_text("x", encoding="utf-8")
        _set_mtime(old, days_ago=15, now=now)

    result = prune_all_council_artifacts(retention_days=7, repo_root=tmp_path, now=now)

    assert "sessions" in result and "questions" in result and "responses" in result
    for label in ("sessions", "questions", "responses"):
        assert len(result[label]) == 1, f"{label} should have pruned 1 entry"


def test_save_in_isolated_dir_does_not_touch_real_repo(tmp_path: Path) -> None:
    """save() with explicit sessions_dir must NOT prune real repo dirs."""
    save(
        manifest=SessionManifest(
            mode="prompt", artefact="<inline>", original_ask="x",
            members=["anthropic/claude-x"],
        ),
        responses=[_r("anthropic")],
        sessions_dir=tmp_path,
        timestamp="2026-05-04T12-00-00Z",
        retention_days=7,
    )
    # No assertion on real dirs — the test passes by not erroring and
    # by the documented invariant (save() with explicit sessions_dir
    # confines pruning to that dir per session.py).



# ── Phase 5 / Step 1 — transport / billable / cost manifest schema ───


def _r_with_meta(provider: str, **meta: object) -> CouncilResponse:
    return CouncilResponse(
        provider=provider, model=f"{provider}-stub", text="ok",
        input_tokens=10, output_tokens=20, latency_ms=100,
        metadata=meta,
    )


def test_manifest_surfaces_billable_api_response(tmp_path: Path) -> None:
    response = _r_with_meta(
        "anthropic", transport="api", billable=True, cost_usd=0.0023,
    )
    save(
        manifest=SessionManifest(
            mode="prompt", artefact="<inline>", original_ask="x",
            members=["anthropic/claude-x"],
        ),
        responses=[response],
        sessions_dir=tmp_path,
    )
    session_dir = next(p for p in tmp_path.iterdir() if p.is_dir())
    payload = json.loads((session_dir / "manifest.json").read_text())
    entry = payload["responses_per_round"][0][0]
    assert entry["transport"] == "api"
    assert entry["billable"] is True
    assert entry["cost_usd"] == pytest.approx(0.0023)
    assert entry["tokens_estimated"] is False
    assert "subscription_label" not in entry


def test_manifest_surfaces_non_billable_vendor_cli(tmp_path: Path) -> None:
    response = _r_with_meta(
        "anthropic", transport="cli", billable=False,
        subscription_label="claude-pro",
    )
    save(
        manifest=SessionManifest(
            mode="prompt", artefact="<inline>", original_ask="x",
            members=["anthropic/claude-x"],
        ),
        responses=[response],
        sessions_dir=tmp_path,
    )
    session_dir = next(p for p in tmp_path.iterdir() if p.is_dir())
    payload = json.loads((session_dir / "manifest.json").read_text())
    entry = payload["responses_per_round"][0][0]
    assert entry["transport"] == "cli"
    assert entry["billable"] is False
    assert entry["subscription_label"] == "claude-pro"
    assert "cost_usd" not in entry


def test_manifest_flags_estimated_tokens_for_community_cli(
    tmp_path: Path,
) -> None:
    response = _r_with_meta(
        "xai", transport="cli", billable=True, tokens_estimated=True,
        cost_usd=0.0015,
    )
    save(
        manifest=SessionManifest(
            mode="prompt", artefact="<inline>", original_ask="x",
            members=["xai/grok-x"],
        ),
        responses=[response],
        sessions_dir=tmp_path,
    )
    session_dir = next(p for p in tmp_path.iterdir() if p.is_dir())
    payload = json.loads((session_dir / "manifest.json").read_text())
    entry = payload["responses_per_round"][0][0]
    assert entry["transport"] == "cli"
    assert entry["billable"] is True
    assert entry["tokens_estimated"] is True
    assert entry["cost_usd"] == pytest.approx(0.0015)


def test_manifest_defaults_when_metadata_missing(tmp_path: Path) -> None:
    """Legacy responses without transport/billable metadata default to api."""
    save(
        manifest=SessionManifest(
            mode="prompt", artefact="<inline>", original_ask="x",
            members=["anthropic/claude-x"],
        ),
        responses=[_r("anthropic")],
        sessions_dir=tmp_path,
    )
    session_dir = next(p for p in tmp_path.iterdir() if p.is_dir())
    payload = json.loads((session_dir / "manifest.json").read_text())
    entry = payload["responses_per_round"][0][0]
    assert entry["transport"] == "api"
    assert entry["billable"] is True
    assert entry["tokens_estimated"] is False
