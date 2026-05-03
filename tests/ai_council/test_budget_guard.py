"""24h-rolling spend guard (D3)."""

from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council.budget_guard import (  # noqa: E402
    record_spend,
    today_spend_usd,
    would_exceed,
)


def _now() -> dt.datetime:
    return dt.datetime(2026, 5, 2, 12, 0, tzinfo=dt.timezone.utc)


def test_empty_ledger_reports_zero(tmp_path: Path) -> None:
    p = tmp_path / "council-spend.jsonl"
    assert today_spend_usd(path=p, now=_now()) == 0.0


def test_record_spend_creates_ledger_with_0600(tmp_path: Path) -> None:
    p = tmp_path / "council-spend.jsonl"
    assert record_spend(0.05, "anthropic", "x", path=p, now=_now())
    assert p.exists()
    assert (p.stat().st_mode & 0o777) == 0o600


def test_record_spend_zero_or_negative_is_noop(tmp_path: Path) -> None:
    p = tmp_path / "council-spend.jsonl"
    assert record_spend(0.0, "manual", "x", path=p, now=_now())
    assert record_spend(-1.0, "manual", "x", path=p, now=_now())
    assert not p.exists()


def test_today_sum_inside_24h_window(tmp_path: Path) -> None:
    p = tmp_path / "council-spend.jsonl"
    now = _now()
    record_spend(0.10, "anthropic", "x", path=p, now=now - dt.timedelta(hours=1))
    record_spend(0.20, "openai", "y", path=p, now=now - dt.timedelta(hours=23))
    assert today_spend_usd(path=p, now=now) == pytest.approx(0.30)


def test_old_entries_outside_window_excluded(tmp_path: Path) -> None:
    p = tmp_path / "council-spend.jsonl"
    now = _now()
    record_spend(0.99, "anthropic", "x", path=p, now=now - dt.timedelta(hours=25))
    record_spend(0.10, "openai", "y", path=p, now=now - dt.timedelta(hours=1))
    assert today_spend_usd(path=p, now=now) == pytest.approx(0.10)


def test_would_exceed_threshold(tmp_path: Path) -> None:
    p = tmp_path / "council-spend.jsonl"
    now = _now()
    record_spend(0.40, "anthropic", "x", path=p, now=now - dt.timedelta(hours=2))
    assert not would_exceed(0.50, 0.05, path=p, now=now)
    assert would_exceed(0.50, 0.20, path=p, now=now)


def test_zero_or_negative_limit_disables_guard(tmp_path: Path) -> None:
    p = tmp_path / "council-spend.jsonl"
    record_spend(100.0, "anthropic", "x", path=p, now=_now())
    assert not would_exceed(0.0, 1000.0, path=p, now=_now())
    assert not would_exceed(-1.0, 1000.0, path=p, now=_now())


def test_malformed_lines_are_skipped(tmp_path: Path) -> None:
    p = tmp_path / "council-spend.jsonl"
    p.write_text(
        "not-json\n"
        '{"ts": "not-an-iso", "usd": 1.0}\n'
        '{"ts": "2026-05-02T11:00:00+00:00", "usd": "not-a-float"}\n'
        '{"ts": "2026-05-02T11:00:00+00:00", "usd": 0.05, '
        '"provider": "anthropic", "model": "x"}\n',
    )
    assert today_spend_usd(path=p, now=_now()) == pytest.approx(0.05)


def test_ledger_format_is_jsonl(tmp_path: Path) -> None:
    p = tmp_path / "council-spend.jsonl"
    record_spend(0.10, "anthropic", "claude-x", path=p, now=_now())
    record_spend(0.05, "openai", "gpt-x", path=p, now=_now())
    lines = p.read_text().strip().splitlines()
    assert len(lines) == 2
    obj = json.loads(lines[0])
    assert set(obj.keys()) >= {"ts", "usd", "provider", "model"}
    assert obj["usd"] == 0.10
    assert obj["provider"] == "anthropic"
