"""Tests for the ``work_engine`` CLI entrypoint.

The CLI is a thin transport over ``dispatch``: load state, run one
cycle, persist, print. These tests exercise the happy path and
every documented exit code.
"""
from __future__ import annotations

import json
import sys
import types
from pathlib import Path

import pytest

from work_engine import main


@pytest.fixture()
def fake_memory_lookup(monkeypatch):
    """Stub ``memory_lookup.retrieve`` so the CLI runs without disk I/O."""
    stub = types.ModuleType("memory_lookup")
    stub.retrieve = lambda types_, keys, limit: []
    monkeypatch.setitem(sys.modules, "memory_lookup", stub)
    return stub


def _write_ticket(tmp_path: Path) -> Path:
    ticket_path = tmp_path / "ticket.json"
    ticket_path.write_text(
        json.dumps(
            {
                "id": "TICKET-777",
                "title": "Add CSV export",
                "acceptance_criteria": [
                    "User can download the table as CSV from the dashboard.",
                ],
            },
        ),
        encoding="utf-8",
    )
    return ticket_path


def test_fresh_run_halts_with_create_plan_directive(
    tmp_path: Path, capsys, fake_memory_lookup,
) -> None:
    """First invocation builds state from ticket-file and halts at plan."""
    ticket = _write_ticket(tmp_path)
    state_file = tmp_path / "state.json"

    exit_code = main([
        "--state-file", str(state_file),
        "--ticket-file", str(ticket),
    ])

    assert exit_code == 1  # BLOCKED
    stdout = capsys.readouterr().out
    assert "@agent-directive: create-plan" in stdout
    assert "[halt] outcome=blocked step=plan" in stdout
    # State persisted with the halting step's outcome + questions.
    persisted = json.loads(state_file.read_text())
    assert persisted["outcomes"]["plan"] == "blocked"
    assert any("create-plan" in q for q in persisted["questions"])


def test_resume_after_agent_populates_plan(
    tmp_path: Path, capsys, fake_memory_lookup,
) -> None:
    """Second invocation picks up where the first halted."""
    ticket = _write_ticket(tmp_path)
    state_file = tmp_path / "state.json"

    main([
        "--state-file", str(state_file),
        "--ticket-file", str(ticket),
    ])
    capsys.readouterr()  # discard first-run output

    # Simulate the agent responding to create-plan: write the slice
    # and mark the step success, then re-invoke.
    persisted = json.loads(state_file.read_text())
    persisted["plan"] = [{"title": "Add /exports route"}]
    persisted["outcomes"]["plan"] = "success"
    state_file.write_text(json.dumps(persisted), encoding="utf-8")

    exit_code = main(["--state-file", str(state_file)])

    assert exit_code == 1  # halts at next agent step (implement)
    stdout = capsys.readouterr().out
    assert "@agent-directive: apply-plan" in stdout


def test_advisory_persona_reaches_success_with_one_plan_rebound(
    tmp_path: Path, capsys, fake_memory_lookup,
) -> None:
    """Advisory skips implement/test/verify; one plan rebound is enough."""
    ticket = _write_ticket(tmp_path)
    state_file = tmp_path / "state.json"

    main([
        "--state-file", str(state_file),
        "--ticket-file", str(ticket),
        "--persona", "advisory",
    ])
    capsys.readouterr()

    persisted = json.loads(state_file.read_text())
    assert persisted["persona"] == "advisory"
    persisted["plan"] = "Outline only"
    persisted["outcomes"]["plan"] = "success"
    state_file.write_text(json.dumps(persisted), encoding="utf-8")

    exit_code = main(["--state-file", str(state_file)])

    assert exit_code == 0  # SUCCESS
    stdout = capsys.readouterr().out
    assert "## Ticket" in stdout
    assert "TICKET-777" in stdout
    assert "## Suggested next commands" not in stdout


def test_missing_ticket_and_no_state_exits_two(tmp_path, capsys) -> None:
    state_file = tmp_path / "nonexistent.json"

    exit_code = main(["--state-file", str(state_file)])

    assert exit_code == 2
    stderr = capsys.readouterr().err
    assert "No state file" in stderr
    assert not state_file.exists()


