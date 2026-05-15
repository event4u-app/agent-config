"""Step-8 Phase 5 — ``agent-config council quota`` subcommand tests.

Covers the user-facing entrypoint:

- Dump path prints one ``council:quota · <provider> · used/limit · status``
  line per provider that has a configured cap; ``ok`` / ``warn`` /
  ``exhausted`` statuses follow ``warn_at`` and the limit.
- ``--reset <provider>`` without ``--confirm`` refuses (exit 2,
  stderr) and the state file is untouched.
- ``--reset <provider> --confirm`` clears that provider only; other
  providers' counters and the UTC date marker stay intact.
- No configured caps → a single line explaining the empty state
  (exit 0, no crash).

Tests bypass argparse by calling :func:`cmd_quota` with a typed
``Namespace``. The state file is redirected via
``monkeypatch`` on ``_cli_calls_state_path`` so no temp dirs are leaked
into the developer's ``~/.event4u/agent-config/``.
"""
from __future__ import annotations

import argparse
import io
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts import council_cli  # noqa: E402
from scripts.ai_council import clients as clients_mod  # noqa: E402


def _write_state(path: Path, counts: dict[str, int]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps({
            "date": datetime.now(timezone.utc).date().isoformat(),
            "counts": counts,
        }),
        encoding="utf-8",
    )


@pytest.fixture()
def _state_file(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> Path:
    state = tmp_path / "cli-calls.json"
    monkeypatch.setattr(
        clients_mod, "_cli_calls_state_path", lambda: state,
    )
    return state


def _ns(**kwargs) -> argparse.Namespace:
    base = {"cmd": "quota", "reset": None, "confirm": False}
    base.update(kwargs)
    return argparse.Namespace(**base)


def test_dump_lists_one_line_per_capped_provider(
    _state_file: Path, capsys: pytest.CaptureFixture[str],
) -> None:
    _write_state(_state_file, {"anthropic": 5, "openai": 45})
    settings = {"ai_council": {"cli_call_budget": {
        "max_calls_per_day": {"anthropic": 30, "openai": 50},
        "warn_at": 0.8,
    }}}
    rc = council_cli.cmd_quota(_ns(), settings=settings)
    out = capsys.readouterr().out
    assert rc == 0
    assert "council:quota · anthropic · 5/30 · ok" in out
    assert "council:quota · openai · 45/50 · warn" in out


def test_dump_marks_exhausted_when_used_meets_limit(
    _state_file: Path, capsys: pytest.CaptureFixture[str],
) -> None:
    _write_state(_state_file, {"anthropic": 30})
    settings = {"ai_council": {"cli_call_budget": {
        "max_calls_per_day": {"anthropic": 30}, "warn_at": 0.8,
    }}}
    rc = council_cli.cmd_quota(_ns(), settings=settings)
    out = capsys.readouterr().out
    assert rc == 0
    assert "council:quota · anthropic · 30/30 · exhausted" in out


def test_dump_with_no_configured_caps_prints_explainer(
    _state_file: Path, capsys: pytest.CaptureFixture[str],
) -> None:
    settings = {"ai_council": {"cli_call_budget": {}}}
    rc = council_cli.cmd_quota(_ns(), settings=settings)
    out = capsys.readouterr().out
    assert rc == 0
    assert "no providers have a configured" in out


def test_reset_without_confirm_refuses_and_leaves_state(
    _state_file: Path, capsys: pytest.CaptureFixture[str],
) -> None:
    _write_state(_state_file, {"anthropic": 5, "openai": 7})
    settings = {"ai_council": {"cli_call_budget": {
        "max_calls_per_day": {"anthropic": 30},
    }}}
    rc = council_cli.cmd_quota(
        _ns(reset="anthropic", confirm=False), settings=settings,
    )
    captured = capsys.readouterr()
    assert rc == 2
    assert "requires --confirm" in captured.err
    # State file untouched.
    on_disk = json.loads(_state_file.read_text(encoding="utf-8"))
    assert on_disk["counts"] == {"anthropic": 5, "openai": 7}


def test_reset_with_confirm_clears_one_provider_only(
    _state_file: Path, capsys: pytest.CaptureFixture[str],
) -> None:
    _write_state(_state_file, {"anthropic": 5, "openai": 7})
    settings = {"ai_council": {"cli_call_budget": {
        "max_calls_per_day": {"anthropic": 30, "openai": 50},
    }}}
    rc = council_cli.cmd_quota(
        _ns(reset="anthropic", confirm=True), settings=settings,
    )
    out = capsys.readouterr().out
    assert rc == 0
    assert "council:quota · reset · anthropic" in out
    on_disk = json.loads(_state_file.read_text(encoding="utf-8"))
    # Anthropic dropped; openai survives; UTC date marker preserved.
    assert "anthropic" not in on_disk["counts"]
    assert on_disk["counts"].get("openai") == 7
    assert on_disk["date"] == datetime.now(timezone.utc).date().isoformat()


def test_reset_confirm_on_missing_state_is_a_noop(
    _state_file: Path, capsys: pytest.CaptureFixture[str],
) -> None:
    settings = {"ai_council": {"cli_call_budget": {
        "max_calls_per_day": {"anthropic": 30},
    }}}
    rc = council_cli.cmd_quota(
        _ns(reset="anthropic", confirm=True), settings=settings,
    )
    assert rc == 0
    assert "reset · anthropic" in capsys.readouterr().out
    # The reset path creates the file with an empty counts dict.
    on_disk = json.loads(_state_file.read_text(encoding="utf-8"))
    assert on_disk["counts"] == {}
