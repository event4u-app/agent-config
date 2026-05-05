"""Parser unit tests for `dispatch_hook` — Phase 7.11 layer (a).

Exercises the pure-function surface of the dispatcher (no subprocess,
no filesystem writes). Companion layers:

- (b) `tests/hooks/test_install_snapshot.py` — install-output shape.
- (c) `tests/hooks/test_event_shape_contract.py` — per-platform
      native payload → envelope contract.

These tests fail loudly on any breaking change to the dispatcher's
internal parser surface so concern authors can rely on the helpers.
"""
from __future__ import annotations

import argparse
import sys
import textwrap
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts" / "hooks"))

import dispatch_hook  # noqa: E402


# --- _fallback_yaml -------------------------------------------------

def test_fallback_yaml_handles_lists_and_scalars() -> None:
    body = textwrap.dedent("""\
        # comment line
        schema_version: 1
        concerns:
          chat-history:
            script: scripts/chat_history.py
            args: [hook-dispatch]
            fail_closed: false
        platforms:
          augment:
            session_start: [chat-history]
            stop: []
          copilot:
            fallback_only: true
    """)
    parsed = dispatch_hook._fallback_yaml(body)
    assert parsed["schema_version"] == 1
    assert parsed["concerns"]["chat-history"]["script"] == "scripts/chat_history.py"
    assert parsed["concerns"]["chat-history"]["args"] == ["hook-dispatch"]
    assert parsed["concerns"]["chat-history"]["fail_closed"] is False
    assert parsed["platforms"]["augment"]["session_start"] == ["chat-history"]
    assert parsed["platforms"]["augment"]["stop"] == []
    assert parsed["platforms"]["copilot"]["fallback_only"] is True


def test_fallback_yaml_strips_quoted_scalars() -> None:
    parsed = dispatch_hook._fallback_yaml('key: "quoted-value"\n')
    assert parsed == {"key": "quoted-value"}


# --- _resolve_concerns ---------------------------------------------

_MANIFEST = {
    "concerns": {
        "chat-history": {"script": "scripts/chat_history.py", "args": ["hook-dispatch"]},
        "roadmap-progress": {"script": "scripts/roadmap_progress_hook.py"},
    },
    "platforms": {
        "augment": {"session_start": ["chat-history"],
                     "stop": ["chat-history", "roadmap-progress"]},
        "copilot": {"fallback_only": True},
    },
}


def test_resolve_concerns_returns_ordered_list() -> None:
    out = dispatch_hook._resolve_concerns(_MANIFEST, "augment", "stop")
    assert [c["name"] for c in out] == ["chat-history", "roadmap-progress"]
    assert out[0]["script"] == "scripts/chat_history.py"


def test_resolve_concerns_unknown_platform_yields_empty() -> None:
    assert dispatch_hook._resolve_concerns(_MANIFEST, "ghost", "stop") == []


def test_resolve_concerns_unknown_event_yields_empty() -> None:
    assert dispatch_hook._resolve_concerns(_MANIFEST, "augment", "ghost") == []


def test_resolve_concerns_fallback_only_platform_yields_empty() -> None:
    assert dispatch_hook._resolve_concerns(_MANIFEST, "copilot", "stop") == []


def test_resolve_concerns_skips_unknown_concern_name(capsys) -> None:
    bad = {"concerns": {}, "platforms": {"augment": {"stop": ["missing"]}}}
    assert dispatch_hook._resolve_concerns(bad, "augment", "stop") == []
    assert "unknown concern" in capsys.readouterr().err


# --- _build_envelope -----------------------------------------------

def _ns(platform: str = "augment", event: str = "stop",
        native: str = "Stop") -> argparse.Namespace:
    return argparse.Namespace(platform=platform, event=event,
                              native_event=native)


def test_build_envelope_schema_and_passthrough() -> None:
    env = dispatch_hook._build_envelope(_ns(), '{"session_id": "abc", "extra": 1}')
    assert env["schema_version"] == 1
    assert env["platform"] == "augment"
    assert env["event"] == "stop"
    assert env["native_event"] == "Stop"
    assert env["session_id"] == "abc"
    assert env["payload"] == {"session_id": "abc", "extra": 1}
    assert env["settings"] == {}


def test_build_envelope_empty_stdin_yields_empty_payload() -> None:
    env = dispatch_hook._build_envelope(_ns(), "")
    assert env["payload"] == {}


def test_build_envelope_non_dict_payload_wrapped() -> None:
    env = dispatch_hook._build_envelope(_ns(), '"raw-string"')
    assert env["payload"] == {"_raw": "raw-string"}


