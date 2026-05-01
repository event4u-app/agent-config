"""End-to-end integration of the chat-history hooks (P5 of road-to-work-engine-hooks).

Drives the full eight-step flow with all four chat-history hooks
registered and a fake :func:`subprocess.run` capturing every
``scripts/chat_history.py`` invocation. The point is to lock down the
structural contract:

- ``turn-check`` fires once per dispatch cycle on ``before_dispatch``.
- ``append --type phase`` fires once per successful step boundary.
- ``heartbeat`` fires once per dispatch cycle on ``after_dispatch``.
- A ``foreign`` / ``returning`` ``turn-check`` exit halts the cycle
  with CLI exit code 2 and never reaches ``_save``.
"""
from __future__ import annotations

import json
import subprocess
import sys
import types
from pathlib import Path

import pytest

from work_engine import main
from work_engine.hooks.builtin import _chat_history_base


@pytest.fixture()
def fake_memory_lookup(monkeypatch):
    stub = types.ModuleType("memory_lookup")
    stub.retrieve = lambda types_, keys, limit: []
    monkeypatch.setitem(sys.modules, "memory_lookup", stub)
    return stub


def _settings_with_chat_history(tmp_path: Path, script: Path) -> Path:
    cfg = tmp_path / ".agent-settings.yml"
    cfg.write_text(
        "hooks:\n"
        "  enabled: true\n"
        "  trace: false\n"
        "  halt_surface_audit: false\n"
        "  state_shape_validation: false\n"
        "  directive_set_guard: false\n"
        "  chat_history:\n"
        "    enabled: true\n"
        f"    script: {script}\n"
        "chat_history:\n"
        "  enabled: true\n",
        encoding="utf-8",
    )
    return cfg


def _well_formed_ticket(tmp_path: Path) -> Path:
    ticket = tmp_path / "ticket.json"
    ticket.write_text(
        json.dumps({
            "id": "TICKET-99",
            "title": "Add export button",
            "acceptance_criteria": [
                "Users can trigger CSV export from the dashboard.",
                "The export includes every visible column.",
            ],
        }),
        encoding="utf-8",
    )
    return ticket


def _install_fake_runner(monkeypatch, *, turn_check_exit: int = 0):
    """Monkeypatch ``_default_runner`` to capture every chat-history call."""
    captured: list[list[str]] = []

    def fake_runner(cmd):
        captured.append(list(cmd))
        # cmd[2] is the chat_history.py subcommand (sys.executable, script, sub).
        sub = cmd[2] if len(cmd) > 2 else ""
        if sub == "turn-check":
            return subprocess.CompletedProcess(
                args=cmd, returncode=turn_check_exit,
                stdout="", stderr="ACTION REQUIRED: drift" if turn_check_exit else "",
            )
        if sub == "heartbeat":
            return subprocess.CompletedProcess(
                args=cmd, returncode=0,
                stdout="📒 chat-history: ok · per_phase", stderr="",
            )
        return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="", stderr="")

    monkeypatch.setattr(_chat_history_base, "_default_runner", fake_runner)
    return captured


def test_turn_check_halt_exits_two_without_save(
    tmp_path: Path, monkeypatch, capsys, fake_memory_lookup,
) -> None:
    """``turn-check`` exit 11 (foreign) → CLI exit 2 + no state on disk."""
    script = tmp_path / "chat_history.py"
    script.write_text("# stub", encoding="utf-8")
    cfg = _settings_with_chat_history(tmp_path, script)
    state_file = tmp_path / "state.json"

    captured = _install_fake_runner(monkeypatch, turn_check_exit=11)

    exit_code = main([
        "--state-file", str(state_file),
        "--ticket-file", str(_well_formed_ticket(tmp_path)),
        "--hooks-config", str(cfg),
    ])

    assert exit_code == 2
    assert not state_file.exists()
    sub_commands = [c[2] for c in captured if len(c) > 2]
    assert "turn-check" in sub_commands
    # No append / heartbeat reached after halt.
    assert "append" not in sub_commands
    assert "heartbeat" not in sub_commands


def test_one_dispatch_cycle_fires_turn_check_and_heartbeat(
    tmp_path: Path, monkeypatch, capsys, fake_memory_lookup,
) -> None:
    """``turn-check`` and ``heartbeat`` fire exactly once per cycle."""
    script = tmp_path / "chat_history.py"
    script.write_text("# stub", encoding="utf-8")
    cfg = _settings_with_chat_history(tmp_path, script)
    state_file = tmp_path / "state.json"

    captured = _install_fake_runner(monkeypatch, turn_check_exit=0)

    exit_code = main([
        "--state-file", str(state_file),
        "--ticket-file", str(_well_formed_ticket(tmp_path)),
        "--hooks-config", str(cfg),
    ])

    # First cycle halts BLOCKED at create-plan (agent must resume).
    assert exit_code == 1
    assert state_file.exists()
    sub_commands = [c[2] for c in captured if len(c) > 2]
    assert sub_commands.count("turn-check") == 1
    assert sub_commands.count("heartbeat") == 1
    # refine + memory + analyze succeeded before plan blocked → 3 phase
    # appends + 1 decision append for the create-plan halt = 4 total.
    append_calls = [c for c in captured if len(c) > 2 and c[2] == "append"]
    assert len(append_calls) >= 3
    types_seen = []
    for call in append_calls:
        if "--type" in call:
            types_seen.append(call[call.index("--type") + 1])
    assert types_seen.count("phase") >= 3
    assert types_seen.count("decision") >= 1
