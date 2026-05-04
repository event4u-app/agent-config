"""council_cli — argparse, build_members guards, estimate/run/render shape."""

from __future__ import annotations

import io
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts import council_cli  # noqa: E402
from scripts.ai_council.clients import CouncilResponse, ExternalAIClient  # noqa: E402
from scripts.ai_council.pricing import Price, PriceTable  # noqa: E402


class _StubMember(ExternalAIClient):
    billable = True

    def __init__(self, name: str, model: str, response: CouncilResponse):
        self.name = name
        self.model = model
        self._response = response

    def ask(self, system_prompt: str, user_prompt: str, max_tokens: int = 1024) -> CouncilResponse:
        return self._response


class _ManualStub(ExternalAIClient):
    billable = False

    def __init__(self, name: str = "manual", model: str = "manual"):
        self.name = name
        self.model = model

    def ask(self, system_prompt: str, user_prompt: str, max_tokens: int = 1024) -> CouncilResponse:
        return CouncilResponse(self.name, self.model, "manual reply")


def _fake_table() -> PriceTable:
    return PriceTable(
        last_updated="2026-01-01", currency="USD", unit="per_1M_tokens",
        source="test-fixture",
        prices={
            ("anthropic", "claude-x"): Price("anthropic", "claude-x", 3.0, 15.0),
            ("openai", "gpt-x"): Price("openai", "gpt-x", 2.5, 10.0),
        },
    )


def _ns(**kw):
    import argparse
    return argparse.Namespace(**kw)


# ── argparse ─────────────────────────────────────────────────────────


def test_parser_has_three_subcommands() -> None:
    parser = council_cli.build_parser()
    parsed = parser.parse_args(["estimate", "x.txt"])
    assert parsed.cmd == "estimate" and parsed.question == "x.txt"
    parsed = parser.parse_args(["run", "x.txt", "--output", "o.json"])
    assert parsed.cmd == "run" and parsed.confirm is False and parsed.rounds == 1
    parsed = parser.parse_args(["render", "r.json"])
    assert parsed.cmd == "render"


def test_parser_run_accepts_confirm_and_rounds() -> None:
    parsed = council_cli.build_parser().parse_args(
        ["run", "q.txt", "--output", "o.json", "--confirm", "--rounds", "2"],
    )
    assert parsed.confirm is True and parsed.rounds == 2


# ── build_members guards ─────────────────────────────────────────────


def test_build_members_raises_when_council_disabled() -> None:
    with pytest.raises(council_cli.CouncilDisabledError, match="enabled is false"):
        council_cli.build_members({"ai_council": {"enabled": False}})


def test_build_members_raises_when_no_member_enabled() -> None:
    settings = {"ai_council": {"enabled": True, "members": {
        "anthropic": {"enabled": False}, "openai": {"enabled": False},
    }}}
    with pytest.raises(council_cli.CouncilDisabledError, match="no council member"):
        council_cli.build_members(settings)


# ── cmd_estimate ─────────────────────────────────────────────────────


def test_cmd_estimate_prints_table_no_api_call(tmp_path, capsys) -> None:
    q = tmp_path / "ask.txt"; q.write_text("review this please", encoding="utf-8")
    members = [_StubMember("anthropic", "claude-x",
                           CouncilResponse("anthropic", "claude-x", "x"))]
    args = _ns(question=str(q), input_mode="prompt", max_tokens=200,
               mode_override=None, original_ask="")
    rc = council_cli.cmd_estimate(args, settings={"ai_council": {"enabled": True}},
                                  members=members, table=_fake_table())
    assert rc == 0
    out = capsys.readouterr().out
    assert "council:estimate" in out and "anthropic/claude-x" in out and "TOTAL:" in out


def test_cmd_estimate_excludes_manual_member_from_billable_count(tmp_path, capsys) -> None:
    q = tmp_path / "ask.txt"; q.write_text("hi", encoding="utf-8")
    members = [_ManualStub(), _StubMember("openai", "gpt-x",
                                          CouncilResponse("openai", "gpt-x", "x"))]
    args = _ns(question=str(q), input_mode="prompt", max_tokens=100,
               mode_override=None, original_ask="")
    council_cli.cmd_estimate(args, settings={"ai_council": {"enabled": True}},
                             members=members, table=_fake_table())
    out = capsys.readouterr().out
    assert "members=2 (billable=1)" in out and "manual" not in out
    assert "openai/gpt-x" in out


