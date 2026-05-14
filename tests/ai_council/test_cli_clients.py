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
    GeminiCliClient,
    OpenAICliClient,
    PerplexityCliClient,
    XAICliClient,
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


# ── integration: fixture-backed end-to-end (Phase 2 Step 4) ───────────────


_CLAUDE_FIXTURE = (
    Path(__file__).resolve().parents[1] / "fixtures" / "claude_cli_json.txt"
)


def test_ask_with_real_claude_cli_envelope(monkeypatch, tmp_path):
    """Real Claude JSON envelope from public docs → fully populated CouncilResponse.

    Mirrors what `claude --print --output-format json` actually emits;
    subprocess is mocked, so the test runs without a real binary. Audit
    metadata (session_id + reported_cost_usd) is preserved even though
    the transport is non-billable.
    """
    envelope = _CLAUDE_FIXTURE.read_text(encoding="utf-8")
    monkeypatch.setattr(clients_mod.shutil, "which", lambda b: "/bin/claude")
    _patch_run(monkeypatch, stdout=envelope)
    cli = AnthropicCliClient(cli_calls_path=tmp_path / "cli-calls.json")
    resp = cli.ask("you are a geography tutor", "What is the capital of France?")
    assert resp.error is None
    assert resp.text == "The capital of France is Paris."
    assert resp.input_tokens == 128
    assert resp.output_tokens == 42
    assert resp.metadata["cli"] is True
    assert resp.metadata["session_id"] == "3f0d9c2e-7b5a-4e1c-9d2b-8a6f5e4c3b2a"
    assert resp.metadata["reported_cost_usd"] == 0.0089
    assert resp.metadata["reported_duration_ms"] == 1842
    assert AnthropicCliClient.billable is False


# ── integration: OpenAICliClient (Phase 3 Step 4) ─────────────────────────


_CODEX_FIXTURE = (
    Path(__file__).resolve().parents[1] / "fixtures" / "codex_cli_ndjson.txt"
)


def test_openai_cli_with_real_codex_envelope(monkeypatch, tmp_path):
    """Real Codex NDJSON event stream → fully populated CouncilResponse.

    Codex emits one JSON object per line in `exec --json` mode; the
    parser walks the stream and pulls the final-result event plus the
    turn.completed usage tally. Subprocess is mocked.
    """
    envelope = _CODEX_FIXTURE.read_text(encoding="utf-8")
    monkeypatch.setattr(clients_mod.shutil, "which", lambda b: "/bin/codex")
    _patch_run(monkeypatch, stdout=envelope)
    cli = OpenAICliClient(cli_calls_path=tmp_path / "cli-calls.json")
    resp = cli.ask("you are a geography tutor", "What is the capital of France?")
    assert resp.error is None
    assert resp.text == "The capital of France is Paris."
    assert resp.input_tokens == 146
    assert resp.output_tokens == 38
    assert resp.metadata["cli"] is True
    assert resp.metadata["item_id"] == "item_01"
    assert resp.metadata["session_id"] == "01HZK8R2W6X9Q4M7N5T2Y3F6A8"
    assert OpenAICliClient.billable is False


def test_openai_cli_build_command_includes_system_prompt(monkeypatch, tmp_path):
    monkeypatch.setattr(clients_mod.shutil, "which", lambda b: "/bin/codex")
    captured = _patch_run(monkeypatch, stdout="")
    cli = OpenAICliClient(cli_calls_path=tmp_path / "cli-calls.json")
    cli.ask("system here", "user here")
    cmd = captured["cmd"]
    assert cmd[0] == "/bin/codex"
    assert "exec" in cmd
    assert "--json" in cmd
    assert "--system" in cmd
    assert "system here" in cmd
    assert cmd[-1] == "user here"


