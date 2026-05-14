"""Tests for the lightweight-QA fast-path resolver (Phase 11)."""

from __future__ import annotations

import pytest

from scripts.ai_council.config import (
    LowImpactFastPathConfig,
    MemberConfig,
)
from scripts.ai_council.clients import CouncilResponse, ExternalAIClient
from scripts.ai_council.low_impact import (
    FastPathResolution,
    build_fast_path_budget,
    parse_low_impact_log,
    plan_fast_path,
    render_low_impact_stats,
    resolve_low_impact,
    select_fast_path_members,
)


def _member(
    name: str,
    *,
    enabled: bool = True,
    opt_in: bool = False,
) -> MemberConfig:
    return MemberConfig(
        name=name,
        enabled=enabled,
        model=f"{name}-model",
        api_key_ref=f"env:{name.upper()}_KEY",
        participate_low_impact=opt_in,
    )


def test_select_filters_opt_in_only() -> None:
    members = {
        "anthropic": _member("anthropic", opt_in=True),
        "openai": _member("openai", opt_in=False),
        "gemini": _member("gemini", opt_in=True),
    }
    cfg = LowImpactFastPathConfig()
    selected = select_fast_path_members(members, cfg)
    assert [m.name for m in selected] == ["anthropic", "gemini"]


def test_select_skips_disabled_members() -> None:
    members = {
        "anthropic": _member("anthropic", enabled=False, opt_in=True),
        "openai": _member("openai", opt_in=True),
    }
    selected = select_fast_path_members(members, LowImpactFastPathConfig())
    assert [m.name for m in selected] == ["openai"]


def test_select_truncates_to_max_members() -> None:
    members = {
        n: _member(n, opt_in=True)
        for n in ("anthropic", "gemini", "openai", "perplexity", "xai")
    }
    cfg = LowImpactFastPathConfig(max_members=2)
    selected = select_fast_path_members(members, cfg)
    assert len(selected) == 2
    assert [m.name for m in selected] == ["anthropic", "gemini"]


def test_select_returns_empty_when_no_opt_in() -> None:
    members = {
        "anthropic": _member("anthropic", opt_in=False),
        "openai": _member("openai", opt_in=False),
    }
    selected = select_fast_path_members(members, LowImpactFastPathConfig())
    assert selected == ()


def test_budget_translates_caps_one_to_one() -> None:
    cfg = LowImpactFastPathConfig(
        max_members=2, max_tokens=2500, max_cost_usd=0.05,
    )
    budget = build_fast_path_budget(cfg)
    assert budget.max_calls == 2
    assert budget.max_total_usd == pytest.approx(0.05)
    assert budget.max_input_tokens + budget.max_output_tokens == 2500
    # 60 / 40 split keeps both sides positive.
    assert budget.max_input_tokens >= 1
    assert budget.max_output_tokens >= 1


def test_plan_builds_marker_and_budget() -> None:
    members = {
        "anthropic": _member("anthropic", opt_in=True),
        "openai": _member("openai", opt_in=True),
    }
    cfg = LowImpactFastPathConfig()
    plan = plan_fast_path(members, cfg)
    assert plan.is_resolvable
    assert len(plan.members) == 2
    assert "fast-path" in plan.marker
    assert "anthropic" in plan.marker
    assert "openai" in plan.marker
    assert plan.budget.max_calls == 2


def test_plan_empty_when_no_opt_in_returns_reason() -> None:
    members = {
        "anthropic": _member("anthropic", opt_in=False),
    }
    plan = plan_fast_path(members, LowImpactFastPathConfig())
    assert not plan.is_resolvable
    assert plan.members == ()
    assert plan.marker == ""
    assert "participate_low_impact" in plan.reason
    # Budget still built so the caller can inspect the intended caps.
    assert plan.budget.max_calls == 2


def test_plan_single_member_marker_uses_singular() -> None:
    members = {
        "anthropic": _member("anthropic", opt_in=True),
    }
    plan = plan_fast_path(members, LowImpactFastPathConfig(max_members=1))
    assert plan.is_resolvable
    assert "1 member" in plan.marker
    assert "members" not in plan.marker


