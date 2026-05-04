"""Tests for scripts/context_hygiene_hook.py — per-turn tracker hook."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import context_hygiene_hook as hook  # noqa: E402


def _state(root: Path) -> dict:
    return json.loads((root / hook.STATE_FILE).read_text(encoding="utf-8"))


def _fire(root: Path, tool: str | None) -> int:
    payload = "" if tool is None else json.dumps({"tool_name": tool})
    return hook.run(payload, consumer_root=root)


def test_first_call_initialises_state(tmp_path: Path):
    assert _fire(tmp_path, "view") == 0
    s = _state(tmp_path)
    assert s["tool_calls"] == 1
    assert s["consecutive_same_tool"] == 1
    assert s["last_tool"] == "view"
    assert s["tool_history"] == ["view"]
    assert s["loop_detected"] is False
    assert s["freshness_threshold"] is None


def test_three_same_tools_in_a_row_flags_loop(tmp_path: Path):
    for _ in range(3):
        _fire(tmp_path, "view")
    s = _state(tmp_path)
    assert s["consecutive_same_tool"] == 3
    assert s["loop_detected"] is True
    assert s["tool_calls"] == 3


def test_different_tool_resets_consecutive_count(tmp_path: Path):
    for _ in range(3):
        _fire(tmp_path, "view")
    _fire(tmp_path, "edit")
    s = _state(tmp_path)
    assert s["consecutive_same_tool"] == 1
    assert s["loop_detected"] is False
    assert s["last_tool"] == "edit"


def test_tool_history_is_capped_at_5(tmp_path: Path):
    for tool in ("a", "b", "c", "d", "e", "f", "g"):
        _fire(tmp_path, tool)
    s = _state(tmp_path)
    assert s["tool_history"] == ["c", "d", "e", "f", "g"]


def test_freshness_threshold_at_20(tmp_path: Path):
    for i in range(19):
        _fire(tmp_path, f"t{i}")
    s = _state(tmp_path)
    assert s["tool_calls"] == 19
    assert s["freshness_threshold"] is None

    _fire(tmp_path, "t19")
    s = _state(tmp_path)
    assert s["tool_calls"] == 20
    assert s["freshness_threshold"] == 20


def test_freshness_threshold_advances_to_40(tmp_path: Path):
    for i in range(40):
        _fire(tmp_path, f"t{i}")
    s = _state(tmp_path)
    assert s["tool_calls"] == 40
    assert s["freshness_threshold"] == 40


def test_freshness_threshold_not_overwritten_between_milestones(tmp_path: Path):
    for i in range(25):
        _fire(tmp_path, f"t{i}")
    # We hit 20, then 5 more turns without a milestone → 20 sticks.
    assert _state(tmp_path)["freshness_threshold"] == 20


def test_corrupt_state_file_recovers(tmp_path: Path):
    state_dir = tmp_path / hook.STATE_DIR
    state_dir.mkdir(parents=True)
    (tmp_path / hook.STATE_FILE).write_text("not-json", encoding="utf-8")
    assert _fire(tmp_path, "view") == 0
    s = _state(tmp_path)
    assert s["tool_calls"] == 1
    assert s["last_tool"] == "view"


def test_payload_without_tool_name_still_writes_state(tmp_path: Path):
    assert hook.run('{"foo": "bar"}', consumer_root=tmp_path) == 0
    s = _state(tmp_path)
    assert s["tool_calls"] == 0
    assert "checked_at" in s


def test_empty_payload_still_writes_state(tmp_path: Path):
    assert hook.run("", consumer_root=tmp_path) == 0
    s = _state(tmp_path)
    assert s["tool_calls"] == 0
    assert s["last_tool"] is None


def test_invalid_json_payload_does_not_crash(tmp_path: Path):
    assert hook.run("{not json", consumer_root=tmp_path) == 0
    s = _state(tmp_path)
    assert s["tool_calls"] == 0


def test_alt_payload_keys(tmp_path: Path):
    # Some platforms emit toolName / tool instead of tool_name.
    hook.run(json.dumps({"toolName": "ToolA"}), consumer_root=tmp_path)
    hook.run(json.dumps({"tool": "ToolB"}), consumer_root=tmp_path)
    s = _state(tmp_path)
    assert s["tool_calls"] == 2
    assert s["tool_history"] == ["ToolA", "ToolB"]


def test_atomic_write_does_not_leave_tmp(tmp_path: Path):
    _fire(tmp_path, "view")
    state_dir = tmp_path / hook.STATE_DIR
    leftovers = [p.name for p in state_dir.iterdir()
                 if p.name.endswith(".tmp")]
    assert leftovers == []


def test_main_reads_stdin(tmp_path: Path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    import io
    monkeypatch.setattr("sys.stdin",
                        io.StringIO('{"tool_name": "view"}'))
    assert hook.main(["--platform", "augment"]) == 0
    s = _state(tmp_path)
    assert s["tool_calls"] == 1
    assert s["last_tool"] == "view"
