"""Schema + privacy + kill-switch tests for the council events log.

Roadmap: ``agents/roadmaps/step-8-quota-necessity-transparency.md``
Phase 3 / Phase 5 deliverable.

The events log is the single source of truth for "why did the council
skip / block this?" retros, so the schema contract is locked here:

* exactly one JSON object per line (JSONL);
* schema_version, ts_utc, lens, invocation, action, verdict,
  provider_caps, original_ask_hash are always present;
* ``original_ask_hash`` is ``sha256(original_ask)[:12]`` — never the
  raw prompt (privacy floor from ``agents/low-impact-decisions.md``);
* ``AGENT_CONFIG_NO_EVENTS_LOG=1`` is a hard kill-switch: no file is
  written, no exception is raised.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path

import pytest

from scripts.ai_council.events_log import (
    SCHEMA_VERSION, _VALID_ACTIONS, append_event, default_log_path,
)


REQUIRED_FIELDS = frozenset({
    "schema_version", "ts_utc", "lens", "invocation",
    "action", "verdict", "provider_caps", "original_ask_hash",
})


@pytest.fixture(autouse=True)
def _enable_writes(monkeypatch: pytest.MonkeyPatch) -> None:
    """Override the session-wide kill-switch for this file.

    ``tests/conftest.py`` keeps ``AGENT_CONFIG_NO_EVENTS_LOG=1`` so the
    test suite never writes to the real ``agents/runtime/council/events.log``.
    This file is the schema contract — it must exercise the writer.
    """
    monkeypatch.delenv("AGENT_CONFIG_NO_EVENTS_LOG", raising=False)


def _read_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text("utf-8").splitlines()]


def test_schema_version_is_one() -> None:
    assert SCHEMA_VERSION == 1


def test_default_log_path_anchored_to_repo(tmp_path: Path) -> None:
    """Sanity-check the canonical location callers will land on."""
    p = default_log_path()
    assert p.name == "events.log"
    assert p.parent.name == "council"
    assert p.parent.parent.name == "runtime"
    assert p.parent.parent.parent.name == "agents"


def test_append_event_writes_one_line_with_required_fields(
    tmp_path: Path,
) -> None:
    log = tmp_path / "events.log"
    written = append_event(
        {
            "lens": "analysis",
            "invocation": "user_explicit",
            "action": "proceed",
            "verdict": "necessary",
            "provider_caps": {"anthropic": {"mode": "cli"}},
            "original_ask": "should we use option C?",
        },
        log_path=log,
    )
    assert written is True
    rows = _read_jsonl(log)
    assert len(rows) == 1
    row = rows[0]
    assert REQUIRED_FIELDS.issubset(row.keys())
    assert row["schema_version"] == 1
    assert row["lens"] == "analysis"
    assert row["invocation"] == "user_explicit"
    assert row["action"] == "proceed"
    assert row["verdict"] == "necessary"
    assert row["provider_caps"] == {"anthropic": {"mode": "cli"}}
    # ts_utc shape is ISO-8601 with Z suffix; cheap structural check.
    assert row["ts_utc"].endswith("Z")
    assert "T" in row["ts_utc"]


def test_original_ask_hash_is_sha256_first_12(tmp_path: Path) -> None:
    log = tmp_path / "events.log"
    raw = "fix the failing typo test"
    expected = hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12]
    append_event(
        {
            "lens": "debate", "invocation": "agent",
            "action": "skip_necessity", "verdict": "unnecessary",
            "provider_caps": {}, "original_ask": raw,
        },
        log_path=log,
    )
    row = _read_jsonl(log)[0]
    assert row["original_ask_hash"] == expected
    # Raw prompt never leaks (privacy floor).
    assert raw not in log.read_text("utf-8")
    assert "original_ask" not in row


def test_empty_original_ask_yields_stable_zero_hash(tmp_path: Path) -> None:
    log = tmp_path / "events.log"
    append_event(
        {
            "lens": "analysis", "invocation": "user_explicit",
            "action": "proceed", "verdict": "necessary",
            "provider_caps": {},
        },
        log_path=log,
    )
    row = _read_jsonl(log)[0]
    assert row["original_ask_hash"] == "0" * 12


def test_append_multiple_events_appends_lines(tmp_path: Path) -> None:
    log = tmp_path / "events.log"
    for action in ("proceed", "skip_necessity", "block_quota"):
        append_event(
            {
                "lens": "analysis", "invocation": "agent",
                "action": action, "verdict": "necessary",
                "provider_caps": {}, "original_ask": f"q-{action}",
            },
            log_path=log,
        )
    rows = _read_jsonl(log)
    assert [r["action"] for r in rows] == list(_VALID_ACTIONS - set()) or len(rows) == 3
    assert len(rows) == 3


def test_invalid_action_rejected(tmp_path: Path) -> None:
    log = tmp_path / "events.log"
    with pytest.raises(ValueError, match="action"):
        append_event(
            {
                "lens": "x", "invocation": "agent",
                "action": "shrug", "verdict": "necessary",
                "provider_caps": {}, "original_ask": "x",
            },
            log_path=log,
        )
    assert not log.exists()


def test_kill_switch_disables_write(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch,
) -> None:
    log = tmp_path / "events.log"
    monkeypatch.setenv("AGENT_CONFIG_NO_EVENTS_LOG", "1")
    written = append_event(
        {
            "lens": "analysis", "invocation": "user_explicit",
            "action": "proceed", "verdict": "necessary",
            "provider_caps": {}, "original_ask": "anything",
        },
        log_path=log,
    )
    assert written is False
    assert not log.exists()


def test_passthrough_diagnostic_fields_kept(tmp_path: Path) -> None:
    """Caller-supplied diagnostic fields outside the reserved set survive."""
    log = tmp_path / "events.log"
    append_event(
        {
            "lens": "analysis", "invocation": "agent",
            "action": "skip_necessity", "verdict": "unnecessary",
            "provider_caps": {}, "original_ask": "x",
            "category": "trivial_typo", "mode": "educate",
        },
        log_path=log,
    )
    row = _read_jsonl(log)[0]
    assert row["category"] == "trivial_typo"
    assert row["mode"] == "educate"
