"""Phase 1 Step 4 — schema-validation tests for the engagement module.

Coverage:

- Round-trip: ``event → to_jsonl → parse_event`` returns a structurally
  equivalent event.
- Rejection of unknown artefact kinds, unknown boundary kinds, and
  oversized ids.
- Idempotent JSONL appends: writing the same event twice produces two
  identical lines (no merging at this layer; boundary-level coalescing
  is Phase 2).
- Default-off zero file IO: importing the module and constructing
  events does not touch the filesystem. The log path is only created
  when ``append_event`` is explicitly called.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from telemetry.engagement import (
    ALLOWED_BOUNDARY_KINDS,
    ALLOWED_KINDS,
    SCHEMA_VERSION,
    EngagementEvent,
    EngagementSchemaError,
    append_event,
    now_utc_iso,
    parse_event,
)


def _valid_event() -> EngagementEvent:
    return EngagementEvent(
        ts="2026-04-30T12:00:00Z",
        task_id="ticket-PROJ-42",
        boundary_kind="task",
        consulted={"skills": ["php-coder", "eloquent"], "rules": ["scope-control"]},
        applied={"skills": ["php-coder"]},
        tokens_estimate={"consulted_load": 1234},
    )


def test_round_trip_preserves_payload() -> None:
    original = _valid_event()
    restored = parse_event(original.to_jsonl())
    assert restored.ts == original.ts
    assert restored.task_id == original.task_id
    assert restored.boundary_kind == original.boundary_kind
    assert restored.consulted == original.consulted
    assert restored.applied == original.applied
    assert restored.tokens_estimate == original.tokens_estimate
    assert restored.schema_version == SCHEMA_VERSION


def test_jsonl_is_single_line_terminated() -> None:
    line = _valid_event().to_jsonl()
    assert line.endswith("\n")
    assert line.count("\n") == 1
    parsed = json.loads(line)
    assert parsed["schema_version"] == SCHEMA_VERSION
    assert parsed["boundary_kind"] == "task"


def test_unknown_artefact_kind_rejected() -> None:
    bad = EngagementEvent(
        ts=now_utc_iso(),
        task_id="t1",
        boundary_kind="task",
        consulted={"plugins": ["nope"]},
    )
    with pytest.raises(EngagementSchemaError, match="not an allowed artefact kind"):
        bad.validate()


def test_unknown_boundary_kind_rejected() -> None:
    bad = EngagementEvent(
        ts=now_utc_iso(),
        task_id="t1",
        boundary_kind="day",
    )
    with pytest.raises(EngagementSchemaError, match="boundary_kind must be one of"):
        bad.validate()


def test_empty_task_id_rejected() -> None:
    bad = EngagementEvent(ts=now_utc_iso(), task_id="", boundary_kind="task")
    with pytest.raises(EngagementSchemaError, match="task_id must be a non-empty"):
        bad.validate()


def test_oversized_id_rejected() -> None:
    bad = EngagementEvent(
        ts=now_utc_iso(),
        task_id="t1",
        boundary_kind="task",
        consulted={"skills": ["x" * 201]},
    )
    with pytest.raises(EngagementSchemaError, match="exceeds 200 chars"):
        bad.validate()


def test_parse_event_rejects_invalid_json() -> None:
    with pytest.raises(EngagementSchemaError, match="not valid JSON"):
        parse_event("{not-json")


def test_parse_event_rejects_unknown_kind_round_trip() -> None:
    raw = json.dumps({
        "schema_version": SCHEMA_VERSION,
        "ts": now_utc_iso(),
        "task_id": "t1",
        "boundary_kind": "task",
        "consulted": {"plugins": ["nope"]},
        "applied": {},
    })
    with pytest.raises(EngagementSchemaError, match="not an allowed artefact kind"):
        parse_event(raw)


def test_append_event_writes_one_line(tmp_path: Path) -> None:
    log = tmp_path / ".agent-engagement.jsonl"
    append_event(log, _valid_event())
    assert log.exists()
    assert log.read_text().count("\n") == 1


def test_append_event_idempotent_serialisation(tmp_path: Path) -> None:
    """Two appends of the same event produce two byte-identical lines."""
    log = tmp_path / ".agent-engagement.jsonl"
    event = _valid_event()
    append_event(log, event)
    append_event(log, event)
    lines = log.read_text().splitlines()
    assert len(lines) == 2
    assert lines[0] == lines[1]


def test_default_off_zero_file_io(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    """Importing the module and constructing events touches no files.

    Caller (Phase 2 CLI) is responsible for the enabled-flag check;
    the schema layer here writes only when ``append_event`` is called
    explicitly. This test asserts the discipline by chdir-ing into a
    clean tmp directory and doing everything **except** appending.
    """
    monkeypatch.chdir(tmp_path)
    event = _valid_event()
    event.validate()
    _ = event.to_jsonl()
    _ = parse_event(event.to_jsonl())
    # Nothing should have been written.
    assert list(tmp_path.iterdir()) == []


def test_allowed_constants_are_stable() -> None:
    """Lock the public surface so a refactor cannot silently widen it."""
    assert ALLOWED_KINDS == (
        "skills", "rules", "commands", "guidelines", "personas",
    )
    assert ALLOWED_BOUNDARY_KINDS == ("task", "phase-step", "tool-call")
    assert SCHEMA_VERSION == 1
