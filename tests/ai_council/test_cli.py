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
    assert parsed.cmd == "run" and parsed.confirm is False and parsed.rounds is None
    parsed = parser.parse_args(["render", "r.json"])
    assert parsed.cmd == "render"


def test_parser_run_accepts_confirm_and_rounds() -> None:
    parsed = council_cli.build_parser().parse_args(
        ["run", "q.txt", "--output", "o.json", "--confirm", "--rounds", "2"],
    )
    assert parsed.confirm is True and parsed.rounds == 2


def test_parser_run_depth_defaults_to_standard() -> None:
    parsed = council_cli.build_parser().parse_args(
        ["run", "q.txt", "--output", "o.json"],
    )
    assert parsed.depth == "standard"


def test_parser_run_accepts_depth_deep() -> None:
    parsed = council_cli.build_parser().parse_args(
        ["run", "q.txt", "--output", "o.json", "--depth", "deep"],
    )
    assert parsed.depth == "deep"


# ── --prompt-mode lens override ──────────────────────────────────────


def test_parser_prompt_mode_defaults_to_none() -> None:
    parsed = council_cli.build_parser().parse_args(["estimate", "q.txt"])
    assert parsed.prompt_mode is None


@pytest.mark.parametrize("lens", ["pr", "design", "optimize", "analysis"])
def test_parser_prompt_mode_accepts_known_lenses(lens: str) -> None:
    parsed = council_cli.build_parser().parse_args(
        ["estimate", "q.txt", "--prompt-mode", lens],
    )
    assert parsed.prompt_mode == lens


def test_parser_prompt_mode_rejects_unknown_lens(capsys: pytest.CaptureFixture[str]) -> None:
    with pytest.raises(SystemExit):
        council_cli.build_parser().parse_args(
            ["estimate", "q.txt", "--prompt-mode", "bogus"],
        )
    err = capsys.readouterr().err
    assert "invalid choice" in err and "bogus" in err


def test_build_question_lens_override_swaps_question_mode(tmp_path: Path) -> None:
    q = tmp_path / "q.md"
    q.write_text("body", encoding="utf-8")
    # Baseline: prompt input mode → question.mode == "prompt".
    question, _ = council_cli.build_question(
        input_path=q, input_mode="prompt", max_tokens=128,
    )
    assert question.mode == "prompt"
    # Override flips the lens addendum without touching the bundle.
    question_overridden, _ = council_cli.build_question(
        input_path=q, input_mode="prompt", max_tokens=128,
        prompt_mode_override="analysis",
    )
    assert question_overridden.mode == "analysis"
    assert question_overridden.user_prompt == question.user_prompt


# ── _resolve_rounds resolution chain ─────────────────────────────────


def test_resolve_rounds_defaults_to_min_rounds() -> None:
    args = _ns(rounds=None, depth="standard")
    assert council_cli._resolve_rounds(args, {"min_rounds": 2}) == 2


def test_resolve_rounds_depth_deep_uses_deep_min_rounds() -> None:
    args = _ns(rounds=None, depth="deep")
    cfg = {"min_rounds": 2, "deep_min_rounds": 3}
    assert council_cli._resolve_rounds(args, cfg) == 3


def test_resolve_rounds_explicit_rounds_wins_over_depth_deep() -> None:
    args = _ns(rounds=1, depth="deep")
    cfg = {"min_rounds": 2, "deep_min_rounds": 3}
    assert council_cli._resolve_rounds(args, cfg) == 1


def test_resolve_rounds_deep_floored_at_min_rounds() -> None:
    """Defensive max: misconfigured deep_min_rounds < min_rounds is ignored."""
    args = _ns(rounds=None, depth="deep")
    cfg = {"min_rounds": 3, "deep_min_rounds": 1}
    assert council_cli._resolve_rounds(args, cfg) == 3


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


# ── --siblings parser + build_members fan-out ────────────────────────


def test_parse_siblings_overrides_accepts_two_models() -> None:
    out = council_cli._parse_siblings_overrides(
        ["anthropic=claude-sonnet-4-5,claude-opus-4-1"],
    )
    assert out == {"anthropic": ["claude-sonnet-4-5", "claude-opus-4-1"]}


def test_parse_siblings_overrides_rejects_single_model() -> None:
    import argparse as ap
    with pytest.raises(ap.ArgumentTypeError, match="≥ 2 distinct"):
        council_cli._parse_siblings_overrides(["anthropic=claude-sonnet-4-5"])


def test_parse_siblings_overrides_rejects_duplicate_models() -> None:
    import argparse as ap
    with pytest.raises(ap.ArgumentTypeError, match="≥ 2 distinct"):
        council_cli._parse_siblings_overrides(
            ["anthropic=claude-sonnet-4-5,claude-sonnet-4-5"],
        )