# ── cmd_run ──────────────────────────────────────────────────────────


def test_cmd_run_without_confirm_is_estimate_only(tmp_path, capsys) -> None:
    q = tmp_path / "ask.txt"; q.write_text("hi", encoding="utf-8")
    out_path = tmp_path / "out.json"
    members = [_StubMember("openai", "gpt-x",
                           CouncilResponse("openai", "gpt-x", "x"))]
    args = _ns(question=str(q), input_mode="prompt", max_tokens=10,
               mode_override=None, original_ask="", confirm=False,
               output=str(out_path), rounds=1)
    rc = council_cli.cmd_run(args, settings={"ai_council": {"enabled": True}},
                             members=members, table=_fake_table())
    assert rc == 0 and not out_path.exists()
    assert "No --confirm flag" in capsys.readouterr().out



def test_cmd_run_with_confirm_writes_responses_json(tmp_path, capsys) -> None:
    q = tmp_path / "ask.txt"; q.write_text("hello", encoding="utf-8")
    out_path = tmp_path / "session" / "out.json"
    response = CouncilResponse(
        provider="openai", model="gpt-x", text="reply text",
        input_tokens=42, output_tokens=7, latency_ms=10,
    )
    members = [_StubMember("openai", "gpt-x", response)]
    args = _ns(question=str(q), input_mode="prompt", max_tokens=64,
               mode_override=None, original_ask="ship it",
               confirm=True, output=str(out_path), rounds=1)
    rc = council_cli.cmd_run(args, settings={"ai_council": {"enabled": True}},
                             members=members, table=_fake_table())
    assert rc == 0 and out_path.exists()
    payload = json.loads(out_path.read_text(encoding="utf-8"))
    assert payload["schema_version"] == council_cli.SCHEMA_VERSION
    assert payload["mode"] == "prompt"
    assert payload["members"] == ["openai/gpt-x"]
    assert payload["original_ask"] == "ship it"
    assert payload["rounds"] == 1
    assert payload["cost_usd_actual"] > 0
    assert payload["responses"][0]["text"] == "reply text"


def test_cmd_run_with_confirm_returns_1_when_all_members_error(tmp_path) -> None:
    q = tmp_path / "ask.txt"; q.write_text("hi", encoding="utf-8")
    out_path = tmp_path / "out.json"
    err = CouncilResponse(provider="openai", model="gpt-x", text="",
                          error="boom")
    members = [_StubMember("openai", "gpt-x", err)]
    args = _ns(question=str(q), input_mode="prompt", max_tokens=10,
               mode_override=None, original_ask="",
               confirm=True, output=str(out_path), rounds=1)
    rc = council_cli.cmd_run(args, settings={"ai_council": {"enabled": True}},
                             members=members, table=_fake_table())
    assert rc == 1
    payload = json.loads(out_path.read_text(encoding="utf-8"))
    assert payload["responses"][0]["error"] == "boom"


# ── cmd_render ───────────────────────────────────────────────────────


def test_cmd_render_reads_responses_json_and_prints_markdown(tmp_path, capsys) -> None:
    src = tmp_path / "saved.json"
    src.write_text(json.dumps({
        "responses": [
            {"provider": "openai", "model": "gpt-x", "text": "first reply",
             "input_tokens": 10, "output_tokens": 5, "latency_ms": 1},
            {"provider": "anthropic", "model": "claude-x", "text": "second",
             "input_tokens": 11, "output_tokens": 6, "latency_ms": 2},
        ],
    }), encoding="utf-8")
    args = _ns(responses=str(src))
    rc = council_cli.cmd_render(args)
    assert rc == 0
    out = capsys.readouterr().out
    assert "first reply" in out and "second" in out


# ── main entry point ────────────────────────────────────────────────


def test_main_returns_2_when_council_disabled(tmp_path, monkeypatch, capsys) -> None:
    q = tmp_path / "ask.txt"; q.write_text("hi", encoding="utf-8")
    monkeypatch.setattr(
        council_cli, "load_settings", lambda: {"ai_council": {"enabled": False}},
    )
    rc = council_cli.main(["estimate", str(q)])
    assert rc == 2
    err = capsys.readouterr().err
    assert "enabled is false" in err
