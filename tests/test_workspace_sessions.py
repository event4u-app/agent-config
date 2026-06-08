"""Tests for ``src/cli/python/workspace_sessions.py``.

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
MODULE_PATH = REPO_ROOT / "src" / "cli" / "python" / "workspace_sessions.py"


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
    # Encryption OFF by default — deterministic regardless of a repo-root
    # .agent-settings.yml in the cwd. Encryption tests flip it explicitly.
    monkeypatch.setattr(mod.workspace_crypto, "is_enabled", lambda *a, **k: False)
    return mod


try:
    import cryptography  # noqa: F401
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False


@pytest.fixture
def enc_ws(tmp_path, monkeypatch):
    """Session store with encryption-at-rest ON and a fixed key."""
    import base64
    import os as _os
    mod = _load()
    monkeypatch.setattr(mod, "WORKSPACE_HOME", tmp_path / "sessions")
    monkeypatch.setattr(mod.workspace_crypto, "is_enabled", lambda *a, **k: True)
    monkeypatch.setenv("AGENT_CONFIG_WORKSPACE_KEY",
                       base64.b64encode(_os.urandom(32)).decode("ascii"))
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


# --- encryption-at-rest (ADR-064: per-record append-JSONL) ----------------

@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_encrypted_start_append_round_trip(enc_ws):
    sid = enc_ws.start("galabau", "offer")
    enc_ws.append(sid, "host.turn", {"text": "hello customer"})
    p = enc_ws._session_path(sid)
    lines = [ln for ln in p.read_text(encoding="utf-8").splitlines() if ln.strip()]
    assert len(lines) == 2
    assert all(not ln.startswith("{") for ln in lines)        # per-record encrypted
    import base64
    assert base64.b64decode(lines[0], validate=True)[:4] == b"AC1\x00"
    assert b"hello customer" not in p.read_bytes()             # not cleartext on disk
    recs = enc_ws.read(sid)                                    # decrypts per line
    assert [r["kind"] for r in recs] == ["launcher.input", "host.turn"]
    assert recs[1]["data"]["text"] == "hello customer"


@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_encrypted_list_decrypts_first_record_meta(enc_ws):
    sid = enc_ws.start("consultant", "investor-memo")
    metas = enc_ws.list_sessions()
    assert any(m.session_id == sid and m.role == "consultant"
               and m.task == "investor-memo" for m in metas)   # first line decrypted


@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_migrate_then_decrypt_all(ws, monkeypatch):
    import base64, os as _os
    sid = ws.start("galabau", "t")
    ws.append(sid, "host.turn", {"x": 1})
    p = ws._session_path(sid)
    assert p.read_text(encoding="utf-8").splitlines()[0].startswith("{")  # plaintext

    monkeypatch.setattr(ws.workspace_crypto, "is_enabled", lambda *a, **k: True)
    monkeypatch.setenv("AGENT_CONFIG_WORKSPACE_KEY",
                       base64.b64encode(_os.urandom(32)).decode("ascii"))
    assert ws.migrate()["migrated"] == 1
    assert all(not ln.startswith("{") for ln in p.read_text().splitlines() if ln.strip())
    assert [r["kind"] for r in ws.read(sid)] == ["launcher.input", "host.turn"]

    assert ws.decrypt_all()["decrypted"] == 1
    assert all(ln.startswith("{") for ln in p.read_text().splitlines() if ln.strip())


@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_rekey_reencrypts_sessions(enc_ws, monkeypatch):
    import os as _os
    wc = enc_ws.workspace_crypto
    monkeypatch.delenv("AGENT_CONFIG_WORKSPACE_KEY", raising=False)
    state = {"key": _os.urandom(32)}
    monkeypatch.setattr(wc, "_get_or_create_master_key", lambda **k: state["key"])
    monkeypatch.setattr(wc, "rotate_key",
                        lambda: state.__setitem__("key", _os.urandom(32)) or state["key"])
    sid = enc_ws.start("galabau", "t")
    p = enc_ws._session_path(sid)
    before = p.read_bytes()
    assert enc_ws.rekey()["rekeyed"] == 1
    assert p.read_bytes() != before                            # re-encrypted
    assert enc_ws.read(sid)[0]["kind"] == "launcher.input"     # still decryptable


@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_torn_line_skipped(enc_ws):
    sid = enc_ws.start("galabau", "t")
    with enc_ws._session_path(sid).open("a", encoding="utf-8") as fh:
        fh.write("dG90YWxseS1nYXJiYWdl\n")                     # base64 garbage → skip
    assert [r["kind"] for r in enc_ws.read(sid)] == ["launcher.input"]


def test_cli_root_validation_rejects_bad_path(ws, tmp_path):
    bad = tmp_path / "not-a-sessions-dir"
    bad.mkdir()
    with pytest.raises(SystemExit, match="workspace/sessions"):
        ws.main(["list", "--root", str(bad)])


def test_cli_list_json_with_valid_root(ws, tmp_path):
    root = tmp_path / "workspace" / "sessions"
    root.mkdir(parents=True)
    sid = ws.start("galabau", "t", root=root)
    rc = ws.main(["list", "--json", "--root", str(root)])
    assert rc == 0