def test_parse_siblings_overrides_rejects_repeated_provider() -> None:
    import argparse as ap
    with pytest.raises(ap.ArgumentTypeError, match="repeated"):
        council_cli._parse_siblings_overrides([
            "anthropic=a,b", "anthropic=c,d",
        ])


def test_parse_siblings_overrides_rejects_missing_equals() -> None:
    import argparse as ap
    with pytest.raises(ap.ArgumentTypeError, match="expects"):
        council_cli._parse_siblings_overrides(["anthropic-a-b"])


def test_build_members_siblings_unknown_provider_raises(monkeypatch) -> None:
    settings = {"ai_council": {"enabled": True, "mode": "api", "members": {
        "anthropic": {"enabled": True, "model": "claude-sonnet-4-5"},
    }}}
    with pytest.raises(council_cli.CouncilDisabledError, match="unknown member"):
        council_cli.build_members(
            settings, siblings_overrides={"openai": ["gpt-4o", "o1"]},
        )


def test_build_members_siblings_disabled_provider_raises(monkeypatch) -> None:
    settings = {"ai_council": {"enabled": True, "mode": "api", "members": {
        "anthropic": {"enabled": False, "model": "claude-sonnet-4-5"},
    }}}
    with pytest.raises(council_cli.CouncilDisabledError, match="not.*enabled"):
        council_cli.build_members(
            settings,
            siblings_overrides={"anthropic": ["claude-sonnet-4-5", "claude-opus-4-1"]},
        )


def test_build_members_siblings_conflicts_with_model_override() -> None:
    settings = {"ai_council": {"enabled": True, "mode": "api", "members": {
        "anthropic": {"enabled": True, "model": "claude-sonnet-4-5"},
    }}}
    with pytest.raises(council_cli.CouncilDisabledError, match="same member"):
        council_cli.build_members(
            settings,
            model_overrides={"anthropic": "claude-opus-4-1"},
            siblings_overrides={"anthropic": ["claude-sonnet-4-5", "claude-opus-4-1"]},
        )


def test_build_members_siblings_rejects_manual_mode() -> None:
    settings = {"ai_council": {"enabled": True, "mode": "manual", "members": {
        "anthropic": {"enabled": True, "mode": "manual"},
    }}}
    with pytest.raises(council_cli.CouncilDisabledError, match="mode=api"):
        council_cli.build_members(
            settings,
            siblings_overrides={"anthropic": ["claude-sonnet-4-5", "claude-opus-4-1"]},
        )


def test_build_members_siblings_fans_out_to_n_clients(monkeypatch) -> None:
    monkeypatch.setattr(council_cli, "load_anthropic_key", lambda: "sk-ant-test")
    constructed: list[tuple[str, str]] = []

    class _FakeAnthropic:
        name = "anthropic"
        billable = True

        def __init__(self, model: str, api_key: str | None = None):
            self.model = model
            constructed.append(("anthropic", model))

        def ask(self, *a, **kw):  # pragma: no cover
            return CouncilResponse("anthropic", self.model, "x")

    monkeypatch.setattr(council_cli, "AnthropicClient", _FakeAnthropic)
    settings = {"ai_council": {"enabled": True, "mode": "api", "members": {
        "anthropic": {"enabled": True, "model": "claude-sonnet-4-5"},
    }}}
    members = council_cli.build_members(
        settings,
        siblings_overrides={"anthropic": ["claude-sonnet-4-5", "claude-opus-4-1"]},
    )
    assert len(members) == 2
    assert [m.model for m in members] == ["claude-sonnet-4-5", "claude-opus-4-1"]
    assert all(m.name == "anthropic" for m in members)
    assert constructed == [
        ("anthropic", "claude-sonnet-4-5"),
        ("anthropic", "claude-opus-4-1"),
    ]


def test_parser_accepts_siblings_flag() -> None:
    parsed = council_cli.build_parser().parse_args([
        "estimate", "q.txt",
        "--siblings", "anthropic=claude-sonnet-4-5,claude-opus-4-1",
    ])
    assert parsed.siblings == ["anthropic=claude-sonnet-4-5,claude-opus-4-1"]


# ── build_members — cli mode dispatch (Phase 2 Step 2) ────────────────