def test_build_envelope_malformed_json_preserved_as_raw() -> None:
    env = dispatch_hook._build_envelope(_ns(), "{not-json")
    assert env["payload"] == {"_raw": "{not-json"}


# --- _parse_concern_stdout / _severity_for / _reduce ---------------

def test_parse_concern_stdout_variants() -> None:
    assert dispatch_hook._parse_concern_stdout("") == {}
    assert dispatch_hook._parse_concern_stdout("not json") == {"_raw_stdout": "not json"}
    assert dispatch_hook._parse_concern_stdout('{"decision": "warn"}') == {"decision": "warn"}
    assert dispatch_hook._parse_concern_stdout("[1, 2]") == {"_raw": [1, 2]}


def test_severity_for_unknown_exit_is_error() -> None:
    assert dispatch_hook._severity_for(0) == "allow"
    assert dispatch_hook._severity_for(1) == "block"
    assert dispatch_hook._severity_for(2) == "warn"
    assert dispatch_hook._severity_for(7) == "error"


def test_reduce_block_dominates_warn_dominates_allow() -> None:
    assert dispatch_hook._reduce([0, 0, 0]) == 0
    assert dispatch_hook._reduce([0, 2, 0]) == 2
    assert dispatch_hook._reduce([0, 2, 1]) == 1
    assert dispatch_hook._reduce([]) == 0


# --- vocabulary ---------------------------------------------------

def test_event_vocabulary_includes_agent_error() -> None:
    """Round 2 Q3 — `agent_error` must stay in the vocabulary."""
    assert "agent_error" in dispatch_hook.EVENT_VOCABULARY
    assert "session_start" in dispatch_hook.EVENT_VOCABULARY



# --- capture --------------------------------------------------------

def test_maybe_capture_payload_writes_when_env_set(
    tmp_path, monkeypatch
) -> None:
    """AGENT_HOOK_CAPTURE_DIR set → raw payload written as JSON."""
    monkeypatch.setenv("AGENT_HOOK_CAPTURE_DIR", str(tmp_path))
    args = argparse.Namespace(
        platform="cursor", event="stop", native_event="stop")
    payload = '{"hook_event_name": "stop", "session_id": "abc"}'
    dispatch_hook._maybe_capture_payload(args, payload)
    files = list(tmp_path.glob("cursor__stop__*.json"))
    assert len(files) == 1, f"expected 1 capture, got {files}"
    import json as _json
    record = _json.loads(files[0].read_text(encoding="utf-8"))
    assert record["platform"] == "cursor"
    assert record["event"] == "stop"
    assert record["native_event"] == "stop"
    assert record["raw_payload"]["session_id"] == "abc"
    assert "captured_at" in record


def test_maybe_capture_payload_silent_without_env(
    tmp_path, monkeypatch
) -> None:
    """No env var → no file written."""
    monkeypatch.delenv("AGENT_HOOK_CAPTURE_DIR", raising=False)
    args = argparse.Namespace(
        platform="cursor", event="stop", native_event="stop")
    dispatch_hook._maybe_capture_payload(args, '{"x": 1}')
    assert list(tmp_path.glob("*.json")) == []


def test_maybe_capture_payload_tolerates_invalid_json(
    tmp_path, monkeypatch
) -> None:
    """Non-JSON stdin still captures as `_raw_text`."""
    monkeypatch.setenv("AGENT_HOOK_CAPTURE_DIR", str(tmp_path))
    args = argparse.Namespace(
        platform="windsurf", event="stop", native_event="post_cascade_response")
    dispatch_hook._maybe_capture_payload(args, "not-json{garbage")
    files = list(tmp_path.glob("windsurf__post_cascade_response__*.json"))
    assert len(files) == 1
    import json as _json
    record = _json.loads(files[0].read_text(encoding="utf-8"))
    assert record["raw_payload"] == {"_raw_text": "not-json{garbage"}


def test_maybe_capture_payload_creates_dir_lazily(
    tmp_path, monkeypatch
) -> None:
    """Capture dir is created on first hit."""
    target = tmp_path / "fresh" / "captures"
    monkeypatch.setenv("AGENT_HOOK_CAPTURE_DIR", str(target))
    args = argparse.Namespace(
        platform="gemini", event="stop", native_event="AfterAgent")
    dispatch_hook._maybe_capture_payload(args, "{}")
    assert target.is_dir()
    assert len(list(target.glob("gemini__AfterAgent__*.json"))) == 1
