"""End-to-end integration of the chat-history hooks (hook-only contract).

Drives the full eight-step flow with the structural chat-history hooks
registered (append + halt_append) and a fake :func:`subprocess.run`
capturing every ``scripts/chat_history.py`` invocation. The point is
to lock down the contract:

- ``append --type phase`` fires once per successful step boundary.
- ``append --type decision`` fires when the engine halts with a
  surfaceable decision.

Cooperative ``turn-check`` and ``heartbeat`` hooks were removed in
``road-to-chat-history-hook-only`` Phase 2.
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


def _install_fake_runner(monkeypatch):
    """Monkeypatch ``_default_runner`` to capture every chat-history call."""
    captured: list[list[str]] = []

    def fake_runner(cmd):
        captured.append(list(cmd))
        return subprocess.CompletedProcess(args=cmd, returncode=0, stdout="", stderr="")

    monkeypatch.setattr(_chat_history_base, "_default_runner", fake_runner)
    return captured


def test_one_dispatch_cycle_fires_phase_and_decision_appends(
    tmp_path: Path, monkeypatch, capsys, fake_memory_lookup,
) -> None:
    """Structural append hooks fire once per phase boundary + on halt."""
    script = tmp_path / "chat_history.py"
    script.write_text("# stub", encoding="utf-8")
    cfg = _settings_with_chat_history(tmp_path, script)
    state_file = tmp_path / "state.json"

    captured = _install_fake_runner(monkeypatch)

    exit_code = main([
        "--state-file", str(state_file),
        "--ticket-file", str(_well_formed_ticket(tmp_path)),
        "--hooks-config", str(cfg),
    ])

    # First cycle halts BLOCKED at create-plan (agent must resume).
    assert exit_code == 1
    assert state_file.exists()
    sub_commands = [c[2] for c in captured if len(c) > 2]
    # No cooperative hooks fire — they were removed.
    assert "turn-check" not in sub_commands
    assert "heartbeat" not in sub_commands
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