def test_plan_marker_shows_cost_and_token_caps() -> None:
    members = {
        "anthropic": _member("anthropic", opt_in=True),
    }
    cfg = LowImpactFastPathConfig(max_cost_usd=0.10, max_tokens=1500)
    plan = plan_fast_path(members, cfg)
    assert "$0.10" in plan.marker
    assert "1500 tokens" in plan.marker


# --- Phase 11 Step 2-3: executor tests -------------------------------------


class _FakeClient(ExternalAIClient):
    """Test double — returns the canned text without touching the network."""

    def __init__(
        self,
        name: str,
        text: str,
        *,
        error: str | None = None,
        raises: BaseException | None = None,
        input_tokens: int = 50,
        output_tokens: int = 30,
    ) -> None:
        self.name = name
        self.model = f"{name}-model"
        self._text = text
        self._error = error
        self._raises = raises
        self._in = input_tokens
        self._out = output_tokens
        self.calls: list[tuple[str, str, int]] = []

    def ask(self, system_prompt, user_prompt, max_tokens=1024):  # type: ignore[no-untyped-def]
        self.calls.append((system_prompt, user_prompt, max_tokens))
        if self._raises is not None:
            raise self._raises
        return CouncilResponse(
            provider=self.name,
            model=self.model,
            text=self._text,
            input_tokens=self._in,
            output_tokens=self._out,
            error=self._error,
        )


def _plan(*names: str, max_members: int = 2, max_cost_usd: float = 0.05):
    members = {n: _member(n, opt_in=True) for n in names}
    cfg = LowImpactFastPathConfig(
        max_members=max_members, max_cost_usd=max_cost_usd,
    )
    return plan_fast_path(members, cfg)


def test_resolve_unavailable_when_plan_has_no_members() -> None:
    plan = _plan()  # no members
    result = resolve_low_impact("Q?", plan, clients={})
    assert result.status == "unavailable"
    assert result.answer == ""
    assert "no opted-in member" in result.marker


def test_resolve_single_member_returns_answer() -> None:
    plan = _plan("anthropic", max_members=1)
    client = _FakeClient("anthropic", "Yes.\nBecause X.")
    result = resolve_low_impact("Q?", plan, clients={"anthropic": client})
    assert result.status == "resolved"
    assert result.answer == "Yes.\nBecause X."
    assert "fast-path" in result.marker
    assert len(client.calls) == 1
    # Token cap from the budget reaches the client.
    assert client.calls[0][2] == plan.budget.max_output_tokens


def test_resolve_two_members_consensus_returns_answer() -> None:
    plan = _plan("anthropic", "openai")
    clients = {
        "anthropic": _FakeClient("anthropic", "Yes.\nBecause A."),
        "openai": _FakeClient("openai", "yes\nBecause B."),  # punctuation drift
    }
    result = resolve_low_impact("Q?", plan, clients=clients)
    assert result.status == "resolved"
    assert result.answer.startswith("Yes.")


def test_resolve_two_members_split_escalates() -> None:
    plan = _plan("anthropic", "openai")
    clients = {
        "anthropic": _FakeClient("anthropic", "Yes.\nBecause."),
        "openai": _FakeClient("openai", "No.\nBecause."),
    }
    result = resolve_low_impact("Q?", plan, clients=clients)
    assert result.status == "split"
    assert result.answer == ""
    assert "fast-path split" in result.marker
    assert "anthropic" in result.marker and "openai" in result.marker


def test_resolve_aborts_when_all_members_fail() -> None:
    plan = _plan("anthropic", "openai")
    clients = {
        "anthropic": _FakeClient("anthropic", "", error="api down"),
        "openai": _FakeClient("openai", "", error="rate limited"),
    }
    result = resolve_low_impact("Q?", plan, clients=clients)
    assert result.status == "aborted"
    assert "all members failed" in result.marker


def test_resolve_skips_missing_client() -> None:
    plan = _plan("anthropic", "openai")
    clients = {"anthropic": _FakeClient("anthropic", "Yes.\nBecause.")}
    result = resolve_low_impact("Q?", plan, clients=clients)
    # One member succeeded → resolved with that answer (single-ok path).
    assert result.status == "resolved"
    assert result.answer.startswith("Yes.")
    missing = [a for a in result.answers if a.member == "openai"][0]
    assert missing.error is not None
    assert "no client" in missing.error


