"""Step-8 Phase 5 — ``quota_summary_line`` warn-at threshold tests.

Covers:

- Uncapped providers are omitted from the summary entirely.
- Below ``warn_at`` ratio → bare ``council:quota · …`` line, no warn list.
- At-or-above ``warn_at`` ratio → ``⚠️`` prefix and the provider name
  surfaces in the ``warn_providers`` list.
- Mixed cohorts: only the providers that cross the threshold appear in
  ``warn_providers``; the rest stay in the body of the summary.
- ``warn_at`` is per-client — different members can carry different
  thresholds; the helper honours each one.

The helper is exercised directly (no subprocess, no real CLI binary).
``CliClient`` construction is bypassed via a thin stub that exposes
only the attributes ``quota_summary_line`` reads (``name``,
``max_calls_per_day``, ``warn_at``).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.ai_council.clients import quota_summary_line  # noqa: E402


class _StubCliClient:
    """Minimal stand-in for :class:`CliClient` (avoids PATH lookups)."""

    def __init__(
        self, name: str, max_calls_per_day: int | None, warn_at: float = 0.8,
    ):
        self.name = name
        self.max_calls_per_day = max_calls_per_day
        self.warn_at = warn_at


def _write_counts(path: Path, counts: dict[str, int]) -> None:
    from datetime import datetime, timezone

    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({
            "date": datetime.now(timezone.utc).date().isoformat(),
            "counts": counts,
        }),
        encoding="utf-8",
    )


def test_uncapped_providers_are_omitted(tmp_path: Path) -> None:
    """Providers without ``max_calls_per_day`` never appear in the summary."""
    state = tmp_path / "cli-calls.json"
    _write_counts(state, {"openai": 5})
    clients = [
        _StubCliClient("openai", max_calls_per_day=None),
        _StubCliClient("anthropic", max_calls_per_day=None),
    ]
    summary, warn = quota_summary_line(clients, cli_calls_path=state)
    assert summary == ""
    assert warn == []


def test_below_warn_at_no_prefix(tmp_path: Path) -> None:
    """``used/limit < warn_at`` → bare line, no ``⚠️`` prefix."""
    state = tmp_path / "cli-calls.json"
    _write_counts(state, {"anthropic": 5, "openai": 10})
    clients = [
        _StubCliClient("anthropic", max_calls_per_day=30, warn_at=0.8),
        _StubCliClient("openai", max_calls_per_day=50, warn_at=0.8),
    ]
    summary, warn = quota_summary_line(clients, cli_calls_path=state)
    assert summary.startswith("council:quota · ")
    assert "⚠️" not in summary
    assert "anthropic 5/30" in summary
    assert "openai 10/50" in summary
    assert warn == []


def test_at_or_above_warn_at_flips_prefix(tmp_path: Path) -> None:
    """``used/limit >= warn_at`` flips the prefix and lists the provider."""
    state = tmp_path / "cli-calls.json"
    # 24/30 = 0.8 — exactly at the default threshold.
    _write_counts(state, {"anthropic": 24})
    clients = [
        _StubCliClient("anthropic", max_calls_per_day=30, warn_at=0.8),
    ]
    summary, warn = quota_summary_line(clients, cli_calls_path=state)
    assert summary.startswith("⚠️  council:quota · ")
    assert "anthropic 24/30" in summary
    assert warn == ["anthropic"]


def test_mixed_cohort_only_crossing_providers_warn(tmp_path: Path) -> None:
    """Only providers that crossed the threshold land in ``warn_providers``."""
    state = tmp_path / "cli-calls.json"
    # anthropic 25/30 ≈ 0.833 (warn); openai 10/50 = 0.20 (ok).
    _write_counts(state, {"anthropic": 25, "openai": 10})
    clients = [
        _StubCliClient("anthropic", max_calls_per_day=30, warn_at=0.8),
        _StubCliClient("openai", max_calls_per_day=50, warn_at=0.8),
    ]
    summary, warn = quota_summary_line(clients, cli_calls_path=state)
    assert summary.startswith("⚠️  council:quota · ")
    assert "anthropic 25/30" in summary
    assert "openai 10/50" in summary
    assert warn == ["anthropic"]


def test_per_client_warn_at_is_honoured(tmp_path: Path) -> None:
    """Different ``warn_at`` per client → independent thresholds."""
    state = tmp_path / "cli-calls.json"
    # anthropic 15/30 = 0.5 ≥ warn_at=0.5 → warn.
    # openai    15/30 = 0.5 < warn_at=0.9 → ok.
    _write_counts(state, {"anthropic": 15, "openai": 15})
    clients = [
        _StubCliClient("anthropic", max_calls_per_day=30, warn_at=0.5),
        _StubCliClient("openai", max_calls_per_day=30, warn_at=0.9),
    ]
    summary, warn = quota_summary_line(clients, cli_calls_path=state)
    assert summary.startswith("⚠️  council:quota · ")
    assert warn == ["anthropic"]


def test_missing_state_file_treats_counts_as_zero(tmp_path: Path) -> None:
    """No ``cli-calls.json`` yet → all counts are 0, no warn."""
    state = tmp_path / "cli-calls.json"  # not created
    clients = [
        _StubCliClient("anthropic", max_calls_per_day=30, warn_at=0.8),
    ]
    summary, warn = quota_summary_line(clients, cli_calls_path=state)
    assert summary == "council:quota · anthropic 0/30"
    assert warn == []


def test_empty_client_list_returns_empty_summary(tmp_path: Path) -> None:
    """No clients → no summary, no warn list."""
    summary, warn = quota_summary_line([], cli_calls_path=tmp_path / "x.json")
    assert summary == ""
    assert warn == []
