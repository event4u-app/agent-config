"""Subprocess smoke tests for the chat_history.py CLI (Schema v4).

Library behaviour is covered exhaustively by tests/test_chat_history.py;
this suite invokes the CLI through python3 -m so we catch argparse
regressions, exit-code drift, and stdout-shape changes that the library
tests cannot see.

Each test points ``AGENT_CHAT_HISTORY_FILE`` at a tmp_path and parses
the subprocess JSON stdout — never writes to the project's real history.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
CLI = REPO_ROOT / "scripts" / "chat_history.py"


def _run(*args: str, hist: Path, stdin: str | None = None,
         env_extra: dict[str, str] | None = None) -> subprocess.CompletedProcess:
    env = os.environ.copy()
    env["AGENT_CHAT_HISTORY_FILE"] = str(hist)
    if env_extra:
        env.update(env_extra)
    return subprocess.run(
        [sys.executable, str(CLI), *args],
        input=stdin,
        capture_output=True,
        text=True,
        env=env,
        timeout=10,
    )


@pytest.fixture
def hist(tmp_path: Path) -> Path:
    return tmp_path / "chat_history.jsonl"


@pytest.fixture
def settings_enabled(tmp_path: Path) -> Path:
    p = tmp_path / "agent-settings.yml"
    p.write_text(
        "chat_history:\n  enabled: true\n  frequency: per_phase\n",
        encoding="utf-8",
    )
    return p


def test_cli_init_writes_v4_header(hist: Path):
    res = _run("init", hist=hist)
    assert res.returncode == 0, res.stderr
    header = json.loads(res.stdout)
    assert header["v"] == 4
    assert header["t"] == "header"
    assert header["freq"] == "per_phase"


def test_cli_init_with_freq(hist: Path):
    res = _run("init", "--freq", "per_turn", hist=hist)
    assert res.returncode == 0
    assert json.loads(res.stdout)["freq"] == "per_turn"


def test_cli_status(hist: Path):
    _run("init", hist=hist)
    res = _run("status", hist=hist)
    assert res.returncode == 0
    s = json.loads(res.stdout)
    assert s["entries"] == 0
    assert s["header"]["v"] == 4


def test_cli_append_and_read(hist: Path):
    _run("init", hist=hist)
    res = _run("append",
               "--json", json.dumps({"t": "user", "text": "hello"}),
               "--session-id", "sess-A",
               hist=hist)
    assert res.returncode == 0, res.stderr
    res = _run("read", "--last", "5", hist=hist)
    assert res.returncode == 0
    entries = json.loads(res.stdout)
    assert len(entries) == 1
    assert entries[0]["text"] == "hello"
    # session tag is the sha256 prefix of "sess-A"
    assert len(entries[0]["s"]) == 16


def test_cli_append_missing_type_returns_bad_args(hist: Path):
    _run("init", hist=hist)
    res = _run("append", "--json", json.dumps({"text": "x"}), hist=hist)
    assert res.returncode != 0
    assert "type" in res.stderr.lower()


def test_cli_read_all_and_session_filter(hist: Path):
    _run("init", hist=hist)
    _run("append", "--json", json.dumps({"t": "user", "text": "a"}),
         "--session-id", "S1", hist=hist)
    _run("append", "--json", json.dumps({"t": "user", "text": "b"}),
         "--session-id", "S2", hist=hist)
    res_all = _run("read", "--all", hist=hist)
    assert len(json.loads(res_all.stdout)) == 2
    res_default = _run("read", "--last", "5", hist=hist)
    # Default = current session = last appended (S2).
    entries = json.loads(res_default.stdout)
    assert [e["text"] for e in entries] == ["b"]


def test_cli_sessions_table_and_json(hist: Path):
    _run("init", hist=hist)
    _run("append", "--json", json.dumps({"t": "user", "text": "x"}),
         "--session-id", "S1", hist=hist)
    res_table = _run("sessions", hist=hist)
    assert res_table.returncode == 0
    assert "ID" in res_table.stdout
    assert "COUNT" in res_table.stdout
    res_json = _run("sessions", "--json", hist=hist)
    sessions = json.loads(res_json.stdout)
    assert len(sessions) == 1
    assert sessions[0]["count"] == 1


def test_cli_sessions_empty(hist: Path):
    _run("init", hist=hist)
    res = _run("sessions", hist=hist)
    assert res.returncode == 0
    assert "(no sessions)" in res.stdout



def test_cli_prepend_via_json(hist: Path):
    _run("init", hist=hist)
    _run("append", "--json", json.dumps({"t": "user", "text": "second"}),
         hist=hist)
    res = _run(
        "prepend",
        "--entries-json",
        json.dumps([{"t": "user", "text": "first"}]),
        hist=hist,
    )
    assert res.returncode == 0
    assert json.loads(res.stdout) == {"prepended": 1}
    res_all = _run("read", "--all", hist=hist)
    assert [e["text"] for e in json.loads(res_all.stdout)] == ["first", "second"]


def test_cli_prepend_via_stdin(hist: Path):
    _run("init", hist=hist)
    payload = json.dumps([{"t": "user", "text": "x"}])
    res = _run("prepend", "--entries-stdin", hist=hist, stdin=payload)
    assert res.returncode == 0
    assert json.loads(res.stdout)["prepended"] == 1


def test_cli_reset_replaces_body(hist: Path):
    _run("init", hist=hist)
    _run("append", "--json", json.dumps({"t": "user", "text": "old"}),
         hist=hist)
    new_entries = json.dumps([
        {"t": "user", "text": "new1"},
        {"t": "agent", "text": "new2"},
    ])
    res = _run("reset", "--entries-json", new_entries, hist=hist)
    assert res.returncode == 0
    assert json.loads(res.stdout)["v"] == 4
    out = _run("read", "--all", hist=hist)
    texts = [e["text"] for e in json.loads(out.stdout)]
    assert texts == ["new1", "new2"]


def test_cli_clear_removes_file(hist: Path):
    _run("init", hist=hist)
    assert hist.is_file()
    res = _run("clear", hist=hist)
    assert res.returncode == 0
    assert not hist.is_file()


def test_cli_prune_sessions_explicit_max(hist: Path):
    _run("init", hist=hist)
    for sid in ("A", "B", "C", "D"):
        _run("append",
             "--json", json.dumps({"t": "user", "text": sid}),
             "--session-id", f"sess-{sid}",
             hist=hist)
    res = _run("prune-sessions", "--max-sessions", "2", hist=hist)
    assert res.returncode == 0
    out = json.loads(res.stdout)
    assert out["action"] == "pruned"
    assert out["kept_sessions"] == 2
    surviving = [e["text"] for e in json.loads(
        _run("read", "--all", hist=hist).stdout)]
    assert surviving == ["C", "D"]


def test_cli_rotate_invalid_mode_returns_nonzero(hist: Path):
    _run("init", hist=hist)
    res = _run("rotate", "--max-kb", "1", "--mode", "nope", hist=hist)
    assert res.returncode != 0  # argparse rejects bad choice


def test_cli_rotate_noop_under_budget(hist: Path):
    _run("init", hist=hist)
    res = _run("rotate", "--max-kb", "1024", hist=hist)
    assert res.returncode == 0
    assert json.loads(res.stdout)["action"] == "noop"


def test_cli_hook_append_user_prompt(
    hist: Path, settings_enabled: Path,
):
    res = _run(
        "hook-append",
        "--event", "user_prompt",
        "--session-id", "sess-1",
        "--payload", json.dumps({"text": "hi"}),
        "--settings", str(settings_enabled),
        hist=hist,
    )
    assert res.returncode == 0, res.stderr
    out = json.loads(res.stdout)
    assert out["action"] == "appended"
    assert out["type"] == "user"


def test_cli_hook_append_invalid_payload_returns_bad_args(
    hist: Path, settings_enabled: Path,
):
    res = _run(
        "hook-append",
        "--event", "user_prompt",
        "--session-id", "x",
        "--payload", "{not json",
        "--settings", str(settings_enabled),
        hist=hist,
    )
    assert res.returncode != 0
    assert "JSON" in res.stderr or "json" in res.stderr


def test_cli_hook_dispatch_claude_user_prompt(
    hist: Path, settings_enabled: Path,
):
    payload = {
        "hook_event_name": "UserPromptSubmit",
        "session_id": "claude-xyz",
        "prompt": "ping",
    }
    res = _run(
        "hook-dispatch",
        "--platform", "claude",
        "--settings", str(settings_enabled),
        hist=hist,
        stdin=json.dumps(payload),
    )
    assert res.returncode == 0, res.stderr
    out = json.loads(res.stdout)
    assert out["action"] == "appended"
    assert out["type"] == "user"


def test_cli_hook_dispatch_invalid_stdin_returns_bad_args(
    hist: Path, settings_enabled: Path,
):
    res = _run(
        "hook-dispatch",
        "--platform", "claude",
        "--settings", str(settings_enabled),
        hist=hist,
        stdin="not json at all",
    )
    # Invalid JSON on stdin → ValueError → EXIT_BAD_ARGS
    assert res.returncode != 0
