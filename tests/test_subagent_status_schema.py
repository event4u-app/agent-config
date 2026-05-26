"""P1.2 D — subagent-status envelope conformance.

Hand-written validator (no jsonschema runtime dep, matching the project
convention from `tests/conformance/retrieval/validator.py`). Mirrors
`.agent-src.uncondensed/skills/subagent-orchestration/schemas/subagent-status.json`.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))
from _lib.agent_src import resolve_logical  # noqa: E402

SCHEMA_PATH = resolve_logical(
    "skills/subagent-orchestration/schemas/subagent-status.json"
)

VALID_STATUSES = {"DONE", "DONE_WITH_CONCERNS", "NEEDS_CONTEXT", "BLOCKED"}
ALLOWED_KEYS = {
    "status", "summary", "evidence", "concerns",
    "blocking_question", "blocking_reason", "next_action",
}


def validate(envelope: dict) -> None:
    """Raise AssertionError with a useful message if envelope is invalid."""
    if not isinstance(envelope, dict):
        raise AssertionError("envelope must be a dict")

    extras = set(envelope) - ALLOWED_KEYS
    assert not extras, f"unexpected keys: {sorted(extras)}"

    assert "status" in envelope, "missing required key `status`"
    assert "summary" in envelope, "missing required key `summary`"

    status = envelope["status"]
    assert status in VALID_STATUSES, f"unknown status `{status}`"

    summary = envelope["summary"]
    assert isinstance(summary, str) and summary.strip(), "summary must be non-empty string"

    if status in {"DONE", "DONE_WITH_CONCERNS"}:
        assert "evidence" in envelope, f"{status} requires `evidence[]`"
        ev = envelope["evidence"]
        assert isinstance(ev, list) and ev, "evidence must be non-empty list"
        for item in ev:
            assert isinstance(item, str) and item.strip(), "evidence items must be non-empty strings"

    if status == "DONE":
        assert "concerns" not in envelope, "DONE must not include concerns[]"

    if status == "DONE_WITH_CONCERNS":
        assert "concerns" in envelope, "DONE_WITH_CONCERNS requires `concerns[]`"
        cn = envelope["concerns"]
        assert isinstance(cn, list) and cn, "concerns must be non-empty list"

    if status == "NEEDS_CONTEXT":
        assert "blocking_question" in envelope, "NEEDS_CONTEXT requires `blocking_question`"
        bq = envelope["blocking_question"]
        assert isinstance(bq, str) and bq.strip(), "blocking_question must be non-empty string"

    if status == "BLOCKED":
        assert "blocking_reason" in envelope, "BLOCKED requires `blocking_reason`"
        br = envelope["blocking_reason"]
        assert isinstance(br, str) and br.strip(), "blocking_reason must be non-empty string"


def test_schema_file_exists_and_parses() -> None:
    assert SCHEMA_PATH.exists(), f"schema missing at {SCHEMA_PATH}"
    payload = json.loads(SCHEMA_PATH.read_text())
    assert payload["title"] == "Subagent Status Envelope"
    enum = payload["properties"]["status"]["enum"]
    assert set(enum) == VALID_STATUSES


def test_done_envelope_passes() -> None:
    validate({
        "status": "DONE",
        "summary": "Tests green, lint clean.",
        "evidence": ["pytest tests/test_x.py exit 0", "ruff check exit 0"],
    })


def test_done_with_concerns_passes() -> None:
    validate({
        "status": "DONE_WITH_CONCERNS",
        "summary": "Shipped but follow-up needed.",
        "evidence": ["tests pass"],
        "concerns": ["Coverage drops 2% on Foo class"],
    })


def test_needs_context_passes() -> None:
    validate({
        "status": "NEEDS_CONTEXT",
        "summary": "Paused on ambiguous spec.",
        "blocking_question": "Should empty input return [] or raise?",
    })


def test_blocked_passes() -> None:
    validate({
        "status": "BLOCKED",
        "summary": "Cannot proceed — upstream API removed.",
        "blocking_reason": "vendor v3 dropped /users endpoint; no replacement.",
    })


@pytest.mark.parametrize("envelope, fragment", [
    ({"summary": "x"}, "missing required key `status`"),
    ({"status": "DONE"}, "missing required key `summary`"),
    ({"status": "OOPS", "summary": "x"}, "unknown status"),
    ({"status": "DONE", "summary": "x"}, "requires `evidence[]`"),
    ({"status": "DONE", "summary": "x", "evidence": []}, "non-empty list"),
    ({"status": "DONE", "summary": "x", "evidence": ["a"], "concerns": ["b"]},
     "DONE must not include concerns"),
    ({"status": "DONE_WITH_CONCERNS", "summary": "x", "evidence": ["a"]},
     "requires `concerns[]`"),
    ({"status": "NEEDS_CONTEXT", "summary": "x"}, "requires `blocking_question`"),
    ({"status": "BLOCKED", "summary": "x"}, "requires `blocking_reason`"),
    ({"status": "DONE", "summary": "x", "evidence": ["a"], "weird": "y"},
     "unexpected keys"),
    ({"status": "DONE", "summary": "  ", "evidence": ["a"]},
     "summary must be non-empty"),
])
def test_rejection_cases(envelope: dict, fragment: str) -> None:
    with pytest.raises(AssertionError) as exc_info:
        validate(envelope)
    assert fragment in str(exc_info.value), \
        f"expected fragment {fragment!r} in {exc_info.value!r}"
