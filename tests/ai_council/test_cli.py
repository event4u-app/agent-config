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


# ── --single flag (step-9 P9) ────────────────────────────────────────


def test_parser_run_single_defaults_to_false() -> None:
    parsed = council_cli.build_parser().parse_args(
        ["run", "q.txt", "--output", "o.json"],
    )
    assert parsed.single is False


def test_parser_run_accepts_single() -> None:
    parsed = council_cli.build_parser().parse_args(
        ["run", "q.txt", "--output", "o.json", "--single"],
    )
    assert parsed.single is True


def _solo_cfg(members_dict, chain):
    from scripts.ai_council import config as cfg_mod
    return cfg_mod.CouncilConfig(
        enabled=True,
        defaults=cfg_mod.DefaultsConfig(),
        cost_budget=cfg_mod.CostBudgetConfig(),
        members=members_dict,
        routing=cfg_mod.RoutingConfig(solo_member_fallback_chain=chain),
    )


def _solo_member(name: str, model: str):
    from scripts.ai_council import config as cfg_mod
    return cfg_mod.MemberConfig(
        name=name, enabled=True, model=model, api_key_ref=None,
    )


def test_apply_solo_dispatch_filters_members_to_chain_pick(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    members_runtime = [
        _StubMember("anthropic", "claude-x", CouncilResponse("anthropic", "x", "")),
        _StubMember("openai", "gpt-x", CouncilResponse("openai", "x", "")),
    ]
    fake_cfg = _solo_cfg(
        {
            "anthropic": _solo_member("anthropic", "claude-x"),
            "openai": _solo_member("openai", "gpt-x"),
        },
        ("openai", "anthropic"),
    )
    monkeypatch.setattr(council_cli, "load_council_config", lambda _p: fake_cfg)
    monkeypatch.delenv("AGENT_CONFIG_FORCE_FULL_COUNCIL", raising=False)

    filtered, banner = council_cli._apply_solo_dispatch(members_runtime)

    assert [m.name for m in filtered] == ["openai"]
    assert banner is not None and "openai" in banner


def test_apply_solo_dispatch_empty_chain_returns_full_with_warn(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    members_runtime = [
        _StubMember("anthropic", "claude-x", CouncilResponse("anthropic", "x", "")),
    ]
    fake_cfg = _solo_cfg(
        {"anthropic": _solo_member("anthropic", "claude-x")},
        (),
    )
    monkeypatch.setattr(council_cli, "load_council_config", lambda _p: fake_cfg)
    monkeypatch.delenv("AGENT_CONFIG_FORCE_FULL_COUNCIL", raising=False)

    filtered, banner = council_cli._apply_solo_dispatch(members_runtime)

    assert filtered is members_runtime
    assert banner is not None and "WARN" in banner


def test_apply_solo_dispatch_force_full_env_returns_unfiltered(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    members_runtime = [
        _StubMember("anthropic", "claude-x", CouncilResponse("anthropic", "x", "")),
        _StubMember("openai", "gpt-x", CouncilResponse("openai", "x", "")),
    ]
    fake_cfg = _solo_cfg(
        {
            "anthropic": _solo_member("anthropic", "claude-x"),
            "openai": _solo_member("openai", "gpt-x"),
        },
        ("openai", "anthropic"),
    )
    monkeypatch.setattr(council_cli, "load_council_config", lambda _p: fake_cfg)
    monkeypatch.setenv("AGENT_CONFIG_FORCE_FULL_COUNCIL", "1")

    filtered, _banner = council_cli._apply_solo_dispatch(members_runtime)

    assert [m.name for m in filtered] == ["anthropic", "openai"]


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

        def __init__(
            self, *, model, binary=None, max_calls_per_day=None,
            warn_at=0.8,
        ):
            self.model = model
            self.binary = binary or "/bin/claude"
            constructed.append({
                "model": model, "binary": binary,
                "max_calls_per_day": max_calls_per_day,
                "warn_at": warn_at,
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
        "warn_at": 0.8,
    }]


def test_build_members_cli_map_closed_for_all_providers(monkeypatch) -> None:
    """Phase 4 Step 4 — `mode: cli` is wired for every supported provider.

    Originally this test asserted that `xai` / `perplexity` raised
    `no CLI client is wired`. Phase 4 closes the map (all five
    providers route to a CliClient subclass), so the contract flips:
    `mode: cli` now constructs the client successfully. The negative
    path that survives is the binary-missing one, covered by the
    following test.
    """
    from scripts.ai_council.clients import PerplexityCliClient, XAICliClient

    constructed: list[tuple[str, dict[str, object]]] = []

    def fake_xai(**kw):
        constructed.append(("xai", kw))
        return _StubMember("xai", kw.get("model", "grok-4"),
                           CouncilResponse("xai", kw.get("model", "grok-4"), "x"))

    def fake_perplexity(**kw):
        constructed.append(("perplexity", kw))
        return _StubMember("perplexity", kw.get("model", "sonar-pro"),
                           CouncilResponse("perplexity", kw.get("model", "sonar-pro"), "x"))

    monkeypatch.setattr(council_cli, "XAICliClient", fake_xai)
    monkeypatch.setattr(council_cli, "PerplexityCliClient", fake_perplexity)
    # Sanity: the production classes the loader resolves are the
    # community CLI subclasses, not stubs.
    assert XAICliClient is not None
    assert PerplexityCliClient is not None

    settings = {"ai_council": {"enabled": True, "mode": "api", "members": {
        "xai": {"enabled": True, "mode": "cli", "model": "grok-4"},
        "perplexity": {"enabled": True, "mode": "cli", "model": "sonar-pro"},
    }}}
    members = council_cli.build_members(settings)
    assert {m.name for m in members} == {"xai", "perplexity"}
    assert {entry[0] for entry in constructed} == {"xai", "perplexity"}


@pytest.mark.parametrize(
    ("provider", "factory_attr", "binary_name"),
    [
        ("anthropic", "AnthropicCliClient", "claude"),
        ("openai", "OpenAICliClient", "codex"),
        ("gemini", "GeminiCliClient", "gemini"),
        ("xai", "XAICliClient", "grok"),
        ("perplexity", "PerplexityCliClient", "perplexity"),
    ],
)
def test_build_members_cli_binary_missing_skips_member_with_reason(
    monkeypatch, capsys, provider, factory_attr, binary_name,
) -> None:
    """Phase 5 Step 2: missing CLI binary surfaces a structured skip
    entry, prints `[council] SKIP <name>: <detail>` on stderr, and
    raises CouncilDisabledError ONLY when no other member survives.
    Parametrized across all five providers wired in `_CLI_FACTORY`.
    """
    from scripts.ai_council.clients import CliClientError

    def _raise(**kw):
        raise CliClientError(
            f"{factory_attr}: binary {binary_name!r} not found on PATH. "
            f"Install the provider CLI or set "
            f"`members.{provider}.binary:` in agents/.ai-council.yml."
        )

    monkeypatch.setattr(council_cli, factory_attr, _raise)
    settings = {"ai_council": {"enabled": True, "mode": "api", "members": {
        provider: {"enabled": True, "mode": "cli", "model": "model-x"},
    }}}
    skipped: list[dict] = []
    with pytest.raises(
        council_cli.CouncilDisabledError,
        match=r"every enabled\s+member was skipped",
    ):
        council_cli.build_members(settings, skipped=skipped)
    assert len(skipped) == 1
    assert skipped[0]["member"] == provider
    assert skipped[0]["reason"] == "binary_missing"
    assert "not found on PATH" in skipped[0]["detail"]
    err = capsys.readouterr().err
    assert f"[council] SKIP {provider}:" in err


def test_build_members_cli_binary_missing_partial_skip_other_members_survive(
    monkeypatch, capsys,
) -> None:
    """Phase 5 Step 2: when one CLI member's binary is missing but
    another (api-mode) member is enabled, the council still constructs
    — only the unavailable member is logged as skipped.
    """
    from scripts.ai_council.clients import CliClientError

    def _raise(**kw):
        raise CliClientError("binary 'claude' not found on PATH.")

    monkeypatch.setattr(council_cli, "AnthropicCliClient", _raise)
    monkeypatch.setattr(
        council_cli, "load_openai_key", lambda: "sk-test-stub-not-real",
    )

    class _StubOpenAI:
        billable = True
        name = "openai"
        model = "gpt-4o"

        def __init__(self, *, model, api_key):
            self.model = model

    monkeypatch.setattr(council_cli, "OpenAIClient", _StubOpenAI)

    settings = {"ai_council": {"enabled": True, "mode": "api", "members": {
        "anthropic": {"enabled": True, "mode": "cli", "model": "claude-sonnet-4-5"},
        "openai": {"enabled": True, "mode": "api", "model": "gpt-4o"},
    }}}
    skipped: list[dict] = []
    members = council_cli.build_members(settings, skipped=skipped)
    assert [m.name for m in members] == ["openai"]
    assert len(skipped) == 1
    assert skipped[0] == {
        "member": "anthropic",
        "reason": "binary_missing",
        "detail": (
            "binary 'claude' not found on PATH. Install the Claude CLI "
            "or flip ai_council.members.anthropic.mode back to 'api'."
        ),
    }
    err = capsys.readouterr().err
    assert "[council] SKIP anthropic:" in err


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



# ── Phase 6 necessity gate ────────────────────────────────────────────


def test_necessity_gate_off_when_classifier_disabled() -> None:
    buf = io.StringIO()
    proceed, rc, result = council_cli._necessity_gate(
        prompt="fix the typo crash bug",
        lens="analysis",
        invocation="user_explicit",
        proceed_anyway=False,
        ai_cfg={"necessity_classifier": {"enabled": False, "mode": "educate"}},
        stdout=buf,
    )
    assert proceed is True
    assert rc == 0
    assert result is None


def test_necessity_gate_off_when_mode_off() -> None:
    buf = io.StringIO()
    proceed, rc, result = council_cli._necessity_gate(
        prompt="fix the typo crash bug",
        lens="analysis",
        invocation="user_explicit",
        proceed_anyway=False,
        ai_cfg={
            "necessity_classifier": {
                "enabled": True, "mode": "off", "user_explicit_mode": "off",
            },
        },
        stdout=buf,
    )
    assert proceed is True
    assert rc == 0


def test_necessity_gate_agent_skip_is_silent_exit_zero() -> None:
    buf = io.StringIO()
    proceed, rc, _ = council_cli._necessity_gate(
        prompt="fix the typo crash failing test bug",
        lens="analysis",
        invocation="agent",
        proceed_anyway=False,
        ai_cfg={"necessity_classifier": {"enabled": True, "mode": "educate"}},
        stdout=buf,
    )
    assert proceed is False
    assert rc == 0
    assert "skipped" in buf.getvalue()


def test_necessity_gate_user_explicit_educates_and_exits_two() -> None:
    buf = io.StringIO()
    proceed, rc, _ = council_cli._necessity_gate(
        prompt="fix the typo crash failing test bug",
        lens="analysis",
        invocation="user_explicit",
        proceed_anyway=False,
        ai_cfg={
            "necessity_classifier": {
                "enabled": True,
                "mode": "educate",
                "user_explicit_mode": "educate",
            },
        },
        stdout=buf,
    )
    assert proceed is False
    assert rc == 2
    assert "--proceed-anyway" in buf.getvalue()


def test_necessity_gate_proceed_anyway_overrides_educate() -> None:
    buf = io.StringIO()
    proceed, rc, _ = council_cli._necessity_gate(
        prompt="fix the typo crash failing test bug",
        lens="analysis",
        invocation="user_explicit",
        proceed_anyway=True,
        ai_cfg={
            "necessity_classifier": {
                "enabled": True,
                "mode": "educate",
                "user_explicit_mode": "educate",
            },
        },
        stdout=buf,
    )
    assert proceed is True
    assert rc == 0
    assert "override" in buf.getvalue()


def test_necessity_gate_block_mode_ignores_proceed_anyway() -> None:
    buf = io.StringIO()
    proceed, rc, _ = council_cli._necessity_gate(
        prompt="fix the typo crash failing test bug",
        lens="analysis",
        invocation="user_explicit",
        proceed_anyway=True,
        ai_cfg={
            "necessity_classifier": {
                "enabled": True,
                "mode": "block",
                "user_explicit_mode": "block",
            },
        },
        stdout=buf,
    )
    assert proceed is False
    assert rc == 0
    assert "mode=block" in buf.getvalue()


def test_necessity_gate_necessary_verdict_proceeds() -> None:
    buf = io.StringIO()
    proceed, rc, result = council_cli._necessity_gate(
        prompt=(
            "Should we refactor the service boundary? Stakeholders "
            "disagree on the architecture trade-off."
        ),
        lens="analysis",
        invocation="agent",
        proceed_anyway=False,
        ai_cfg={"necessity_classifier": {"enabled": True, "mode": "educate"}},
        stdout=buf,
    )
    assert proceed is True
    assert rc == 0
    assert result is not None
    assert result.verdict == "necessary"


def test_resolve_necessity_mode_lens_override_wins() -> None:
    ai_cfg = {
        "necessity_classifier": {"enabled": True, "mode": "educate"},
        "lens_overrides": {
            "necessity_classifier_mode": {"debate": "block"},
        },
    }
    enabled, mode = council_cli._resolve_necessity_mode(ai_cfg, "debate")
    assert enabled is True
    assert mode == "block"
    enabled, mode = council_cli._resolve_necessity_mode(ai_cfg, "analysis")
    assert mode == "educate"


# ── step-8 D2: tier split + warn-only ────────────────────────────────


def test_resolve_necessity_mode_user_explicit_defaults_to_warn_only() -> None:
    """User-explicit tier defaults to warn-only when no override is set."""
    ai_cfg = {"necessity_classifier": {"enabled": True, "mode": "educate"}}
    enabled, mode = council_cli._resolve_necessity_mode(
        ai_cfg, "analysis", invocation="user_explicit",
    )
    assert enabled is True
    assert mode == "warn-only"


def test_resolve_necessity_mode_user_explicit_lens_override_wins() -> None:
    """Per-lens user_explicit_mode override takes precedence."""
    ai_cfg = {
        "necessity_classifier": {
            "enabled": True,
            "mode": "educate",
            "user_explicit_mode": "warn-only",
        },
        "lens_overrides": {
            "necessity_classifier_user_explicit_mode": {"debate": "block"},
        },
    }
    _, mode = council_cli._resolve_necessity_mode(
        ai_cfg, "debate", invocation="user_explicit",
    )
    assert mode == "block"
    _, mode = council_cli._resolve_necessity_mode(
        ai_cfg, "analysis", invocation="user_explicit",
    )
    assert mode == "warn-only"


def test_necessity_gate_warn_only_proceeds_with_annotation() -> None:
    """warn-only emits a council:necessity line but never blocks."""
    buf = io.StringIO()
    proceed, rc, result = council_cli._necessity_gate(
        prompt="fix the typo crash failing test bug",
        lens="analysis",
        invocation="user_explicit",
        proceed_anyway=False,
        ai_cfg={
            "necessity_classifier": {
                "enabled": True,
                "mode": "educate",
                "user_explicit_mode": "warn-only",
            },
        },
        stdout=buf,
    )
    assert proceed is True
    assert rc == 0
    assert result is not None
    assert result.verdict == "unnecessary"
    assert "warn-only" in buf.getvalue()


def test_necessity_gate_agent_tier_unaffected_by_user_explicit_mode() -> None:
    """Agent invocation still uses `mode`, not `user_explicit_mode`."""
    buf = io.StringIO()
    proceed, rc, _ = council_cli._necessity_gate(
        prompt="fix the typo crash failing test bug",
        lens="analysis",
        invocation="agent",
        proceed_anyway=False,
        ai_cfg={
            "necessity_classifier": {
                "enabled": True,
                "mode": "educate",
                "user_explicit_mode": "warn-only",
            },
        },
        stdout=buf,
    )
    # Agent path still skips silently in educate mode.
    assert proceed is False
    assert rc == 0
    assert "skipped" in buf.getvalue()
    assert "warn-only" not in buf.getvalue()


# \u2500\u2500 Phase 8: cmd_debate disclosure + refusal cap \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500


def _debate_args(tmp_path: Path, *, rounds: int = 2, confirm: bool = False):
    """Build a Namespace shaped for ``cmd_debate``."""
    q = tmp_path / "ask.txt"
    q.write_text("Design trade-off: monolith vs microservices", encoding="utf-8")
    out_dir = tmp_path / "debate-out"
    return _ns(
        question=str(q), input_mode="prompt", max_tokens=128,
        mode_override=None, original_ask="",
        confirm=confirm, output=str(out_dir), rounds=rounds,
        model=None, siblings=None,
        proceed_anyway=False, invocation="agent",
        continue_as_debate=None, auto_continue=True,
        depth="standard",
    )


def test_cmd_debate_disclosure_always_renders_block(tmp_path, capsys) -> None:
    """``cost_disclosure.mode=always`` emits the disclosure block."""
    args = _debate_args(tmp_path)
    members = [_StubMember("openai", "gpt-x",
                           CouncilResponse("openai", "gpt-x", "r"))]
    rc = council_cli.cmd_debate(
        args,
        settings={"ai_council": {
            "enabled": True,
            "debate": {
                "max_cost_usd": 100.0,
                "cost_disclosure": {"mode": "always", "show_per_member": True},
            },
        }},
        members=members, table=_fake_table(),
    )
    out = capsys.readouterr().out
    assert rc == 0
    assert "cost-disclosure" in out
    assert "per member" in out


def test_cmd_debate_disclosure_off_suppresses_block(tmp_path, capsys) -> None:
    args = _debate_args(tmp_path)
    members = [_StubMember("openai", "gpt-x",
                           CouncilResponse("openai", "gpt-x", "r"))]
    rc = council_cli.cmd_debate(
        args,
        settings={"ai_council": {
            "enabled": True,
            "debate": {
                "max_cost_usd": 100.0,
                "cost_disclosure": {"mode": "off"},
            },
        }},
        members=members, table=_fake_table(),
    )
    out = capsys.readouterr().out
    assert rc == 0
    assert "cost-disclosure" not in out


def test_cmd_debate_disclosure_above_threshold_only_when_exceeded(
    tmp_path, capsys,
) -> None:
    """``above_threshold`` mode skips the block when expected_usd is below."""
    args = _debate_args(tmp_path, rounds=1)
    members = [_StubMember("openai", "gpt-x",
                           CouncilResponse("openai", "gpt-x", "r"))]
    rc = council_cli.cmd_debate(
        args,
        settings={"ai_council": {
            "enabled": True,
            "debate": {
                "max_cost_usd": 100.0,
                "cost_disclosure": {
                    "mode": "above_threshold",
                    "threshold_usd": 1000.0,
                },
            },
        }},
        members=members, table=_fake_table(),
    )
    out = capsys.readouterr().out
    assert rc == 0
    assert "cost-disclosure" not in out


def test_cmd_debate_refusal_cap_blocks_when_exceeded(tmp_path, capsys) -> None:
    """High-end estimate above ``max_cost_usd`` exits 4 without running."""
    args = _debate_args(tmp_path, rounds=4, confirm=True)
    members = [_StubMember("openai", "gpt-x",
                           CouncilResponse("openai", "gpt-x", "r"))]
    rc = council_cli.cmd_debate(
        args,
        settings={"ai_council": {
            "enabled": True,
            "debate_max_rounds": 4,
            "debate": {
                "max_cost_usd": 0.000001,  # impossibly low
                "cost_disclosure": {"mode": "always"},
            },
        }},
        members=members, table=_fake_table(),
    )
    captured = capsys.readouterr()
    assert rc == 4
    assert "refused" in captured.err
    assert "max_cost_usd" in captured.err


def test_cmd_debate_refusal_cap_zero_disables_check(tmp_path, capsys) -> None:
    """``max_cost_usd: 0`` short-circuits the cap (cap disabled)."""
    args = _debate_args(tmp_path, rounds=1)
    members = [_StubMember("openai", "gpt-x",
                           CouncilResponse("openai", "gpt-x", "r"))]
    rc = council_cli.cmd_debate(
        args,
        settings={"ai_council": {
            "enabled": True,
            "debate": {
                "max_cost_usd": 0,
                "cost_disclosure": {"mode": "off"},
            },
        }},
        members=members, table=_fake_table(),
    )
    err = capsys.readouterr().err
    assert rc == 0
    assert "refused" not in err


def test_resolve_cost_disclosure_lens_override_wins() -> None:
    """Per-lens override beats the global ``debate.cost_disclosure``."""
    ai_cfg = {
        "debate": {
            "cost_disclosure": {"mode": "always", "threshold_usd": 1.0},
        },
        "lens_overrides": {
            "cost_disclosure": {
                "analysis": {
                    "mode": "above_threshold",
                    "threshold_usd": 0.5,
                    "show_per_member": False,
                },
            },
        },
    }
    mode, thr, show = council_cli._resolve_cost_disclosure(ai_cfg, "analysis")
    assert mode == "above_threshold"
    assert thr == 0.5
    assert show is False
    # The debate lens keeps the global block.
    mode, thr, show = council_cli._resolve_cost_disclosure(ai_cfg, "debate")
    assert mode == "always"


def test_resolve_cost_disclosure_default_off_for_non_debate_lens() -> None:
    """Non-debate lenses default to ``off`` unless overridden."""
    mode, _, _ = council_cli._resolve_cost_disclosure({}, "analysis")
    assert mode == "off"
    mode, _, _ = council_cli._resolve_cost_disclosure({}, "default")
    assert mode == "off"



# ── cmd_replay (Phase 9) ────────────────────────────────────────────


def _consensus_payload(**extra) -> dict:
    """Minimal payload with a consensus block for replay tests."""
    payload: dict = {
        "responses": [
            {"provider": "openai", "model": "gpt-x", "text": "agree",
             "input_tokens": 10, "output_tokens": 5, "latency_ms": 1},
            {"provider": "anthropic", "model": "claude-x", "text": "agree",
             "input_tokens": 11, "output_tokens": 6, "latency_ms": 2},
        ],
        "original_ask": "Should we ship?",
        "consensus": {
            "findings": [
                {"id": "F1", "source": "anthropic:claude-x", "text": "Ship it."},
            ],
            "scores": [
                {"finding_id": "F1", "scorer": "openai:gpt-x",
                 "score": 9, "agree": True, "reason": "Tests green."},
            ],
            "extraction_responses": [],
            "scoring_responses": [],
        },
    }
    payload.update(extra)
    return payload


def test_parser_replay_subcommand_accepts_responses() -> None:
    parsed = council_cli.build_parser().parse_args(["replay", "r.json"])
    assert parsed.cmd == "replay"
    assert parsed.responses == "r.json"
    assert parsed.include_member_arguments is None  # default → True at runtime


def test_parser_replay_redact_and_include_are_mutually_exclusive() -> None:
    with pytest.raises(SystemExit):
        council_cli.build_parser().parse_args(
            ["replay", "r.json",
             "--redact-member-arguments", "--include-member-arguments"],
        )


def test_cmd_replay_writes_audit_trail_to_stdout(tmp_path, capsys) -> None:
    src = tmp_path / "saved.json"
    src.write_text(json.dumps(_consensus_payload()), encoding="utf-8")
    args = _ns(responses=str(src), output=None,
               include_member_arguments=None)
    rc = council_cli.cmd_replay(args)
    out = capsys.readouterr().out
    assert rc == 0
    assert "# Decision Replay" in out
    assert "> Should we ship?" in out
    assert "## F1 — Ship it." in out
    assert "Tests green." in out  # full mode includes arguments


def test_cmd_replay_writes_to_output_file_when_provided(tmp_path, capsys) -> None:
    src = tmp_path / "saved.json"
    src.write_text(json.dumps(_consensus_payload()), encoding="utf-8")
    out = tmp_path / "subdir" / "decision-replay.md"
    args = _ns(responses=str(src), output=str(out),
               include_member_arguments=None)
    rc = council_cli.cmd_replay(args)
    assert rc == 0
    assert out.exists()
    body = out.read_text(encoding="utf-8")
    assert "## F1 — Ship it." in body
    stdout = capsys.readouterr().out
    assert "council:replay" in stdout


def test_cmd_replay_redacted_mode_drops_per_member_arguments(tmp_path, capsys) -> None:
    src = tmp_path / "saved.json"
    src.write_text(json.dumps(_consensus_payload()), encoding="utf-8")
    args = _ns(responses=str(src), output=None,
               include_member_arguments=False)
    rc = council_cli.cmd_replay(args)
    out = capsys.readouterr().out
    assert rc == 0
    assert "Tests green." not in out
    assert "redacted (counts only)" in out


def test_cmd_replay_returns_2_when_payload_lacks_consensus(tmp_path, capsys) -> None:
    src = tmp_path / "saved.json"
    src.write_text(json.dumps({"responses": []}), encoding="utf-8")
    args = _ns(responses=str(src), output=None,
               include_member_arguments=None)
    rc = council_cli.cmd_replay(args)
    err = capsys.readouterr().err
    assert rc == 2
    assert "no `consensus` block" in err


def test_decision_replay_settings_global_default_enabled() -> None:
    enabled, include_args = council_cli._decision_replay_settings({}, "analysis")
    assert enabled is True
    assert include_args is True


def test_decision_replay_settings_lens_override_disables() -> None:
    ai_cfg = {
        "decision_replay": {"enabled": True},
        "lenses": {"pr": {"decision_replay": {"enabled": False}}},
    }
    enabled, _ = council_cli._decision_replay_settings(ai_cfg, "pr")
    assert enabled is False
    # Global still applies for non-overridden lens.
    enabled, _ = council_cli._decision_replay_settings(ai_cfg, "analysis")
    assert enabled is True


def test_decision_replay_settings_lens_override_redacts() -> None:
    ai_cfg = {
        "decision_replay": {"include_member_arguments": True},
        "lenses": {
            "analysis": {"decision_replay": {"include_member_arguments": False}},
        },
    }
    _, include_args = council_cli._decision_replay_settings(ai_cfg, "analysis")
    assert include_args is False