def test_build_members_dispatches_cli_anthropic(monkeypatch) -> None:
    """mode=cli for a known CLI provider builds an AnthropicCliClient."""
    constructed: list[dict] = []

    class _FakeCli:
        name = "anthropic"
        billable = False

        def __init__(self, *, model, binary=None, max_calls_per_day=None):
            self.model = model
            self.binary = binary or "/bin/claude"
            constructed.append({
                "model": model, "binary": binary,
                "max_calls_per_day": max_calls_per_day,
            })

        def ask(self, *a, **kw):  # pragma: no cover
            return CouncilResponse("anthropic", self.model, "x")

    monkeypatch.setattr(council_cli, "AnthropicCliClient", _FakeCli)
    settings = {"ai_council": {
        "enabled": True, "mode": "api",
        "cli_call_budget": {"max_calls_per_day": {"anthropic": 50}},
        "members": {
            "anthropic": {
                "enabled": True, "mode": "cli",
                "model": "claude-sonnet-4-5",
                "binary": "/opt/claude",
            },
        },
    }}
    members = council_cli.build_members(settings)
    assert len(members) == 1
    assert members[0].name == "anthropic"
    assert constructed == [{
        "model": "claude-sonnet-4-5",
        "binary": "/opt/claude",
        "max_calls_per_day": 50,
    }]


def test_build_members_cli_unknown_provider_raises() -> None:
    """mode=cli for a provider without a wired CLI subclass raises.

    `xai` and `perplexity` are scheduled for Phase 4; until then they
    are valid `mode=api` providers but have no CLI transport — the
    loader must surface that explicitly, not silently fall through.
    """
    settings = {"ai_council": {"enabled": True, "mode": "api", "members": {
        "xai": {"enabled": True, "mode": "cli", "model": "grok-4"},
    }}}
    with pytest.raises(council_cli.CouncilDisabledError, match="no CLI client is\\s+wired"):
        council_cli.build_members(settings)


def test_build_members_cli_binary_missing_wraps_cli_error(monkeypatch) -> None:
    """CliClientError at construction time becomes CouncilDisabledError."""
    from scripts.ai_council.clients import CliClientError

    def _raise(**kw):
        raise CliClientError("binary 'claude' not found on PATH")

    monkeypatch.setattr(council_cli, "AnthropicCliClient", _raise)
    settings = {"ai_council": {"enabled": True, "mode": "api", "members": {
        "anthropic": {"enabled": True, "mode": "cli", "model": "claude-sonnet-4-5"},
    }}}
    with pytest.raises(council_cli.CouncilDisabledError, match="binary is\\s+not available"):
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


def test_cmd_run_resolves_rounds_from_min_rounds_setting(tmp_path) -> None:
    q = tmp_path / "ask.txt"; q.write_text("hello", encoding="utf-8")
    out_path = tmp_path / "out.json"
    response = CouncilResponse(provider="openai", model="gpt-x", text="r",
                               input_tokens=4, output_tokens=2, latency_ms=1)
    members = [_StubMember("openai", "gpt-x", response)]
    args = _ns(question=str(q), input_mode="prompt", max_tokens=16,
               mode_override=None, original_ask="",
               confirm=True, output=str(out_path), rounds=None)
    rc = council_cli.cmd_run(
        args,
        settings={"ai_council": {"enabled": True, "min_rounds": 3}},
        members=members, table=_fake_table(),
    )
    assert rc == 0
    payload = json.loads(out_path.read_text(encoding="utf-8"))
    assert payload["rounds"] == 3


def test_cmd_run_defaults_to_two_rounds_when_min_rounds_unset(tmp_path) -> None:
    q = tmp_path / "ask.txt"; q.write_text("hi", encoding="utf-8")
    out_path = tmp_path / "out.json"
    response = CouncilResponse(provider="openai", model="gpt-x", text="r",
                               input_tokens=4, output_tokens=2, latency_ms=1)
    members = [_StubMember("openai", "gpt-x", response)]
    args = _ns(question=str(q), input_mode="prompt", max_tokens=16,
               mode_override=None, original_ask="",
               confirm=True, output=str(out_path), rounds=None)
    rc = council_cli.cmd_run(
        args,
        settings={"ai_council": {"enabled": True}},
        members=members, table=_fake_table(),
    )
    assert rc == 0
    payload = json.loads(out_path.read_text(encoding="utf-8"))
    assert payload["rounds"] == 2


def test_cmd_run_explicit_rounds_overrides_min_rounds_setting(tmp_path) -> None:
    q = tmp_path / "ask.txt"; q.write_text("hi", encoding="utf-8")
    out_path = tmp_path / "out.json"
    response = CouncilResponse(provider="openai", model="gpt-x", text="r",
                               input_tokens=4, output_tokens=2, latency_ms=1)
    members = [_StubMember("openai", "gpt-x", response)]
    args = _ns(question=str(q), input_mode="prompt", max_tokens=16,
               mode_override=None, original_ask="",
               confirm=True, output=str(out_path), rounds=1)
    rc = council_cli.cmd_run(
        args,
        settings={"ai_council": {"enabled": True, "min_rounds": 3}},
        members=members, table=_fake_table(),
    )
    assert rc == 0
    payload = json.loads(out_path.read_text(encoding="utf-8"))
    assert payload["rounds"] == 1


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



