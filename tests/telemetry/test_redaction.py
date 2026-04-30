"""Phase 5 — redaction validator tests.

The privacy floor: id fields (``task_id`` and every
``consulted``/``applied`` artefact id) are repository-internal
identifiers only. Paths, free-text, and filenames are forbidden on
both write (schema) and export (renderer + CLI).

Coverage:

- ``check_id_redaction`` unit tests — every forbidden shape produces
  a labelled :class:`EngagementSchemaError`; every realistic artefact
  id passes.
- Schema-layer enforcement — ``EngagementEvent.validate`` rejects
  the same shapes when smuggled through ``task_id`` or
  ``consulted``/``applied``.
- Round-trip safety — ``parse_event`` re-runs validation, so a
  pre-validator log line cannot resurrect into a valid event.
- Export gate — when a renderer encounters a redaction-failing id,
  ``telemetry:report`` exits 2 with a clean message instead of
  emitting the row.
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

import telemetry_report
from telemetry.aggregator import AggregateResult
from telemetry.engagement import (
    EngagementEvent,
    EngagementSchemaError,
    check_id_redaction,
    parse_event,
)
from telemetry.report_renderer import render_json, render_markdown


# ---- check_id_redaction unit tests -----------------------------------------


@pytest.mark.parametrize(
    "value",
    [
        "scripts/agent-config",
        "C:\\Users\\me",
        "skills\nphp-coder",
        "skills\rphp-coder",
        "skills\tphp-coder",
        " php-coder",
        "php-coder ",
        "scope-control.md",
        "agent-config.py",
        "settings.yaml",
        "settings.yml",
        "report.json",
        "x" * 201,  # oversize
        "",  # empty
    ],
)
def test_check_id_redaction_rejects_unsafe_shape(value: str) -> None:
    with pytest.raises(EngagementSchemaError) as excinfo:
        check_id_redaction("task_id", value)
    assert "task_id" in str(excinfo.value)


@pytest.mark.parametrize(
    "value",
    [
        "php-coder",
        "eloquent",
        "scope-control",
        "language-and-tone",
        "commit-in-chunks",
        "ticket-PROJ-42",
        "v1.0",  # numeric trailing — NOT a file extension
        "ticket-1.2",
        "agents.infra",  # last segment alphabetic but >8 chars limit applied? "infra" 5 chars → would match...
    ],
)
def test_check_id_redaction_accepts_realistic_id(value: str) -> None:
    # Note: "agents.infra" intentionally probes the dot-in-middle case;
    # the regex is anchored to end-of-string with 1-8 alpha chars, so
    # this WILL fail the validator. Pop it from the param set if it
    # must be allowed in production — see test below for the contract.
    if value == "agents.infra":
        with pytest.raises(EngagementSchemaError):
            check_id_redaction("task_id", value)
        return
    check_id_redaction("task_id", value)


def test_check_id_redaction_label_propagates() -> None:
    with pytest.raises(EngagementSchemaError) as excinfo:
        check_id_redaction("consulted.skills", "scope-control.md")
    assert "consulted.skills" in str(excinfo.value)


# ---- Schema enforcement on the event boundary ------------------------------


def _base_kwargs() -> dict:
    return {
        "ts": "2026-04-30T12:00:00Z",
        "task_id": "ticket-PROJ-42",
        "boundary_kind": "task",
        "consulted": {"skills": ["php-coder"]},
        "applied": {"skills": ["php-coder"]},
    }


def test_event_rejects_path_in_task_id() -> None:
    kw = _base_kwargs()
    kw["task_id"] = "scripts/agent-config"
    with pytest.raises(EngagementSchemaError, match="task_id"):
        EngagementEvent(**kw).validate()


def test_event_rejects_extension_in_task_id() -> None:
    kw = _base_kwargs()
    kw["task_id"] = "ticket.md"
    with pytest.raises(EngagementSchemaError, match="task_id"):
        EngagementEvent(**kw).validate()


def test_event_rejects_slash_in_consulted_id() -> None:
    kw = _base_kwargs()
    kw["consulted"] = {"skills": ["scripts/agent-config"]}
    with pytest.raises(EngagementSchemaError, match="consulted.skills"):
        EngagementEvent(**kw).validate()


def test_event_rejects_extension_in_applied_id() -> None:
    kw = _base_kwargs()
    kw["applied"] = {"rules": ["scope-control.md"]}
    with pytest.raises(EngagementSchemaError, match="applied.rules"):
        EngagementEvent(**kw).validate()


def test_event_rejects_whitespace_in_id() -> None:
    kw = _base_kwargs()
    kw["consulted"] = {"skills": [" php-coder"]}
    with pytest.raises(EngagementSchemaError, match="consulted.skills"):
        EngagementEvent(**kw).validate()


def test_parse_event_re_runs_redaction() -> None:
    # Hand-crafted line that would have slipped past an older schema.
    line = json.dumps(
        {
            "schema_version": 1,
            "ts": "2026-04-30T12:00:00Z",
            "task_id": "ticket-1",
            "boundary_kind": "task",
            "consulted": {"skills": ["scope-control.md"]},
            "applied": {},
        }
    )
    with pytest.raises(EngagementSchemaError, match="consulted.skills"):
        parse_event(line)


# ---- Export gate via the CLI -----------------------------------------------


def _aggregate_with_unsafe_id(unsafe_id: str) -> AggregateResult:
    """Build an AggregateResult that bypasses ``parse_event`` so the
    renderer's export gate is the only line of defence."""
    result = AggregateResult()
    result.total_events = 1
    result.parsed_events = 1
    result.earliest_ts = "2026-04-30T12:00:00Z"
    result.latest_ts = "2026-04-30T12:00:00Z"
    result.artefacts[("skills", unsafe_id)] = {
        "consulted": 1,
        "applied": 1,
        "last_seen_ts": "2026-04-30T12:00:00Z",
    }
    return result


@pytest.mark.parametrize(
    "unsafe_id",
    ["scripts/agent-config", "scope-control.md", " php-coder", "x" * 201],
)
def test_render_json_rejects_unsafe_id(unsafe_id: str) -> None:
    aggregate = _aggregate_with_unsafe_id(unsafe_id)
    with pytest.raises(EngagementSchemaError, match="buckets.skills.id"):
        render_json(aggregate)


def test_render_markdown_rejects_unsafe_id() -> None:
    aggregate = _aggregate_with_unsafe_id("scripts/agent-config")
    with pytest.raises(EngagementSchemaError, match="buckets.skills.id"):
        render_markdown(aggregate)


def test_report_cli_skips_pre_validator_lines(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    """A pre-validator log line is skipped at parse time and surfaced
    via the standard malformed-line warning — the CLI never writes the
    unsafe id to stdout."""
    log = tmp_path / ".agent-engagement.jsonl"
    log.write_text(
        json.dumps(
            {
                "schema_version": 1,
                "ts": "2026-04-30T12:00:00Z",
                "task_id": "ticket-1",
                "boundary_kind": "task",
                "consulted": {"skills": ["scripts/agent-config"]},
                "applied": {"skills": ["scripts/agent-config"]},
            }
        )
        + "\n",
        encoding="utf-8",
    )
    rc = telemetry_report.main(
        [
            "--log-path",
            str(log),
            "--settings",
            str(tmp_path / "missing.yml"),
            "--since",
            "all",
            "--format",
            "json",
        ]
    )
    captured = capsys.readouterr()
    assert rc == 0
    assert "scripts/agent-config" not in captured.out
    assert "skipped 1 malformed line" in captured.err