def test_resolve_recovers_from_raising_client() -> None:
    plan = _plan("anthropic", "openai")
    clients = {
        "anthropic": _FakeClient(
            "anthropic", "", raises=RuntimeError("boom"),
        ),
        "openai": _FakeClient("openai", "Yes.\nBecause."),
    }
    result = resolve_low_impact("Q?", plan, clients=clients)
    assert result.status == "resolved"
    assert result.answer.startswith("Yes.")
    failed = [a for a in result.answers if a.member == "anthropic"][0]
    assert failed.error is not None and "boom" in failed.error


def test_session_log_line_present_on_resolved() -> None:
    plan = _plan("anthropic", max_members=1)
    client = _FakeClient("anthropic", "Yes.\nBecause.")
    result = resolve_low_impact("Q?", plan, clients={"anthropic": client})
    assert result.session_log_line
    assert "resolved" in result.session_log_line
    assert "members=1/1" in result.session_log_line


def test_resolve_aborts_when_projected_cost_exceeds_cap() -> None:
    """Hard cap — when pricing pushes the projected total above
    ``max_cost_usd``, the executor refuses to include the answer and
    falls back to whatever earlier members produced.
    """
    plan = _plan("anthropic", "openai", max_cost_usd=0.001)

    class _Price:
        def lookup(self, _provider, _model):
            class _P:
                input_per_1m_usd = 1000.0
                output_per_1m_usd = 1000.0
            return _P()

    clients = {
        "anthropic": _FakeClient(
            "anthropic", "Yes.\nBecause.",
            input_tokens=1_000_000, output_tokens=1_000_000,
        ),
        "openai": _FakeClient("openai", "Yes.\nBecause."),
    }
    result = resolve_low_impact(
        "Q?", plan, clients=clients, price_table=_Price(),
    )
    # First call would blow the cap → marked as error, loop breaks.
    first = result.answers[0]
    assert first.error is not None and "exceed fast-path cap" in first.error
    assert result.status == "aborted"


# --- Phase 11 Step 5: stats helpers ----------------------------------------


def test_parse_low_impact_log_counts_status_and_cost() -> None:
    body = (
        "2025-01-01T00:00:00Z | resolved | members=1/1 | members(anthropic) "
        "cost=$0.0012 | Q=foo\n"
        "2025-01-01T00:01:00Z | resolved | members=2/2 | "
        "members(anthropic, openai) cost=$0.0034 | Q=bar\n"
        "2025-01-01T00:02:00Z | split | members=2/2 | "
        "members(anthropic, openai) cost=$0.0050 | Q=baz\n"
        "# section header line ignored\n"
        "2025-01-01T00:03:00Z | aborted | members=0/2 | "
        "members(anthropic, openai) cost=$0.0000 | Q=quux\n"
    )
    stats = parse_low_impact_log(body)
    assert stats.total == 4
    assert stats.by_status == {"aborted": 1, "resolved": 2, "split": 1}
    assert stats.by_member == {"anthropic": 4, "openai": 3}
    assert stats.total_cost_usd == pytest.approx(0.0096)


def test_parse_low_impact_log_handles_empty_input() -> None:
    stats = parse_low_impact_log("")
    assert stats.total == 0
    assert stats.by_status == {}
    assert stats.by_member == {}
    assert stats.total_cost_usd == 0.0


def test_render_low_impact_stats_shows_breakdown() -> None:
    body = (
        "2025-01-01T00:00:00Z | resolved | members=1/1 | members(anthropic) "
        "cost=$0.0012 | Q=foo\n"
    )
    stats = parse_low_impact_log(body)
    out = render_low_impact_stats(stats)
    assert "attempts: 1" in out
    assert "resolved=1" in out
    assert "anthropic=1" in out
    assert "$0.0012" in out


def test_session_log_line_includes_member_names_tag() -> None:
    """The renderer must emit ``members(...)`` so the parser can pick
    members up — guards against the parser silently losing the tag.
    """
    plan = _plan("anthropic", max_members=1)
    client = _FakeClient("anthropic", "Yes.\nBecause.")
    result = resolve_low_impact("Q?", plan, clients={"anthropic": client})
    assert "members(anthropic)" in result.session_log_line
    # Round-trip through the parser proves the contract:
    stats = parse_low_impact_log(result.session_log_line)
    assert stats.by_member == {"anthropic": 1}