def test_openai_cli_parse_failed_on_garbage(monkeypatch, tmp_path):
    """Pure-garbage stdout → empty text but no crash; defensive parse.

    Codex's NDJSON parser silently skips non-JSON lines, so garbage
    input yields an empty CouncilResponse rather than a parse_failed
    error. Either contract is acceptable; the Iron Law is "never
    crash the run".
    """
    monkeypatch.setattr(clients_mod.shutil, "which", lambda b: "/bin/codex")
    _patch_run(monkeypatch, stdout="this is not JSON\nneither is this\n")
    cli = OpenAICliClient(cli_calls_path=tmp_path / "cli-calls.json")
    resp = cli.ask("sys", "user")
    assert resp.text == ""
    assert resp.input_tokens == 0
    assert resp.output_tokens == 0
    assert resp.metadata["cli"] is True


# ── integration: GeminiCliClient (Phase 3 Step 4) ─────────────────────────


_GEMINI_FIXTURE = (
    Path(__file__).resolve().parents[1] / "fixtures" / "gemini_cli_json.txt"
)


def test_gemini_cli_with_real_envelope(monkeypatch, tmp_path):
    """Real Gemini JSON envelope → fully populated CouncilResponse.

    `gemini -p --output-format json` emits one top-level object with
    `response`, `stats.models[<model>].tokens`, and `sessionId`. The
    parser pulls all three; subprocess is mocked.
    """
    envelope = _GEMINI_FIXTURE.read_text(encoding="utf-8")
    monkeypatch.setattr(clients_mod.shutil, "which", lambda b: "/bin/gemini")
    _patch_run(monkeypatch, stdout=envelope)
    cli = GeminiCliClient(cli_calls_path=tmp_path / "cli-calls.json")
    resp = cli.ask("you are a geography tutor", "What is the capital of France?")
    assert resp.error is None
    assert resp.text == "The capital of France is Paris."
    assert resp.input_tokens == 112
    assert resp.output_tokens == 31
    assert resp.metadata["cli"] is True
    assert resp.metadata["session_id"] == "sess_3f7a8b2d_91c4_4e6f_a0d8"
    assert GeminiCliClient.billable is False


def test_gemini_cli_pipes_prompt_on_stdin(monkeypatch, tmp_path):
    monkeypatch.setattr(clients_mod.shutil, "which", lambda b: "/bin/gemini")
    captured = _patch_run(monkeypatch, stdout='{"response":"ok"}')
    cli = GeminiCliClient(cli_calls_path=tmp_path / "cli-calls.json")
    cli.ask("system here", "user here")
    cmd = captured["cmd"]
    assert cmd[0] == "/bin/gemini"
    assert "--output-format" in cmd
    assert "json" in cmd
    # prompt rides on stdin, not argv, so argv must not contain it
    assert "user here" not in cmd
    assert captured["kw"]["input"] == "user here"


def test_gemini_cli_parse_failed_on_garbage(monkeypatch, tmp_path):
    monkeypatch.setattr(clients_mod.shutil, "which", lambda b: "/bin/gemini")
    _patch_run(monkeypatch, stdout="not JSON at all")
    cli = GeminiCliClient(cli_calls_path=tmp_path / "cli-calls.json")
    resp = cli.ask("sys", "user")
    assert resp.error is not None
    assert resp.error.startswith("parse_failed:")
    assert resp.text == "not JSON at all"


# ── integration: XAICliClient (Phase 4 Step 5) ────────────────────────────


def test_xai_cli_plain_text_envelope(monkeypatch, tmp_path):
    """Plain-text stdout → trimmed text + heuristic output token estimate.

    The community `grok` CLI emits no JSON envelope, so the client
    returns the trimmed stdout and estimates output tokens from
    character count (chars / 4). Subprocess is mocked.
    """
    monkeypatch.setattr(clients_mod.shutil, "which", lambda b: "/bin/grok")
    _patch_run(monkeypatch, stdout="The capital of France is Paris.\n")
    cli = XAICliClient(cli_calls_path=tmp_path / "cli-calls.json")
    resp = cli.ask("you are a geography tutor", "What is the capital of France?")
    assert resp.error is None
    assert resp.text == "The capital of France is Paris."
    assert resp.input_tokens == 0
    assert resp.output_tokens == len("The capital of France is Paris.") // 4
    assert resp.metadata["cli"] is True
    assert resp.metadata["cli_output_format"] == "plain_text"


