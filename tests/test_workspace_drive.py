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
    # Tier-3 hosts (and unknown ids) never drive; the three Tier-1 hosts do.
    for host in ("augment", "cursor", "nonsense"):
        turn = wd.drive(host, "go", runner=_runner(0, _ok_envelope()))
        assert turn["ok"] is False
        assert turn["error_kind"] == "unsupported-host"


# --- codex (NDJSON event stream) -------------------------------------------

def _codex_stream(text="Codex reply.", sid="cx-1", in_tok=10, out_tok=20):
    return "\n".join([
        json.dumps({"type": "session.created", "session_id": sid}),
        json.dumps({"type": "item.completed", "item": {"id": "i1", "content": [{"text": text}]}}),
        json.dumps({"type": "turn.completed", "usage": {"input_tokens": in_tok, "output_tokens": out_tok}}),
    ])


def test_drive_codex_ndjson(wd):
    turn = wd.drive("codex", "go", runner=_runner(0, _codex_stream()))
    assert turn["ok"] is True and turn["host"] == "codex"
    assert turn["text"] == "Codex reply."
    assert turn["session_id"] == "cx-1"
    assert turn["usage"] == {"input_tokens": 10, "output_tokens": 20}


def test_drive_codex_skips_unknown_events_and_order(wd):
    stream = "\n".join([
        json.dumps({"type": "turn.completed", "usage": {"input_tokens": 1, "output_tokens": 2}}),
        "not json — skipped",
        json.dumps({"type": "mystery.event", "x": 1}),
        json.dumps({"type": "item.completed", "item": {"content": [{"text": "late text"}]}}),
    ])
    turn = wd.drive("codex", "go", runner=_runner(0, stream))
    assert turn["ok"] is True and turn["text"] == "late text"


def test_drive_codex_no_text_fails_closed(wd):
    stream = json.dumps({"type": "turn.completed", "usage": {"input_tokens": 1, "output_tokens": 2}})
    turn = wd.drive("codex", "go", runner=_runner(0, stream))
    assert turn["ok"] is False and turn["error_kind"] == "bad-envelope"


# --- gemini (single JSON, nested stats) ------------------------------------

def _gemini_env(response="Gemini reply.", sid="gm-1"):
    return json.dumps({
        "session_id": sid, "response": response,
        "stats": {"models": {"gemini-3-flash-preview": {
            "tokens": {"input": 100, "prompt": 100, "total": 130, "candidates": 1}}}},
    })


def test_drive_gemini_json(wd):
    turn = wd.drive("gemini", "go", runner=_runner(0, _gemini_env()))
    assert turn["ok"] is True and turn["host"] == "gemini"
    assert turn["text"] == "Gemini reply."
    assert turn["session_id"] == "gm-1"
    assert turn["model"] == "gemini-3-flash-preview"
    assert turn["usage"] == {"input_tokens": 100, "output_tokens": 30}


def test_drive_gemini_missing_response_fails_closed(wd):
    env = json.dumps({"session_id": "x", "stats": {}})
    turn = wd.drive("gemini", "go", runner=_runner(0, env))
    assert turn["ok"] is False and turn["error_kind"] == "bad-envelope"


def test_drive_gemini_tolerates_missing_stats(wd):
    env = json.dumps({"session_id": "x", "response": "ok"})
    turn = wd.drive("gemini", "go", runner=_runner(0, env))
    assert turn["ok"] is True and turn["text"] == "ok"
    assert turn["usage"] is None and turn["model"] is None


def test_drive_empty_prompt(wd):
    turn = wd.drive("claude-code", "   ", runner=_runner(0, _ok_envelope()))
    assert turn["ok"] is False
    assert turn["error_kind"] == "empty-prompt"


def test_default_timeout_is_90(wd):
    assert wd.DEFAULT_TIMEOUT == 90


# --- resume / multi-turn continuation (ADR-076) ----------------------------

def _capturing_runner(stdout):
    seen = {}

    def run(args, cwd, timeout):
        seen["args"] = args
        return 0, stdout, ""
    return run, seen


def test_resume_uses_host_resume_invocation(wd):
    run, seen = _capturing_runner(_ok_envelope("resumed reply"))
    turn = wd.drive("claude-code", "make it shorter", resume_session_id="sess-1", runner=run)
    assert turn["ok"] is True and turn["text"] == "resumed reply"
    # claude resume: claude --resume <id> -p <prompt> --output-format json
    assert seen["args"][:3] == ["claude", "--resume", "sess-1"]
    assert "make it shorter" in seen["args"]


def test_resume_codex_arg_order(wd):
    run, seen = _capturing_runner(_codex_stream("ok"))
    wd.drive("codex", "follow up", resume_session_id="cx-1", runner=run)
    assert seen["args"][:4] == ["codex", "exec", "resume", "cx-1"]


def test_resume_gemini_arg_order(wd):
    run, seen = _capturing_runner(_gemini_env("ok"))
    wd.drive("gemini", "follow up", resume_session_id="gm-1", runner=run)
    assert seen["args"][:3] == ["gemini", "--resume", "gm-1"]


def test_fresh_launch_does_not_use_resume_args(wd):
    run, seen = _capturing_runner(_ok_envelope())
    wd.drive("claude-code", "first turn", runner=run)
    assert "--resume" not in seen["args"]


def test_cli_resume_flag(wd, tmp_path, capsys, monkeypatch):
    captured = {}

    def run(args, cwd, timeout):
        captured["args"] = args
        return 0, _ok_envelope("cli resumed"), ""
    monkeypatch.setattr(wd, "_subprocess_runner", run)
    pf = tmp_path / "p.md"
    pf.write_text("again", encoding="utf-8")
    rc = wd.main(["drive", "--host", "claude-code", "--prompt-file", str(pf),
                  "--resume-session-id", "sess-9", "--json"])
    assert rc == 0
    assert "sess-9" in captured["args"]
    assert json.loads(capsys.readouterr().out)["text"] == "cli resumed"


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


@pytest.mark.skipif(shutil.which("codex") is None, reason="codex CLI not installed")
def test_contract_real_codex_envelope_has_item_text(wd):
    """Catches codex NDJSON drift (item.completed / turn.completed renamed)."""
    turn = wd.drive("codex", "Reply with the single word: ok", timeout=90)
    if not turn["ok"]:
        assert turn["error_kind"] != "bad-envelope", f"envelope drift: {turn['error']}"
    else:
        assert isinstance(turn["text"], str)


@pytest.mark.skipif(shutil.which("gemini") is None, reason="gemini CLI not installed")
def test_contract_real_gemini_envelope_has_response(wd):
    """Catches gemini drift (the `response` key renamed)."""
    turn = wd.drive("gemini", "Reply with the single word: ok", timeout=90)
    if not turn["ok"]:
        assert turn["error_kind"] != "bad-envelope", f"envelope drift: {turn['error']}"
    else:
        assert isinstance(turn["text"], str)
