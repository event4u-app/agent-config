"""ManualClient — copy-paste transport for council members (Phase 2b)."""

from __future__ import annotations

import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council.clients import (  # noqa: E402
    MANUAL_END_MARKER,
    CouncilResponse,
    ExternalAIClient,
    ManualClient,
    _read_until_marker,
)


def _make(stdin_text: str) -> tuple[ManualClient, io.StringIO]:
    out = io.StringIO()
    cli = ManualClient(
        name="manual-anthropic",
        model="claude.ai-web",
        provider_label="Claude.ai",
        stdin=io.StringIO(stdin_text),
        stdout=out,
    )
    return cli, out


# ── ABC + flags ────────────────────────────────────────────────────────────


def test_manualclient_subclasses_external_ai_client():
    cli = ManualClient(stdin=io.StringIO(""), stdout=io.StringIO())
    assert isinstance(cli, ExternalAIClient)


def test_manualclient_is_not_billable():
    assert ManualClient.billable is False
    cli = ManualClient(stdin=io.StringIO(""), stdout=io.StringIO())
    assert cli.billable is False


# ── _read_until_marker ─────────────────────────────────────────────────────


def test_read_until_marker_strips_marker_line():
    body = _read_until_marker(io.StringIO("a\nb\nEND\nignored\n"), "END")
    assert body == "a\nb"


def test_read_until_marker_eof_returns_collected():
    body = _read_until_marker(io.StringIO("only line\n"), "END")
    assert body == "only line"


def test_read_until_marker_empty_input():
    assert _read_until_marker(io.StringIO(""), "END") == ""


# ── happy path: one round, "next member" ────────────────────────────────────


def test_ask_one_round_then_next_returns_reply():
    stdin = "model reply line 1\nmodel reply line 2\nEND\n2\n"
    cli, out = _make(stdin)
    res = cli.ask("SYSTEM", "USER")
    assert isinstance(res, CouncilResponse)
    assert res.error is None
    assert "model reply line 1" in res.text
    assert "model reply line 2" in res.text
    assert res.metadata["rounds"] == 1
    assert res.metadata["manual"] is True
    # The rendered block must contain both system and user prompt for paste.
    assert "SYSTEM" in out.getvalue()
    assert "USER" in out.getvalue()


# ── follow-up loop: round 1 → "more" → follow-up → round 2 → "next" ───────


def test_ask_follow_up_loop_collects_two_rounds():
    stdin = (
        "first reply\nEND\n"      # round 1 paste
        "1\n"                      # menu: more feedback
        "follow-up Q\nEND\n"      # follow-up text
        "second reply\nEND\n"     # round 2 paste
        "2\n"                      # menu: next member
    )
    cli, out = _make(stdin)
    res = cli.ask("SYSTEM", "USER")
    assert res.error is None
    assert "first reply" in res.text
    assert "[follow-up sent]" in res.text
    assert "second reply" in res.text
    assert res.metadata["rounds"] == 3  # reply, follow-up echo, reply
    # Follow-up rendering must announce the same chat thread.
    assert "SAME chat thread" in out.getvalue()


# ── abort path ─────────────────────────────────────────────────────────────


def test_ask_abort_sets_error_and_empty_text():
    stdin = "first reply\nEND\n3\n"
    cli, _ = _make(stdin)
    res = cli.ask("SYSTEM", "USER")
    assert res.error == "manual_aborted"
    assert res.text == ""
    assert res.metadata["rounds"] == 1


# ── bad menu input falls back to "next" (never blocks) ─────────────────────


def test_ask_unknown_menu_choice_treated_as_next():
    stdin = "reply\nEND\nxyz\n"
    cli, _ = _make(stdin)
    res = cli.ask("SYSTEM", "USER")
    assert res.error is None
    assert "reply" in res.text


# ── follow-up empty body terminates gracefully ─────────────────────────────


def test_empty_follow_up_terminates_member():
    stdin = (
        "first reply\nEND\n"
        "1\n"
        "\nEND\n"   # empty follow-up
    )
    cli, _ = _make(stdin)
    res = cli.ask("SYSTEM", "USER")
    assert res.error is None
    assert "first reply" in res.text


# ── end marker constant is exported and usable ─────────────────────────────


def test_manual_end_marker_constant():
    assert MANUAL_END_MARKER == "END"