def test_xai_cli_is_billable():
    """`mode: cli` for xAI must keep `billable=True` — community CLI
    consumes XAI_API_KEY, so the USD cost gate still applies.
    """
    assert XAICliClient.billable is True


def test_xai_cli_build_command(monkeypatch, tmp_path):
    monkeypatch.setattr(clients_mod.shutil, "which", lambda b: "/bin/grok")
    captured = _patch_run(monkeypatch, stdout="ok")
    cli = XAICliClient(cli_calls_path=tmp_path / "cli-calls.json")
    cli.ask("system here", "user here")
    cmd = captured["cmd"]
    assert cmd[0] == "/bin/grok"
    assert "-p" in cmd
    assert "user here" in cmd
    assert "--model" in cmd
    assert "grok-4" in cmd


def test_xai_cli_auth_failure(monkeypatch, tmp_path):
    """Non-zero exit + auth-flavoured stderr → structured auth_expired."""
    monkeypatch.setattr(clients_mod.shutil, "which", lambda b: "/bin/grok")
    _patch_run(
        monkeypatch,
        stdout="",
        stderr="Error: 401 unauthorized — XAI_API_KEY invalid",
        returncode=1,
    )
    cli = XAICliClient(cli_calls_path=tmp_path / "cli-calls.json")
    resp = cli.ask("sys", "user")
    assert resp.error == "auth_expired"


# ── integration: PerplexityCliClient (Phase 4 Step 5) ─────────────────────


def test_perplexity_cli_plain_text_envelope(monkeypatch, tmp_path):
    monkeypatch.setattr(clients_mod.shutil, "which", lambda b: "/bin/perplexity")
    _patch_run(monkeypatch, stdout="The capital of France is Paris.\n")
    cli = PerplexityCliClient(cli_calls_path=tmp_path / "cli-calls.json")
    resp = cli.ask("you are a geography tutor", "What is the capital of France?")
    assert resp.error is None
    assert resp.text == "The capital of France is Paris."
    assert resp.input_tokens == 0
    assert resp.output_tokens == len("The capital of France is Paris.") // 4
    assert resp.metadata["cli"] is True
    assert resp.metadata["cli_output_format"] == "plain_text"


def test_perplexity_cli_is_billable():
    """`mode: cli` for Perplexity must keep `billable=True` — community
    CLI consumes PERPLEXITY_API_KEY, so the USD cost gate still applies.
    """
    assert PerplexityCliClient.billable is True


def test_perplexity_cli_auth_failure(monkeypatch, tmp_path):
    monkeypatch.setattr(clients_mod.shutil, "which", lambda b: "/bin/perplexity")
    _patch_run(
        monkeypatch,
        stdout="",
        stderr="Error: 401 unauthorized — PERPLEXITY_API_KEY missing",
        returncode=1,
    )
    cli = PerplexityCliClient(cli_calls_path=tmp_path / "cli-calls.json")
    resp = cli.ask("sys", "user")
    assert resp.error == "auth_expired"


def test_billable_community_cli_participates_in_cost_gate(monkeypatch, tmp_path):
    """The cost-gate-skip branch in orchestrator must NOT fire for
    `billable=True` CLI subclasses — they go through the same USD
    projection path as `mode: api` clients.

    Verifies the structural invariant: `billable` is True at the class
    level for both community CLIs, mirroring the orchestrator's check
    `if not getattr(member, "billable", True):`.
    """
    assert XAICliClient.billable is True
    assert PerplexityCliClient.billable is True
    # And the vendor-official CLIs stay non-billable:
    assert AnthropicCliClient.billable is False
    assert OpenAICliClient.billable is False
    assert GeminiCliClient.billable is False
