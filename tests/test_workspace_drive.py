"""Tests for ``src/cli/python/workspace_drive.py`` (ADR-070 Tier-1 drive loop).

v0: single-turn, claude-code only. Tests run against an injected ``runner`` —
never a real host CLI. One opt-in contract test exercises the real ``claude``
binary when present (skipped otherwise) to catch envelope-schema drift.
"""
from __future__ import annotations

import importlib.util
import json
import shutil
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = REPO_ROOT / "src" / "cli" / "python" / "workspace_drive.py"


def _load():
    spec = importlib.util.spec_from_file_location("workspace_drive", MODULE_PATH)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules["workspace_drive"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture
def wd():
    return _load()


def _ok_envelope(result="The answer.", **extra) -> str:
    env = {"type": "result", "is_error": False, "result": result,
           "session_id": "sess-1", "total_cost_usd": 0.01, "num_turns": 1,
           "usage": {"input_tokens": 12, "output_tokens": 34}}
    env.update(extra)
    return json.dumps(env)


def _runner(rc=0, stdout="", stderr=""):
    def run(args, cwd, timeout):
        return rc, stdout, stderr
    return run


def test_drive_success_maps_uniform_turn(wd):
    turn = wd.drive("claude-code", "Say ok.", runner=_runner(0, _ok_envelope()))
    assert turn["ok"] is True
    assert turn["host"] == "claude-code"
    assert turn["text"] == "The answer."
    assert turn["session_id"] == "sess-1"
    assert turn["usage"]["output_tokens"] == 34
    assert turn["cost_usd"] == 0.01
    assert turn["tool_calls"] == []


def test_drive_records_tool_calls_opaque(wd):
    env = _ok_envelope(tool_calls=[{"name": "read_file", "args": {"p": "x"}}])
    turn = wd.drive("claude-code", "go", runner=_runner(0, env))
    assert turn["ok"] is True
    assert turn["tool_calls"][0]["name"] == "read_file"     # recorded, not executed


def test_drive_is_error_fails_closed(wd):
    env = json.dumps({"is_error": True, "result": "model refused"})
    turn = wd.drive("claude-code", "go", runner=_runner(0, env))
    assert turn["ok"] is False
    assert turn["error_kind"] == "bad-envelope"


def test_drive_missing_result_fails_closed(wd):
    env = json.dumps({"is_error": False, "session_id": "s"})
    turn = wd.drive("claude-code", "go", runner=_runner(0, env))
    assert turn["ok"] is False
    assert turn["error_kind"] == "bad-envelope"
    assert "result" in turn["error"]


def test_drive_garbage_stdout_fails_closed(wd):
    turn = wd.drive("claude-code", "go", runner=_runner(0, "not json at all"))
    assert turn["ok"] is False
    assert turn["error_kind"] == "bad-envelope"


def test_drive_nonzero_exit(wd):
    turn = wd.drive("claude-code", "go", runner=_runner(2, "", "boom"))
    assert turn["ok"] is False
    assert turn["error_kind"] == "nonzero-exit"
    assert "boom" in turn["error"]


def test_drive_timeout(wd):
    def run(args, cwd, timeout):
        raise subprocess.TimeoutExpired(cmd=args, timeout=timeout)
    turn = wd.drive("claude-code", "go", runner=run, timeout=5)
    assert turn["ok"] is False
    assert turn["error_kind"] == "timeout"
    assert "5s" in turn["error"]


def test_drive_cli_missing(wd):
    def run(args, cwd, timeout):
        raise FileNotFoundError(args[0])
    turn = wd.drive("claude-code", "go", runner=run)
    assert turn["ok"] is False
    assert turn["error_kind"] == "cli-missing"


def test_drive_unsupported_host(wd):
    # codex / gemini are Tier-1 but not wired in v0; Tier-3 hosts never drive.
    for host in ("codex", "gemini", "augment", "nonsense"):
        turn = wd.drive(host, "go", runner=_runner(0, _ok_envelope()))
        assert turn["ok"] is False
        assert turn["error_kind"] == "unsupported-host"


def test_drive_empty_prompt(wd):
    turn = wd.drive("claude-code", "   ", runner=_runner(0, _ok_envelope()))
    assert turn["ok"] is False
    assert turn["error_kind"] == "empty-prompt"


def test_default_timeout_is_90(wd):
    assert wd.DEFAULT_TIMEOUT == 90


# --- CLI -------------------------------------------------------------------

def test_cli_drive_json(wd, tmp_path, capsys, monkeypatch):
    monkeypatch.setattr(wd, "_subprocess_runner", _runner(0, _ok_envelope("CLI text")))
    pf = tmp_path / "p.md"
    pf.write_text("Render me.", encoding="utf-8")
    rc = wd.main(["drive", "--host", "claude-code", "--prompt-file", str(pf), "--json"])
    assert rc == 0
    out = json.loads(capsys.readouterr().out)
    assert out["ok"] is True and out["text"] == "CLI text"


def test_cli_drive_failure_exits_1(wd, tmp_path, capsys, monkeypatch):
    monkeypatch.setattr(wd, "_subprocess_runner", _runner(1, "", "nope"))
    pf = tmp_path / "p.md"
    pf.write_text("go", encoding="utf-8")
    rc = wd.main(["drive", "--host", "claude-code", "--prompt-file", str(pf)])
    assert rc == 1
    assert "nonzero-exit" in capsys.readouterr().err


# --- opt-in contract test against the real claude CLI ----------------------

@pytest.mark.skipif(shutil.which("claude") is None, reason="claude CLI not installed")
def test_contract_real_claude_envelope_has_result(wd):
    """Catches Anthropic-side envelope-schema drift (e.g. `result` renamed).

    Only runs where `claude` is on PATH; the assertion is intentionally narrow
    — a real call costs money, so we ask for the shortest possible reply.
    """
    turn = wd.drive("claude-code", "Reply with the single word: ok", timeout=60)
    # Either it drove successfully (envelope had `result`) or it failed for an
    # operational reason (no auth / rate limit) — but NOT because the contract
    # key vanished. A bad-envelope here is the drift signal we want to catch.
    if not turn["ok"]:
        assert turn["error_kind"] != "bad-envelope", f"envelope drift: {turn['error']}"
    else:
        assert isinstance(turn["text"], str)
