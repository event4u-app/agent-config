"""Tests for scripts/minimal_safe_diff_hook.py — Phase 5 Tier-1 hook.

Verifies the per-turn diff-size tracker behaves identically across the
six platform envelope shapes (Augment, Claude, Cursor, Cline, Windsurf,
Gemini) and reads the threshold from .agent-settings.yml.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import minimal_safe_diff_hook as hook  # noqa: E402


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


def _edit(root: Path, path: str, *, platform: str = "augment",
          tool: str = "str-replace-editor", event: str = "post_tool_use") -> None:
    payload = {"tool_name": tool, "tool_input": {"path": path}}
    hook.run(_envelope(platform, event, payload), consumer_root=root)


def test_default_threshold_when_settings_missing(root: Path) -> None:
    hook.run(_envelope("augment", "session_start", {}), consumer_root=root)
    s = _state(root)
    assert s["threshold"] == hook.DEFAULT_THRESHOLD
    assert s["count"] == 0
    assert s["warning"] is False


def test_files_below_threshold_no_warning(root: Path) -> None:
    hook.run(_envelope("augment", "session_start", {}), consumer_root=root)
    for i in range(hook.DEFAULT_THRESHOLD):
        _edit(root, f"src/f{i}.py")
    s = _state(root)
    assert s["count"] == hook.DEFAULT_THRESHOLD
    assert s["warning"] is False


def test_files_above_threshold_warns(root: Path) -> None:
    hook.run(_envelope("augment", "session_start", {}), consumer_root=root)
    for i in range(hook.DEFAULT_THRESHOLD + 1):
        _edit(root, f"src/f{i}.py")
    s = _state(root)
    assert s["count"] == hook.DEFAULT_THRESHOLD + 1
    assert s["warning"] is True


def test_duplicate_paths_do_not_double_count(root: Path) -> None:
    hook.run(_envelope("augment", "session_start", {}), consumer_root=root)
    _edit(root, "src/a.py")
    _edit(root, "src/a.py")
    _edit(root, "./src/a.py")  # normalisation strips leading ./
    s = _state(root)
    assert s["count"] == 1


def test_user_prompt_submit_resets_turn(root: Path) -> None:
    hook.run(_envelope("claude", "session_start", {}), consumer_root=root)
    for i in range(3):
        _edit(root, f"src/f{i}.py", platform="claude", tool="Edit")
    assert _state(root)["count"] == 3
    hook.run(_envelope("claude", "user_prompt_submit", {}), consumer_root=root)
    s = _state(root)
    assert s["count"] == 0
    assert s["files_touched_this_turn"] == []
    assert s["warning"] is False


def test_threshold_read_from_settings(root: Path) -> None:
    (root / ".agent-settings.yml").write_text(
        "hooks:\n  minimal_safe_diff:\n    threshold: 2\n",
        encoding="utf-8",
    )
    hook.run(_envelope("augment", "session_start", {}), consumer_root=root)
    for i in range(3):
        _edit(root, f"src/f{i}.py")
    s = _state(root)
    assert s["threshold"] == 2
    assert s["warning"] is True


def test_invalid_threshold_falls_back_to_default(root: Path) -> None:
    (root / ".agent-settings.yml").write_text(
        "hooks:\n  minimal_safe_diff:\n    threshold: 0\n",
        encoding="utf-8",
    )
    hook.run(_envelope("augment", "session_start", {}), consumer_root=root)
    assert _state(root)["threshold"] == hook.DEFAULT_THRESHOLD


def test_non_edit_tool_ignored(root: Path) -> None:
    hook.run(_envelope("augment", "session_start", {}), consumer_root=root)
    payload = {"tool_name": "view", "tool_input": {"path": "src/a.py"}}
    hook.run(_envelope("augment", "post_tool_use", payload), consumer_root=root)
    assert _state(root)["count"] == 0


@pytest.mark.parametrize("platform,tool,event", [
    ("augment", "str-replace-editor", "post_tool_use"),
    ("augment", "save-file", "post_tool_use"),
    ("claude", "Edit", "post_tool_use"),
    ("claude", "Write", "post_tool_use"),
    ("claude", "MultiEdit", "post_tool_use"),
    ("cursor", "edit_file", "post_tool_use"),
    ("cline", "edit_file", "post_tool_use"),
    ("gemini", "Edit", "post_tool_use"),
])
def test_edit_tools_detected_across_platforms(
    root: Path, platform: str, tool: str, event: str
) -> None:
    hook.run(_envelope(platform, "session_start", {}), consumer_root=root)
    _edit(root, "src/f.py", platform=platform, tool=tool, event=event)
    assert _state(root)["count"] == 1


def test_malformed_stdin_is_silent_noop(root: Path) -> None:
    assert hook.run("not json", consumer_root=root) == 0


def test_session_id_change_resets_state(root: Path) -> None:
    hook.run(_envelope("augment", "session_start", {}, session_id="s1"),
             consumer_root=root)
    _edit(root, "src/a.py")
    assert _state(root)["count"] == 1
    hook.run(_envelope("augment", "session_start", {}, session_id="s2"),
             consumer_root=root)
    s = _state(root)
    assert s["session_id"] == "s2"
    assert s["count"] == 0
