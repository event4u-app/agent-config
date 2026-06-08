"""Tests for ``src/cli/python/workspace_analytics.py``.

Covers the Phase 7 contract surface defined in ``docs/contracts/local-analytics.md``:

* emit gate (env opt-out, settings opt-out, allowed_events allowlist)
* JSONL append shape (``workspace_event/v0`` schema + UTC ts)
* read_events tolerates malformed lines
* query window / event / role filters
* prune drops only events older than retention_days
* show renders markdown / csv / json
* CLI ``emit`` / ``show`` / ``prune`` round-trip
"""

from __future__ import annotations

import importlib.util
import json
import os
import subprocess
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest


REPO_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = REPO_ROOT / "src" / "cli" / "python" / "workspace_analytics.py"


def _load():
    spec = importlib.util.spec_from_file_location("workspace_analytics", MODULE_PATH)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules["workspace_analytics"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def wa():
    return _load()


@pytest.fixture
def isolated(tmp_path, wa, monkeypatch):
    events = tmp_path / "events.jsonl"
    monkeypatch.setattr(wa, "EVENTS_PATH", events)
    monkeypatch.setattr(wa, "WORKSPACE_HOME", tmp_path)
    monkeypatch.setattr(wa, "RETENTION_LOCK", tmp_path / "retention.lock")
    monkeypatch.delenv(wa.ENV_OPT_OUT, raising=False)
    # Encryption OFF by default — deterministic regardless of a repo-root
    # .agent-settings.yml in the cwd. Encryption tests flip it explicitly.
    monkeypatch.setattr(wa.workspace_crypto, "is_enabled", lambda *a, **k: False)
    return events


try:
    import cryptography  # noqa: F401
    HAS_CRYPTO = True
except ImportError:
    HAS_CRYPTO = False


@pytest.fixture
def enc_isolated(isolated, wa, monkeypatch):
    """`isolated`, but with encryption-at-rest ON and a fixed key."""
    import base64
    import os as _os
    monkeypatch.setattr(wa.workspace_crypto, "is_enabled", lambda *a, **k: True)
    monkeypatch.setenv("AGENT_CONFIG_WORKSPACE_KEY",
                       base64.b64encode(_os.urandom(32)).decode("ascii"))
    return isolated


def test_emit_writes_schema_v0(wa, isolated):
    assert wa.emit("launcher.opened", {"role": "tradesperson"}) is True
    line = isolated.read_text(encoding="utf-8").strip()
    rec = json.loads(line)
    assert rec["schema"] == "workspace_event/v0"
    assert rec["event"] == "launcher.opened"
    assert rec["data"] == {"role": "tradesperson"}
    assert rec["ts"].endswith("Z")
    datetime.strptime(rec["ts"], "%Y-%m-%dT%H:%M:%SZ")  # parse must succeed


def test_emit_rejects_unknown_event(wa, isolated):
    assert wa.emit("rocket.launched", {}) is False
    assert not isolated.exists()


def test_emit_env_opt_out(wa, isolated, monkeypatch):
    monkeypatch.setenv(wa.ENV_OPT_OUT, "1")
    assert wa.emit("launcher.opened") is False
    assert not isolated.exists()


def test_emit_settings_opt_out(wa, isolated, tmp_path):
    settings = tmp_path / ".agent-settings.yml"
    settings.write_text("analytics:\n  local: off\n", encoding="utf-8")
    assert wa.emit("launcher.opened", settings_path=settings) is False
    settings.write_text("analytics:\n  local: on\n", encoding="utf-8")
    assert wa.emit("launcher.opened", settings_path=settings) is True


def test_read_events_skips_malformed(wa, isolated):
    isolated.write_text(
        "\n".join([
            json.dumps({"ts": "2030-01-01T00:00:00Z", "schema": "workspace_event/v0", "event": "launcher.opened", "data": {}}),
            "{not json",
            json.dumps({"ts": "2030-01-02T00:00:00Z", "schema": "workspace_event/v0", "event": "session.completed", "data": {"role": "x"}}),
        ]) + "\n",
        encoding="utf-8",
    )
    events = wa.read_events()
    assert [e.event for e in events] == ["launcher.opened", "session.completed"]


def test_query_filters(wa, isolated):
    wa.emit("launcher.task_launched", {"role": "a", "task": "t1"})
    wa.emit("launcher.task_launched", {"role": "b", "task": "t2"})
    wa.emit("session.completed", {"role": "a"})
    assert len(wa.query()) == 3
    assert len(wa.query(event="session.completed")) == 1
    assert {e.data["role"] for e in wa.query(role="a")} == {"a"}
    far_future = datetime.now(timezone.utc) + timedelta(days=1)
    assert wa.query(since=far_future) == []


def test_prune_drops_old_records(wa, isolated):
    old = datetime.now(timezone.utc) - timedelta(days=120)
    fresh = datetime.now(timezone.utc) - timedelta(days=1)
    isolated.write_text(
        "\n".join([
            json.dumps({"ts": old.strftime("%Y-%m-%dT%H:%M:%SZ"), "schema": "workspace_event/v0", "event": "launcher.opened", "data": {}}),
            json.dumps({"ts": fresh.strftime("%Y-%m-%dT%H:%M:%SZ"), "schema": "workspace_event/v0", "event": "launcher.opened", "data": {}}),
        ]) + "\n",
        encoding="utf-8",
    )
    dropped = wa.prune()
    assert dropped == 1
    remaining = wa.read_events()
    assert len(remaining) == 1


def test_show_markdown_renders_sections(wa, isolated):
    wa.emit("launcher.task_launched", {"role": "tradesperson", "task": "estimate"})
    wa.emit("launcher.task_launched", {"role": "tradesperson", "task": "estimate"})
    wa.emit("session.completed", {"role": "tradesperson", "duration_ms": 600_000})
    md = wa.show("30d", None, None, "markdown")
    assert "Workspace analytics" in md
    assert "Top prompts" in md
    assert "tradesperson" in md
    assert "50%" in md  # 1 of 2 launched completed


def test_show_csv_and_json(wa, isolated):
    wa.emit("launcher.opened", {"role": "homeowner"})
    csv_out = wa.show("30d", None, None, "csv")
    assert csv_out.splitlines()[0].startswith("ts,event,role")
    j = json.loads(wa.show("30d", None, None, "json"))
    assert j[0]["event"] == "launcher.opened"


def test_cli_emit_show_prune(tmp_path):
    env = os.environ.copy()
    env["HOME"] = str(tmp_path)
    cmd = [sys.executable, str(MODULE_PATH)]
    r = subprocess.run(cmd + ["emit", "launcher.opened", "--data", "role=cfo"], env=env, capture_output=True, text=True)
    assert r.returncode == 0, r.stderr
    r = subprocess.run(cmd + ["show", "--window", "24h", "--format", "json"], env=env, capture_output=True, text=True)
    assert r.returncode == 0
    payload = json.loads(r.stdout)
    assert payload and payload[0]["event"] == "launcher.opened"
    r = subprocess.run(cmd + ["prune"], env=env, capture_output=True, text=True)
    assert r.returncode == 0
    assert "pruned" in r.stdout


# --- encryption-at-rest (ADR-064: per-record append-JSONL) ----------------

@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_encrypted_emit_writes_base64_not_plaintext(wa, enc_isolated):
    assert wa.emit("launcher.opened", {"role": "tradesperson"}) is True
    line = enc_isolated.read_text(encoding="utf-8").strip()
    assert not line.startswith("{")            # not plaintext JSON
    import base64
    raw = base64.b64decode(line, validate=True)
    assert raw[:4] == b"AC1\x00"               # per-record AES-256-GCM envelope
    assert b"tradesperson" not in raw          # payload not cleartext on disk


@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_encrypted_round_trip_read_events(wa, enc_isolated):
    wa.emit("launcher.opened", {"role": "a"})
    wa.emit("session.started", {"role": "b"})
    events = wa.read_events(enc_isolated)
    assert [e.event for e in events] == ["launcher.opened", "session.started"]
    assert events[0].data["role"] == "a"       # decrypted per line


@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_each_line_has_distinct_nonce(wa, enc_isolated):
    wa.emit("launcher.opened", {"role": "x"})
    wa.emit("launcher.opened", {"role": "x"})   # identical payload
    lines = enc_isolated.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 2
    assert lines[0] != lines[1]                 # random nonce → distinct ciphertext


@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_migrate_then_decrypt_all(wa, isolated, monkeypatch):
    import base64, os as _os
    # Write two plaintext events (flag off).
    wa.emit("launcher.opened", {"role": "a"})
    wa.emit("session.started", {"role": "b"})
    assert isolated.read_text(encoding="utf-8").splitlines()[0].startswith("{")

    # Flip on + migrate → every line per-record encrypted, content intact.
    monkeypatch.setattr(wa.workspace_crypto, "is_enabled", lambda *a, **k: True)
    monkeypatch.setenv("AGENT_CONFIG_WORKSPACE_KEY",
                       base64.b64encode(_os.urandom(32)).decode("ascii"))
    assert wa.migrate()["migrated"] == 2
    assert all(not ln.startswith("{") for ln in isolated.read_text().splitlines())
    assert [e.event for e in wa.read_events(isolated)] == ["launcher.opened", "session.started"]

    # Kill-switch back to plaintext.
    assert wa.decrypt_all()["decrypted"] == 2
    assert all(ln.startswith("{") for ln in isolated.read_text().splitlines())


@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_prune_ages_encrypted_records_by_cleartext_ts(wa, enc_isolated, monkeypatch):
    # An old encrypted record must still be pruned by its decrypted ts.
    old_ts = "2000-01-01T00:00:00Z"
    rec = {"ts": old_ts, "schema": wa.SCHEMA, "event": "launcher.opened", "data": {}}
    enc_isolated.write_text(
        wa.workspace_crypto.encrypt_line(json.dumps(rec, sort_keys=True)) + "\n",
        encoding="utf-8")
    assert wa.prune() == 1                       # pruned by decrypted ts
    assert enc_isolated.read_text(encoding="utf-8").strip() == ""


@pytest.mark.skipif(not HAS_CRYPTO, reason="cryptography not installed")
def test_torn_line_skipped_best_effort(wa, enc_isolated):
    wa.emit("launcher.opened", {"role": "good"})
    with enc_isolated.open("a", encoding="utf-8") as fh:
        fh.write("dG90YWxseS1ub3QtYW4tZW52ZWxvcGU=\n")  # base64 garbage → skip
    events = wa.read_events(enc_isolated)
    assert [e.event for e in events] == ["launcher.opened"]   # torn line skipped
