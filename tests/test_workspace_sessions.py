"""Tests for ``packages/core/installer/python/workspace_sessions.py``.

Covers ``docs/contracts/daily-workspace.md`` §Session JSONL schema:

* ``start`` creates a JSONL with the opening ``launcher.input`` record
* ``append`` rejects unknown kinds, appends one record per call
* ``read`` reconstructs the event stream, tolerates blank lines
* ``list_sessions`` returns most-recent first with role+task metadata
* CLI round-trip via ``python -m`` subprocess
"""

from __future__ import annotations

import importlib.util
import json
import subprocess
import sys
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = REPO_ROOT / "packages" / "core" / "installer" / "python" / "workspace_sessions.py"


def _load():
    spec = importlib.util.spec_from_file_location("workspace_sessions", MODULE_PATH)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules["workspace_sessions"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture
def ws(tmp_path, monkeypatch):
    mod = _load()
    monkeypatch.setattr(mod, "WORKSPACE_HOME", tmp_path / "sessions")
    return mod


def test_start_writes_opening_launcher_input(ws, tmp_path):
    sid = ws.start("galabau", "offer-spring-cleanup")
    records = ws.read(sid)
    assert len(records) == 1
    rec = records[0]
    assert rec["kind"] == "launcher.input"
    assert rec["data"] == {"role": "galabau", "task": "offer-spring-cleanup"}
    assert rec["ts"].endswith("Z")


def test_append_rejects_unknown_kind(ws):
    sid = ws.start("galabau", "memo")
    assert ws.append(sid, "not.an.event", {"x": 1}) is False
    assert len(ws.read(sid)) == 1


def test_append_accepts_allowed_kinds(ws):
    sid = ws.start("galabau", "memo")
    for kind in ("host.turn", "host.output", "explain.rendered"):
        assert ws.append(sid, kind, {"k": kind}) is True
    records = ws.read(sid)
    assert [r["kind"] for r in records] == [
        "launcher.input", "host.turn", "host.output", "explain.rendered",
    ]


def test_append_missing_session_returns_false(ws):
    assert ws.append("nonexistent-id", "host.turn", {}) is False


def test_read_tolerates_blank_and_malformed_lines(ws):
    sid = ws.start("galabau", "memo")
    p = ws._session_path(sid)
    p.write_text(
        p.read_text(encoding="utf-8") + "\n\nnot-json\n"
        + json.dumps({"ts": "2025-01-01T00:00:00Z", "kind": "host.turn", "data": {}}) + "\n",
        encoding="utf-8",
    )
    records = ws.read(sid)
    assert len(records) == 2
    assert records[-1]["kind"] == "host.turn"


def test_list_sessions_orders_most_recent_first(ws):
    sid1 = ws.start("galabau", "memo")
    sid2 = ws.start("consultant", "brief")
    metas = ws.list_sessions(limit=10)
    assert {m.session_id for m in metas} == {sid1, sid2}
    # mtime ordering: most-recent first
    assert metas[0].mtime >= metas[-1].mtime
    roles = {m.role for m in metas}
    assert roles == {"galabau", "consultant"}


def test_list_sessions_empty_when_no_root(ws):
    assert ws.list_sessions() == []


def test_cli_start_append_read_round_trip(tmp_path, monkeypatch):
    env = dict(os.environ if False else __import__("os").environ)
    env["HOME"] = str(tmp_path)
    cmd_base = [sys.executable, str(MODULE_PATH)]
    out = subprocess.run(cmd_base + ["start", "--role", "galabau", "--task", "memo"],
                         check=True, capture_output=True, text=True, env=env)
    sid = out.stdout.strip()
    assert sid
    subprocess.run(cmd_base + ["append", sid, "--kind", "host.turn",
                               "--data", "prompt=hello"],
                   check=True, capture_output=True, text=True, env=env)
    out = subprocess.run(cmd_base + ["read", sid], check=True,
                         capture_output=True, text=True, env=env)
    lines = [json.loads(l) for l in out.stdout.strip().splitlines()]
    assert len(lines) == 2
    assert lines[1]["data"] == {"prompt": "hello"}


def test_cli_list_returns_jsonl(tmp_path):
    env = dict(__import__("os").environ)
    env["HOME"] = str(tmp_path)
    cmd_base = [sys.executable, str(MODULE_PATH)]
    subprocess.run(cmd_base + ["start", "--role", "galabau", "--task", "memo"],
                   check=True, capture_output=True, text=True, env=env)
    out = subprocess.run(cmd_base + ["list", "--limit", "5"], check=True,
                         capture_output=True, text=True, env=env)
    rows = [json.loads(l) for l in out.stdout.strip().splitlines()]
    assert len(rows) == 1
    assert rows[0]["role"] == "galabau"
    assert rows[0]["task"] == "memo"
