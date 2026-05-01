"""Phase 4 Step 4 — aggregator tests.

Coverage:

- Empty log → empty result, no crash, all counters zero.
- Representative log → expected per-artefact counts; rank order
  deterministic; ratios computed from consulted+applied.
- Mixed-good-and-bad log → malformed lines counted in
  ``skipped_lines``, valid events still aggregated.
- ``since`` cutoff → events at-or-before cutoff excluded; events
  strictly after included.
- Missing log file → empty result (no exception).
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from pathlib import Path

from telemetry.aggregator import aggregate, rank_artefacts
from telemetry.engagement import EngagementEvent


def _write(path: Path, lines: list[str]) -> None:
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _event_line(
    ts: str,
    *,
    task_id: str = "ticket-1",
    consulted: dict[str, list[str]] | None = None,
    applied: dict[str, list[str]] | None = None,
) -> str:
    return EngagementEvent(
        ts=ts,
        task_id=task_id,
        boundary_kind="task",
        consulted=consulted or {},
        applied=applied or {},
    ).to_jsonl().rstrip("\n")


def test_aggregate_missing_file_returns_empty(tmp_path: Path) -> None:
    result = aggregate(tmp_path / "does-not-exist.jsonl")
    assert result.total_events == 0
    assert result.parsed_events == 0
    assert result.skipped_lines == 0
    assert result.stats() == []


def test_aggregate_empty_file_returns_empty(tmp_path: Path) -> None:
    log = tmp_path / "log.jsonl"
    log.write_text("", encoding="utf-8")
    result = aggregate(log)
    assert result.total_events == 0
    assert result.parsed_events == 0
    assert result.skipped_lines == 0


def test_aggregate_counts_per_artefact(tmp_path: Path) -> None:
    log = tmp_path / "log.jsonl"
    _write(log, [
        _event_line("2026-04-30T12:00:00Z", consulted={"skills": ["a", "b"]}, applied={"skills": ["a"]}),
        _event_line("2026-04-30T12:01:00Z", consulted={"skills": ["a"], "rules": ["r1"]}, applied={"rules": ["r1"]}),
        _event_line("2026-04-30T12:02:00Z", consulted={"skills": ["a"]}, applied={"skills": ["a"]}),
    ])
    result = aggregate(log)
    assert result.parsed_events == 3
    assert result.skipped_lines == 0
    by_id = {(s.kind, s.artefact_id): s for s in result.stats()}
    assert by_id[("skills", "a")].consulted == 3
    assert by_id[("skills", "a")].applied == 2
    assert by_id[("skills", "b")].consulted == 1
    assert by_id[("skills", "b")].applied == 0
    assert by_id[("rules", "r1")].consulted == 1
    assert by_id[("rules", "r1")].applied == 1
    assert by_id[("skills", "a")].applied_ratio == 2 / 3
    assert by_id[("skills", "a")].last_seen_ts == "2026-04-30T12:02:00Z"


def test_aggregate_skips_malformed_lines(tmp_path: Path) -> None:
    log = tmp_path / "log.jsonl"
    log.write_text(
        "\n".join([
            _event_line("2026-04-30T12:00:00Z", consulted={"skills": ["a"]}),
            "{not valid json",
            "",  # blank line — not counted as malformed
            _event_line("2026-04-30T12:01:00Z", consulted={"skills": ["a"]}),
            "{\"ts\": \"\", \"task_id\": \"\"}",  # schema-invalid
        ]) + "\n",
        encoding="utf-8",
    )
    result = aggregate(log)
    assert result.parsed_events == 2
    assert result.skipped_lines == 2
    assert result.total_events == 4  # 2 valid + 2 malformed; blank line ignored


def test_aggregate_since_cutoff_excludes_old(tmp_path: Path) -> None:
    log = tmp_path / "log.jsonl"
    _write(log, [
        _event_line("2026-04-29T12:00:00Z", consulted={"skills": ["old"]}),
        _event_line("2026-04-30T12:00:00Z", consulted={"skills": ["new"]}),
    ])
    cutoff = datetime(2026, 4, 30, 0, 0, 0, tzinfo=timezone.utc)
    result = aggregate(log, since=cutoff)
    ids = {s.artefact_id for s in result.stats()}
    assert ids == {"new"}
    assert result.parsed_events == 1


def test_rank_artefacts_is_deterministic_on_ties(tmp_path: Path) -> None:
    log = tmp_path / "log.jsonl"
    _write(log, [
        _event_line("2026-04-30T12:00:00Z", consulted={"skills": ["b", "a"]}, applied={"skills": ["b", "a"]}),
        _event_line("2026-04-30T12:01:00Z", consulted={"rules": ["r1"]}, applied={"rules": ["r1"]}),
    ])
    ranked = rank_artefacts(aggregate(log).stats())
    # Same applied/consulted across all → secondary sort by (kind, id) ASC.
    assert [(s.kind, s.artefact_id) for s in ranked] == [
        ("rules", "r1"),
        ("skills", "a"),
        ("skills", "b"),
    ]


def test_aggregate_records_ts_range(tmp_path: Path) -> None:
    log = tmp_path / "log.jsonl"
    _write(log, [
        _event_line("2026-04-30T12:01:00Z", consulted={"skills": ["a"]}),
        _event_line("2026-04-30T12:00:00Z", consulted={"skills": ["a"]}),
        _event_line("2026-04-30T12:05:00Z", consulted={"skills": ["a"]}),
    ])
    result = aggregate(log)
    assert result.earliest_ts == "2026-04-30T12:00:00Z"
    assert result.latest_ts == "2026-04-30T12:05:00Z"
