"""Unit tests for `scripts/redact_hook_capture.py`.

Covers the redactor used by the verified-platforms roadmap to
sanitise captured hook payloads before they land in
``agents/roadmaps/road-to-verified-chat-history-platforms.md``.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import redact_hook_capture as rhc  # noqa: E402

REDACTED = rhc.REDACTED


def test_redacts_known_user_content_keys() -> None:
    record = {
        "captured_at": "2026-05-05T10:00:00Z",
        "platform": "cursor",
        "raw_payload": {
            "hook_event_name": "stop",
            "session_id": "abc123",
            "prompt": "secret user input",
            "response": "secret agent output",
            "model": "claude-opus-4.7",
        },
    }
    out = rhc.redact(record)
    assert out["raw_payload"]["prompt"] == REDACTED
    assert out["raw_payload"]["response"] == REDACTED
    # envelope preserved
    assert out["raw_payload"]["hook_event_name"] == "stop"
    assert out["raw_payload"]["session_id"] == "abc123"
    assert out["raw_payload"]["model"] == "claude-opus-4.7"
    assert out["captured_at"] == "2026-05-05T10:00:00Z"
    assert out["platform"] == "cursor"


def test_redacts_nested_augment_conversation_shape() -> None:
    record = {
        "raw_payload": {
            "hook_event_name": "Stop",
            "conversation": {
                "userPrompt": "secret",
                "agentTextResponse": "secret reply",
                "agentCodeResponse": [
                    {"path": "src/foo.py", "changeType": "edit",
                     "content": "secret diff body"}
                ],
            },
        },
    }
    out = rhc.redact(record)
    conv = out["raw_payload"]["conversation"]
    assert conv["userPrompt"] == REDACTED
    assert conv["agentTextResponse"] == REDACTED
    # path + changeType preserved; content redacted
    assert conv["agentCodeResponse"][0]["path"] == "src/foo.py"
    assert conv["agentCodeResponse"][0]["changeType"] == "edit"
    assert conv["agentCodeResponse"][0]["content"] == REDACTED


def test_strict_mode_redacts_long_unknown_strings() -> None:
    record = {
        "raw_payload": {
            "hook_event_name": "stop",
            "some_unknown_field": "x" * 200,
            "short_value": "ok",
        },
    }
    out = rhc.redact(record, strict=True, max_len=50)
    assert out["raw_payload"]["some_unknown_field"] == REDACTED
    assert out["raw_payload"]["short_value"] == "ok"
    # envelope still intact
    assert out["raw_payload"]["hook_event_name"] == "stop"


def test_envelope_keys_kept_under_strict() -> None:
    record = {
        "raw_payload": {
            "transcript_path": "/Users/me/very/long/path/to/transcript.jsonl"
                                + "/" * 200,
            "session_id": "abcdef0123456789" * 5,
        },
    }
    out = rhc.redact(record, strict=True, max_len=10)
    # Envelope keys exempted from strict-length redaction
    assert out["raw_payload"]["transcript_path"].startswith("/Users/me/")
    assert "abcdef" in out["raw_payload"]["session_id"]


def test_redacts_lists_and_recurses() -> None:
    record = {
        "raw_payload": {
            "messages": [
                {"role": "user", "content": "secret 1"},
                {"role": "assistant", "content": "secret 2"},
            ],
        },
    }
    out = rhc.redact(record)
    assert out["raw_payload"]["messages"][0]["content"] == REDACTED
    assert out["raw_payload"]["messages"][1]["content"] == REDACTED


def test_cli_single_file(tmp_path: Path) -> None:
    record = {
        "captured_at": "2026-05-05T10:00:00Z",
        "platform": "cursor",
        "raw_payload": {"prompt": "secret"},
    }
    src = tmp_path / "capture.json"
    src.write_text(json.dumps(record), encoding="utf-8")
    rc = rhc.main([str(src)])
    assert rc == 0
    out_path = src.with_suffix(".redacted.json")
    assert out_path.exists()
    out = json.loads(out_path.read_text(encoding="utf-8"))
    assert out["raw_payload"]["prompt"] == REDACTED


def test_cli_directory_mode(tmp_path: Path) -> None:
    for i in range(3):
        (tmp_path / f"capture-{i}.json").write_text(
            json.dumps({"raw_payload": {"prompt": f"secret-{i}"}}),
            encoding="utf-8")
    rc = rhc.main([str(tmp_path)])
    assert rc == 0
    redacted_files = sorted(tmp_path.glob("*.redacted.json"))
    assert len(redacted_files) == 3
    for f in redacted_files:
        data = json.loads(f.read_text(encoding="utf-8"))
        assert data["raw_payload"]["prompt"] == REDACTED


def test_cli_missing_input_returns_2(tmp_path: Path) -> None:
    rc = rhc.main([str(tmp_path / "does-not-exist.json")])
    assert rc == 2
