"""Phase 2 — BoundarySession + record_event tests."""
from __future__ import annotations

import json
import multiprocessing as mp
from pathlib import Path

import pytest

from telemetry.boundary import BoundarySession, open_boundary, record_event
from telemetry.engagement import (
    EngagementEvent,
    EngagementSchemaError,
    now_utc_iso,
    parse_event,
)


def _read_lines(path: Path) -> list[str]:
    return [line for line in path.read_text().splitlines() if line.strip()]


def test_boundary_session_coalesces_duplicates(tmp_path: Path) -> None:
    log = tmp_path / ".agent-engagement.jsonl"
    with open_boundary("ticket-1", "task", log) as session:
        session.add_consulted("skills", ["php-coder", "eloquent"])
        session.add_consulted("skills", ["php-coder"])  # duplicate
        session.add_applied("skills", ["php-coder"])
        session.add_applied("rules", ["scope-control"])

    lines = _read_lines(log)
    assert len(lines) == 1
    event = parse_event(lines[0] + "\n")
    assert event.consulted == {"skills": ["eloquent", "php-coder"]}  # sorted, deduped
    assert event.applied == {"skills": ["php-coder"], "rules": ["scope-control"]}


def test_boundary_session_empty_does_not_write(tmp_path: Path) -> None:
    log = tmp_path / ".agent-engagement.jsonl"
    with open_boundary("ticket-2", "task", log):
        pass  # no add_* calls
    assert not log.exists()


def test_boundary_session_exception_suppresses_flush(tmp_path: Path) -> None:
    log = tmp_path / ".agent-engagement.jsonl"
    with pytest.raises(RuntimeError):
        with open_boundary("ticket-3", "phase-step", log) as session:
            session.add_consulted("skills", ["x"])
            raise RuntimeError("boundary failed")
    assert not log.exists()


def test_boundary_session_double_flush_is_idempotent(tmp_path: Path) -> None:
    log = tmp_path / ".agent-engagement.jsonl"
    session = BoundarySession(
        task_id="ticket-4",
        boundary_kind="task",
        log_path=log,
    )
    session.add_consulted("rules", ["scope-control"])
    assert session.flush() is True
    assert session.flush() is False  # no-op on second call
    assert len(_read_lines(log)) == 1


def test_boundary_session_rejects_unknown_kind(tmp_path: Path) -> None:
    log = tmp_path / ".agent-engagement.jsonl"
    session = BoundarySession("t", "task", log)
    with pytest.raises(EngagementSchemaError, match="not an allowed artefact kind"):
        session.add_consulted("plugins", ["x"])


def test_boundary_session_rejects_unknown_boundary(tmp_path: Path) -> None:
    with pytest.raises(EngagementSchemaError, match="boundary_kind must be one of"):
        BoundarySession("t", "day", tmp_path / "log.jsonl")


def test_record_event_validates_before_writing(tmp_path: Path) -> None:
    log = tmp_path / ".agent-engagement.jsonl"
    bad = EngagementEvent(ts=now_utc_iso(), task_id="", boundary_kind="task")
    with pytest.raises(EngagementSchemaError):
        record_event(log, bad)
    assert not log.exists()  # no partial write


def _writer_process(args: tuple[str, int]) -> None:
    """Module-level worker so multiprocessing can pickle it."""
    log_path_str, idx = args
    event = EngagementEvent(
        ts=now_utc_iso(),
        task_id=f"ticket-{idx}",
        boundary_kind="task",
        consulted={"skills": [f"skill-{idx}"]},
    )
    record_event(Path(log_path_str), event)


def test_record_event_concurrent_writes_no_interleaving(tmp_path: Path) -> None:
    """Twenty parallel writers produce twenty well-formed lines."""
    log = tmp_path / ".agent-engagement.jsonl"
    n_writers = 20

    # spawn context for cross-platform CI predictability
    ctx = mp.get_context("spawn")
    with ctx.Pool(processes=4) as pool:
        pool.map(_writer_process, [(str(log), i) for i in range(n_writers)])

    lines = _read_lines(log)
    assert len(lines) == n_writers
    # Each line must round-trip; if any byte from one writer leaked into
    # another's line, parse_event would fail.
    seen_task_ids: set[str] = set()
    for line in lines:
        event = parse_event(line + "\n")
        seen_task_ids.add(event.task_id)
    assert seen_task_ids == {f"ticket-{i}" for i in range(n_writers)}


def test_record_event_each_line_is_complete_json(tmp_path: Path) -> None:
    """Belt-and-braces: every line is valid JSON, no truncation."""
    log = tmp_path / ".agent-engagement.jsonl"
    for i in range(5):
        record_event(
            log,
            EngagementEvent(
                ts=now_utc_iso(),
                task_id=f"t-{i}",
                boundary_kind="task",
                consulted={"skills": ["x"]},
            ),
        )
    for line in _read_lines(log):
        parsed = json.loads(line)
        assert parsed["schema_version"] == 1
        assert parsed["boundary_kind"] == "task"
