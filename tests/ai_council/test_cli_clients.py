"""CLI transport — CliClient + AnthropicCliClient.

Subprocess is the boundary: every test injects a fake ``subprocess.run``
or a fake ``shutil.which`` so the suite never spawns a real binary.
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace
from typing import Any

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council import clients as clients_mod  # noqa: E402
from scripts.ai_council.clients import (  # noqa: E402
    AnthropicCliClient,
    CliClient,
    CliClientError,
    CouncilResponse,
    load_cli_call_counts,
    record_cli_call,
)


# ── helpers ────────────────────────────────────────────────────────────────


def _completed(stdout: str = "", stderr: str = "", returncode: int = 0):
    return SimpleNamespace(stdout=stdout, stderr=stderr, returncode=returncode)


def _patch_run(monkeypatch, **completed_kw):
    captured: dict[str, Any] = {}

    def fake_run(cmd, **kw):
        captured["cmd"] = cmd
        captured["kw"] = kw
        return _completed(**completed_kw)

    monkeypatch.setattr(clients_mod.subprocess, "run", fake_run)
    return captured


def _patch_run_raises(monkeypatch, exc):
    def fake_run(*_a, **_kw):
        raise exc

    monkeypatch.setattr(clients_mod.subprocess, "run", fake_run)


# ── binary resolution ─────────────────────────────────────────────────────


def test_binary_explicit_path_used_as_is():
    cli = AnthropicCliClient(binary="/opt/custom/claude")
    assert cli.binary == "/opt/custom/claude"


def test_binary_resolved_via_which(monkeypatch):
    monkeypatch.setattr(clients_mod.shutil, "which", lambda b: "/usr/local/bin/claude")
    cli = AnthropicCliClient()
    assert cli.binary == "/usr/local/bin/claude"


def test_binary_missing_raises(monkeypatch):
    monkeypatch.setattr(clients_mod.shutil, "which", lambda b: None)
    with pytest.raises(CliClientError, match="not found on PATH"):
        AnthropicCliClient()


# ── call-counter state ────────────────────────────────────────────────────


def test_load_empty_when_file_missing(tmp_path):
    assert load_cli_call_counts(tmp_path / "cli-calls.json") == {}


def test_load_empty_on_stale_date(tmp_path):
    p = tmp_path / "cli-calls.json"
    p.write_text(json.dumps({"date": "1999-01-01", "counts": {"anthropic": 99}}))
    assert load_cli_call_counts(p) == {}


def test_record_increments_and_persists(tmp_path):
    p = tmp_path / "cli-calls.json"
    assert record_cli_call("anthropic", p) == 1
    assert record_cli_call("anthropic", p) == 2
    assert record_cli_call("openai", p) == 1
    counts = load_cli_call_counts(p)
    assert counts == {"anthropic": 2, "openai": 1}


# ── ask() — success path ──────────────────────────────────────────────────


def test_ask_success_parses_envelope(monkeypatch, tmp_path):
    monkeypatch.setattr(clients_mod.shutil, "which", lambda b: "/bin/claude")
    envelope = {
        "result": "Hello world.",
        "usage": {"input_tokens": 12, "output_tokens": 34},
        "session_id": "abc-123",
        "total_cost_usd": 0.0,
    }
    captured = _patch_run(monkeypatch, stdout=json.dumps(envelope))
    cli = AnthropicCliClient(cli_calls_path=tmp_path / "cli-calls.json")
    resp = cli.ask("sys", "user")
    assert resp.text == "Hello world."
    assert resp.input_tokens == 12
    assert resp.output_tokens == 34
    assert resp.error is None
    assert resp.metadata["cli"] is True
    assert resp.metadata["session_id"] == "abc-123"
    assert captured["cmd"][0] == "/bin/claude"
    assert "--print" in captured["cmd"]
    assert "--output-format" in captured["cmd"]
    assert captured["kw"]["input"] == "user"
    # call counter recorded.
    assert load_cli_call_counts(tmp_path / "cli-calls.json") == {"anthropic": 1}


# ── ask() — failure paths ─────────────────────────────────────────────────


def test_ask_timeout(monkeypatch, tmp_path):
    monkeypatch.setattr(clients_mod.shutil, "which", lambda b: "/bin/claude")
    _patch_run_raises(monkeypatch, subprocess.TimeoutExpired(cmd="claude", timeout=1))
    cli = AnthropicCliClient(cli_calls_path=tmp_path / "cli-calls.json", timeout_seconds=1)
    resp = cli.ask("sys", "user")
    assert resp.error == "timeout"
    assert resp.text == ""


def test_ask_binary_missing_at_runtime(monkeypatch, tmp_path):
    monkeypatch.setattr(clients_mod.shutil, "which", lambda b: "/bin/claude")
    _patch_run_raises(monkeypatch, FileNotFoundError("no such file"))
    cli = AnthropicCliClient(cli_calls_path=tmp_path / "cli-calls.json")
    resp = cli.ask("sys", "user")
    assert resp.error == "binary_missing"


def test_ask_auth_expired(monkeypatch, tmp_path):
    monkeypatch.setattr(clients_mod.shutil, "which", lambda b: "/bin/claude")
    _patch_run(monkeypatch, stderr="Authentication failed: please run /login", returncode=2)
    cli = AnthropicCliClient(cli_calls_path=tmp_path / "cli-calls.json")
    resp = cli.ask("sys", "user")
    assert resp.error == "auth_expired"
    assert resp.metadata["returncode"] == 2


def test_ask_quota_from_stderr(monkeypatch, tmp_path):
    monkeypatch.setattr(clients_mod.shutil, "which", lambda b: "/bin/claude")
    _patch_run(monkeypatch, stderr="Error 429: rate limit exceeded", returncode=1)
    cli = AnthropicCliClient(cli_calls_path=tmp_path / "cli-calls.json")
    resp = cli.ask("sys", "user")
    assert resp.error == "cli_quota_exhausted"


def test_ask_quota_local_counter(monkeypatch, tmp_path):
    monkeypatch.setattr(clients_mod.shutil, "which", lambda b: "/bin/claude")
    state = tmp_path / "cli-calls.json"
    record_cli_call("anthropic", state)
    record_cli_call("anthropic", state)
    cli = AnthropicCliClient(cli_calls_path=state, max_calls_per_day=2)
    resp = cli.ask("sys", "user")
    assert resp.error == "cli_quota_exhausted"
    assert resp.metadata["cli_calls_used"] == 2
    assert resp.metadata["cli_calls_max"] == 2


def test_ask_parse_failed_returns_raw_stdout(monkeypatch, tmp_path):
    monkeypatch.setattr(clients_mod.shutil, "which", lambda b: "/bin/claude")
    _patch_run(monkeypatch, stdout="this is not JSON")
    cli = AnthropicCliClient(cli_calls_path=tmp_path / "cli-calls.json")
    resp = cli.ask("sys", "user")
    assert resp.error is not None
    assert resp.error.startswith("parse_failed:")
    assert resp.text == "this is not JSON"


def test_ask_unknown_exit_code(monkeypatch, tmp_path):
    monkeypatch.setattr(clients_mod.shutil, "which", lambda b: "/bin/claude")
    _patch_run(monkeypatch, stderr="something weird", returncode=7)
    cli = AnthropicCliClient(cli_calls_path=tmp_path / "cli-calls.json")
    resp = cli.ask("sys", "user")
    assert resp.error == "exit_7"


# ── contract: billable=False ──────────────────────────────────────────────


def test_cli_client_is_not_billable():
    assert CliClient.billable is False
    assert AnthropicCliClient.billable is False


def test_cli_client_is_subclass_of_external():
    from scripts.ai_council.clients import ExternalAIClient
    assert issubclass(CliClient, ExternalAIClient)