def test_ticket_file_not_json_exits_two(tmp_path, capsys) -> None:
    bad = tmp_path / "ticket.txt"
    bad.write_text("this is not json")
    state_file = tmp_path / "state.json"

    exit_code = main([
        "--state-file", str(state_file),
        "--ticket-file", str(bad),
    ])

    assert exit_code == 2
    assert "Invalid JSON" in capsys.readouterr().err


def test_ticket_file_must_be_json_object(tmp_path, capsys) -> None:
    bad = tmp_path / "ticket.json"
    bad.write_text('["this", "is", "a", "list"]')
    state_file = tmp_path / "state.json"

    exit_code = main([
        "--state-file", str(state_file),
        "--ticket-file", str(bad),
    ])

    assert exit_code == 2
    assert "must carry a JSON object" in capsys.readouterr().err


def test_invalid_state_file_exits_two(tmp_path, capsys) -> None:
    state_file = tmp_path / "state.json"
    state_file.write_text('{"not_a_field": 1}')

    exit_code = main(["--state-file", str(state_file)])

    assert exit_code == 2
    assert "State file shape is invalid" in capsys.readouterr().err


# --- Prompt-file path (R2 Phase 4) -------------------------------------

def test_prompt_file_fresh_run_halts_for_refine_prompt(
    tmp_path: Path, capsys, fake_memory_lookup,
) -> None:
    """First /work invocation: builds prompt envelope, halts at refine-prompt."""
    prompt_file = tmp_path / "prompt.txt"
    prompt_file.write_text(
        "Add a CSV export endpoint to the audit-log controller",
        encoding="utf-8",
    )
    state_file = tmp_path / "state.json"

    exit_code = main([
        "--state-file", str(state_file),
        "--prompt-file", str(prompt_file),
    ])

    # First pass: AC empty → engine halts with the refine-prompt directive.
    assert exit_code == 1
    stdout = capsys.readouterr().out
    assert "@agent-directive: refine-prompt" in stdout
    assert "[halt] outcome=blocked step=refine" in stdout
    # State persisted as v1 with kind=prompt (no v0 prompt envelope exists).
    persisted = json.loads(state_file.read_text())
    assert persisted["version"] == 1
    assert persisted["input"]["kind"] == "prompt"
    assert persisted["input"]["data"]["raw"].startswith("Add a CSV export")
    assert persisted["input"]["data"]["reconstructed_ac"] == []
    assert persisted["input"]["data"]["assumptions"] == []


def test_prompt_file_and_ticket_file_are_mutually_exclusive(
    tmp_path: Path, capsys,
) -> None:
    """Passing both --ticket-file and --prompt-file is a config error."""
    ticket = _write_ticket(tmp_path)
    prompt_file = tmp_path / "prompt.txt"
    prompt_file.write_text("anything", encoding="utf-8")
    state_file = tmp_path / "state.json"

    exit_code = main([
        "--state-file", str(state_file),
        "--ticket-file", str(ticket),
        "--prompt-file", str(prompt_file),
    ])

    assert exit_code == 2
    assert "mutually exclusive" in capsys.readouterr().err
    assert not state_file.exists()


def test_prompt_file_empty_exits_two(tmp_path: Path, capsys) -> None:
    """Whitespace-only prompt file is rejected by the resolver."""
    prompt_file = tmp_path / "prompt.txt"
    prompt_file.write_text("   \n\t\n", encoding="utf-8")
    state_file = tmp_path / "state.json"

    exit_code = main([
        "--state-file", str(state_file),
        "--prompt-file", str(prompt_file),
    ])

    assert exit_code == 2
    assert "not a valid prompt" in capsys.readouterr().err
    assert not state_file.exists()


def test_prompt_file_missing_exits_two(tmp_path: Path, capsys) -> None:
    """Non-existent --prompt-file path surfaces a clean CLI error."""
    state_file = tmp_path / "state.json"

    exit_code = main([
        "--state-file", str(state_file),
        "--prompt-file", str(tmp_path / "does-not-exist.txt"),
    ])

    assert exit_code == 2
    assert "Cannot read" in capsys.readouterr().err
    assert not state_file.exists()


def test_no_input_error_mentions_both_flags(tmp_path: Path, capsys) -> None:
    """Without state file or input flags, the error names both options."""
    state_file = tmp_path / "nonexistent.json"

    exit_code = main(["--state-file", str(state_file)])

    assert exit_code == 2
    stderr = capsys.readouterr().err
    assert "--ticket-file" in stderr
    assert "--prompt-file" in stderr
