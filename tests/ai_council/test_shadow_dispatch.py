"""Shadow-mode dispatch logger + SLO computation (step-9 P10)."""

from __future__ import annotations

import json
import random
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council import shadow_dispatch as sd  # noqa: E402


# ── should_shadow ────────────────────────────────────────────────────


def test_should_shadow_zero_rate_never_fires() -> None:
    rng = random.Random(0)
    for _ in range(50):
        assert sd.should_shadow(0.0, rng=rng) is False


def test_should_shadow_one_rate_always_fires() -> None:
    rng = random.Random(0)
    for _ in range(50):
        assert sd.should_shadow(1.0, rng=rng) is True


def test_should_shadow_clamps_out_of_range_values() -> None:
    rng = random.Random(0)
    assert sd.should_shadow(-1.5, rng=rng) is False
    rng2 = random.Random(0)
    assert sd.should_shadow(2.5, rng=rng2) is True


# ── record_shadow_decision ───────────────────────────────────────────


def test_record_writes_jsonl_row_with_expected_fields(tmp_path: Path) -> None:
    log = tmp_path / "shadow.jsonl"
    decision = sd.record_shadow_decision(
        log,
        query="should I rename this variable to camelCase?",
        solo_verdict="low_impact",
        full_verdict="low_impact",
    )
    assert decision is not None
    assert decision.agreed is True
    rows = [json.loads(line) for line in log.read_text().splitlines() if line]
    assert len(rows) == 1
    row = rows[0]
    assert set(row.keys()) == {
        "timestamp", "query_hash", "solo_verdict", "full_verdict", "agreed",
    }
    assert row["agreed"] is True
    assert len(row["query_hash"]) == 16


def test_record_marks_disagreement_when_verdicts_differ(tmp_path: Path) -> None:
    log = tmp_path / "shadow.jsonl"
    decision = sd.record_shadow_decision(
        log,
        query="rename variable to camelCase",
        solo_verdict="low_impact",
        full_verdict="high_impact",
    )
    assert decision is not None
    assert decision.agreed is False


def test_record_appends_not_overwrites(tmp_path: Path) -> None:
    log = tmp_path / "shadow.jsonl"
    for i in range(3):
        sd.record_shadow_decision(
            log,
            query=f"query {i}",
            solo_verdict="low_impact",
            full_verdict="low_impact",
        )
    assert len([line for line in log.read_text().splitlines() if line]) == 3


def test_record_drops_when_query_fully_redacted(tmp_path: Path) -> None:
    log = tmp_path / "shadow.jsonl"
    # Authorization-header pattern is redacted whole-line by the bundler.
    decision = sd.record_shadow_decision(
        log,
        query="Authorization: Bearer abc123",
        solo_verdict="low_impact",
        full_verdict="low_impact",
    )
    assert decision is None
    assert not log.exists() or log.read_text() == ""


# ── compute_disagreement_rate ────────────────────────────────────────


def _write_rows(log: Path, rows: list[dict]) -> None:
    log.parent.mkdir(parents=True, exist_ok=True)
    with log.open("w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r) + "\n")


def test_compute_disagreement_rate_empty_log_returns_zero(tmp_path: Path) -> None:
    rate, n = sd.compute_disagreement_rate(tmp_path / "missing.jsonl")
    assert rate == 0.0 and n == 0


def test_compute_disagreement_rate_within_window(tmp_path: Path) -> None:
    now = datetime(2026, 5, 15, tzinfo=timezone.utc)
    fresh = (now - timedelta(days=2)).isoformat(timespec="seconds")
    log = tmp_path / "shadow.jsonl"
    _write_rows(log, [
        {"timestamp": fresh, "agreed": True},
        {"timestamp": fresh, "agreed": True},
        {"timestamp": fresh, "agreed": False},
        {"timestamp": fresh, "agreed": False},
    ])
    rate, n = sd.compute_disagreement_rate(log, window_days=7, now=now)
    assert n == 4
    assert rate == pytest.approx(0.5)


def test_compute_disagreement_rate_excludes_old_rows(tmp_path: Path) -> None:
    now = datetime(2026, 5, 15, tzinfo=timezone.utc)
    fresh = (now - timedelta(days=2)).isoformat(timespec="seconds")
    stale = (now - timedelta(days=30)).isoformat(timespec="seconds")
    log = tmp_path / "shadow.jsonl"
    _write_rows(log, [
        {"timestamp": stale, "agreed": False},
        {"timestamp": stale, "agreed": False},
        {"timestamp": fresh, "agreed": True},
    ])
    rate, n = sd.compute_disagreement_rate(log, window_days=7, now=now)
    assert n == 1
    assert rate == 0.0


def test_compute_disagreement_rate_skips_malformed_rows(tmp_path: Path) -> None:
    now = datetime(2026, 5, 15, tzinfo=timezone.utc)
    fresh = (now - timedelta(days=1)).isoformat(timespec="seconds")
    log = tmp_path / "shadow.jsonl"
    log.parent.mkdir(parents=True, exist_ok=True)
    log.write_text(
        json.dumps({"timestamp": fresh, "agreed": False}) + "\n"
        + "not-valid-json\n"
        + json.dumps({"timestamp": "garbage-ts", "agreed": False}) + "\n"
        + json.dumps({"timestamp": fresh, "agreed": True}) + "\n",
        encoding="utf-8",
    )
    rate, n = sd.compute_disagreement_rate(log, window_days=7, now=now)
    assert n == 2
    assert rate == pytest.approx(0.5)


# ── slo_status / slo_banner ──────────────────────────────────────────


def test_slo_status_buckets() -> None:
    assert sd.slo_status(0.0) == "OK"
    assert sd.slo_status(0.049) == "OK"
    assert sd.slo_status(0.05) == "WARN"
    assert sd.slo_status(0.079) == "WARN"
    assert sd.slo_status(0.08) == "BREACH"
    assert sd.slo_status(0.5) == "BREACH"


def test_slo_banner_no_samples() -> None:
    assert "no samples" in sd.slo_banner(0.0, 0)


def test_slo_banner_ok_warn_breach_include_recommendation() -> None:
    assert "OK" in sd.slo_banner(0.02, 100)
    warn = sd.slo_banner(0.06, 100)
    assert "WARN" in warn and "consider reverting" in warn
    breach = sd.slo_banner(0.10, 100)
    assert "BREACH" in breach and "revert to" in breach