# ── cmd_render — lens-aware synthesis (Phase 3 / F2) ────────────────


def _two_response_payload(**extra) -> dict:
    payload = {
        "responses": [
            {"provider": "openai", "model": "gpt-x", "text": "first reply",
             "input_tokens": 10, "output_tokens": 5, "latency_ms": 1},
            {"provider": "anthropic", "model": "claude-x", "text": "second",
             "input_tokens": 11, "output_tokens": 6, "latency_ms": 2},
        ],
    }
    payload.update(extra)
    return payload


def test_parser_render_accepts_prompt_mode_and_prose_flags() -> None:
    parsed = council_cli.build_parser().parse_args(
        ["render", "r.json", "--prompt-mode", "pr", "--prose-synthesis"],
    )
    assert parsed.cmd == "render"
    assert parsed.prompt_mode == "pr"
    assert parsed.prose_synthesis is True


def test_parser_render_no_prose_synthesis_flag_sets_false() -> None:
    parsed = council_cli.build_parser().parse_args(
        ["render", "r.json", "--prompt-mode", "design", "--no-prose-synthesis"],
    )
    assert parsed.prose_synthesis is False


def test_parser_render_prose_flags_are_mutually_exclusive() -> None:
    with pytest.raises(SystemExit):
        council_cli.build_parser().parse_args(
            ["render", "r.json", "--prose-synthesis", "--no-prose-synthesis"],
        )


def test_cmd_render_uses_payload_prompt_mode_when_no_flag(tmp_path, capsys) -> None:
    src = tmp_path / "saved.json"
    src.write_text(json.dumps(_two_response_payload(prompt_mode="analysis")),
                   encoding="utf-8")
    args = _ns(responses=str(src), prompt_mode=None, prose_synthesis=None)
    rc = council_cli.cmd_render(args)
    assert rc == 0
    out = capsys.readouterr().out
    assert "### Top-10 by consensus" in out
    assert "### Outliers" in out


def test_cmd_render_explicit_prompt_mode_overrides_payload(tmp_path, capsys) -> None:
    src = tmp_path / "saved.json"
    src.write_text(json.dumps(_two_response_payload(prompt_mode="analysis")),
                   encoding="utf-8")
    args = _ns(responses=str(src), prompt_mode="pr", prose_synthesis=None)
    rc = council_cli.cmd_render(args)
    assert rc == 0
    out = capsys.readouterr().out
    assert "### Consensus" in out
    assert "### Must-fix before merge" in out
    assert "### Top-10 by consensus" not in out


def test_cmd_render_payload_mode_field_used_as_fallback(tmp_path, capsys) -> None:
    src = tmp_path / "saved.json"
    src.write_text(json.dumps(_two_response_payload(mode="pr")), encoding="utf-8")
    args = _ns(responses=str(src), prompt_mode=None, prose_synthesis=None)
    rc = council_cli.cmd_render(args)
    assert rc == 0
    out = capsys.readouterr().out
    assert "### Consensus" in out


def test_cmd_render_prose_synthesis_flag_forces_passthrough(tmp_path, capsys) -> None:
    src = tmp_path / "saved.json"
    src.write_text(json.dumps(_two_response_payload(prompt_mode="pr")),
                   encoding="utf-8")
    args = _ns(responses=str(src), prompt_mode=None, prose_synthesis=True)
    rc = council_cli.cmd_render(args)
    assert rc == 0
    out = capsys.readouterr().out
    assert "*to be summarised by the host agent*" in out
    assert "### Consensus" not in out


def test_cmd_render_no_prose_synthesis_flag_forces_structured(tmp_path, capsys) -> None:
    src = tmp_path / "saved.json"
    src.write_text(json.dumps(_two_response_payload(prompt_mode="design")),
                   encoding="utf-8")
    args = _ns(responses=str(src), prompt_mode=None, prose_synthesis=False)
    rc = council_cli.cmd_render(args)
    assert rc == 0
    out = capsys.readouterr().out
    assert "### Agreement" in out
    assert "*to be summarised by the host agent*" not in out


def test_cmd_render_payload_prose_synthesis_honoured(tmp_path, capsys) -> None:
    src = tmp_path / "saved.json"
    src.write_text(
        json.dumps(_two_response_payload(prompt_mode="pr", prose_synthesis=True)),
        encoding="utf-8",
    )
    args = _ns(responses=str(src), prompt_mode=None, prose_synthesis=None)
    rc = council_cli.cmd_render(args)
    assert rc == 0
    out = capsys.readouterr().out
    assert "*to be summarised by the host agent*" in out


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
