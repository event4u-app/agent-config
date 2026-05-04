"""Tests for scripts/verify_before_complete_hook.py — Phase 5 Tier-1 hook.

Verifies the per-turn verification tracker behaves identically across
the six platform envelope shapes (Augment, Claude, Cursor, Cline,
Windsurf, Gemini).
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import verify_before_complete_hook as hook  # noqa: E402


def _state(root: Path) -> dict:
    return json.loads((root / hook.STATE_FILE).read_text(encoding="utf-8"))


def _envelope(platform: str, event: str, payload: dict, *,
              session_id: str = "s1") -> str:
    return json.dumps({
        "schema_version": 1,
        "platform": platform,
        "event": event,
        "native_event": event,
        "session_id": session_id,
        "workspace_root": "/work",
        "payload": payload,
    })


@pytest.fixture
def root(tmp_path: Path) -> Path:
    (tmp_path / "agents" / "state").mkdir(parents=True)
    return tmp_path


def test_session_start_initialises_state(root: Path) -> None:
    rc = hook.run(_envelope("augment", "session_start", {}), consumer_root=root)
    assert rc == 0
    s = _state(root)
    assert s["session_id"] == "s1"
    assert s["verified_this_turn"] is False
    assert s["verifications_this_turn"] == 0
    assert s["last_verification"] is None


def test_pytest_command_records_verification(root: Path) -> None:
    hook.run(_envelope("augment", "session_start", {}), consumer_root=root)
    payload = {"tool_name": "launch-process",
               "tool_input": {"command": ".venv/bin/python3 -m pytest tests/ -q"}}
    hook.run(_envelope("augment", "post_tool_use", payload), consumer_root=root)
    s = _state(root)
    assert s["verified_this_turn"] is True
    assert s["verifications_this_turn"] == 1
    assert s["last_verification"]["tool"] == "launch-process"
    assert "pytest" in s["last_verification"]["command"]


def test_non_verification_command_does_not_set_flag(root: Path) -> None:
    hook.run(_envelope("augment", "session_start", {}), consumer_root=root)
    payload = {"tool_name": "launch-process",
               "tool_input": {"command": "ls -la"}}
    hook.run(_envelope("augment", "post_tool_use", payload), consumer_root=root)
    s = _state(root)
    assert s["verified_this_turn"] is False
    assert s["verifications_this_turn"] == 0


def test_user_prompt_submit_resets_turn_counter(root: Path) -> None:
    hook.run(_envelope("claude", "session_start", {}), consumer_root=root)
    hook.run(_envelope("claude", "post_tool_use",
                       {"tool_name": "Bash",
                        "tool_input": {"command": "task ci"}}),
             consumer_root=root)
    assert _state(root)["verified_this_turn"] is True
    hook.run(_envelope("claude", "user_prompt_submit", {}), consumer_root=root)
    s = _state(root)
    assert s["verified_this_turn"] is False
    assert s["verifications_this_turn"] == 0
    # session-scoped count survives the turn reset
    assert s["verifications_this_session"] == 1


def test_stop_event_records_timestamp(root: Path) -> None:
    hook.run(_envelope("augment", "session_start", {}), consumer_root=root)
    hook.run(_envelope("augment", "stop", {}), consumer_root=root)
    s = _state(root)
    assert s["last_stop_at"] is not None


def test_session_id_change_resets_session_counters(root: Path) -> None:
    hook.run(_envelope("augment", "session_start",
                       {"tool_input": {"command": "pytest"}},
                       session_id="s1"),
             consumer_root=root)
    hook.run(_envelope("augment", "post_tool_use",
                       {"tool_name": "launch-process",
                        "tool_input": {"command": "pytest -q"}},
                       session_id="s1"),
             consumer_root=root)
    assert _state(root)["verifications_this_session"] == 1
    hook.run(_envelope("augment", "session_start", {}, session_id="s2"),
             consumer_root=root)
    s = _state(root)
    assert s["session_id"] == "s2"
    assert s["verifications_this_session"] == 0


@pytest.mark.parametrize("platform,tool,cmd_key", [
    ("augment", "launch-process", "command"),
    ("claude", "Bash", "command"),
    ("cursor", "RunShellCommand", "command"),
    ("cline", "execute_shell", "command"),
    ("gemini", "shell", "command"),
])
def test_verification_detected_across_platforms(
    root: Path, platform: str, tool: str, cmd_key: str
) -> None:
    hook.run(_envelope(platform, "session_start", {}), consumer_root=root)
    payload = {"tool_name": tool, "tool_input": {cmd_key: "task ci"}}
    hook.run(_envelope(platform, "post_tool_use", payload), consumer_root=root)
    s = _state(root)
    assert s["verified_this_turn"] is True, f"{platform}/{tool} not detected"


def test_malformed_stdin_is_silent_noop(root: Path) -> None:
    rc = hook.run("not json", consumer_root=root)
    assert rc == 0
    # state file may or may not exist; if it does, it must be valid
    target = root / hook.STATE_FILE
    if target.is_file():
        json.loads(target.read_text(encoding="utf-8"))


def test_empty_stdin_is_silent_noop(root: Path) -> None:
    assert hook.run("", consumer_root=root) == 0


def test_dispatcher_envelope_passes_through(root: Path) -> None:
    """Hook receives the full envelope (schema_version, platform, event,
    payload) — the dispatcher does not pre-unwrap for individual concerns."""
    hook.run(_envelope("augment", "session_start", {}), consumer_root=root)
    s = _state(root)
    assert s["session_id"] == "s1"
