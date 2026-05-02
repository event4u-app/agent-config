"""Sequential fan-out, cost-budget abort, overrun callback, render shape."""

from __future__ import annotations

import sys
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council.clients import CouncilResponse, ExternalAIClient  # noqa: E402
from scripts.ai_council.orchestrator import (  # noqa: E402
    CostBudget,
    CouncilQuestion,
    OverrunEvent,
    consult,
    estimate,
    render,
)
from scripts.ai_council.pricing import bootstrap_from_defaults, load_prices  # noqa: E402
from scripts.ai_council.project_context import ProjectContext  # noqa: E402


# ── stub members ──────────────────────────────────────────────────────────────


class _StubMember(ExternalAIClient):
    """Synchronous stub that records the inputs and returns a canned response."""

    def __init__(self, name: str, model: str, response: CouncilResponse, delay: float = 0.0):
        self.name = name
        self.model = model
        self._response = response
        self._delay = delay
        self.received: tuple[str, str, int] | None = None

    def ask(self, system_prompt: str, user_prompt: str, max_tokens: int = 1024) -> CouncilResponse:
        if self._delay:
            time.sleep(self._delay)
        self.received = (system_prompt, user_prompt, max_tokens)
        return self._response


class _RaisingMember(ExternalAIClient):
    def __init__(self, name: str = "broken", model: str = "x", exc: Exception | None = None):
        self.name = name
        self.model = model
        self._exc = exc or RuntimeError("kaboom")

    def ask(self, system_prompt: str, user_prompt: str, max_tokens: int = 1024) -> CouncilResponse:
        raise self._exc


# ── happy path ────────────────────────────────────────────────────────────────


def test_consult_empty_members_returns_empty() -> None:
    assert consult([], CouncilQuestion(mode="prompt", user_prompt="x")) == []


def test_consult_returns_in_input_order_regardless_of_finish_order() -> None:
    fast = _StubMember("a", "m1", CouncilResponse("a", "m1", "fast", 1, 1))
    slow = _StubMember("b", "m2", CouncilResponse("b", "m2", "slow", 1, 1), delay=0.05)
    out = consult([slow, fast], CouncilQuestion(mode="prompt", user_prompt="hi"))
    assert [r.provider for r in out] == ["b", "a"]
    assert out[0].text == "slow"
    assert out[1].text == "fast"


def test_consult_passes_resolved_system_prompt_for_mode() -> None:
    m = _StubMember("a", "m", CouncilResponse("a", "m", "ok"))
    consult([m], CouncilQuestion(mode="diff", user_prompt="payload", max_tokens=42))
    assert m.received is not None
    sys_prompt, user_prompt, max_tokens = m.received
    assert "diff" in sys_prompt.lower() or "patch" in sys_prompt.lower() or sys_prompt
    assert user_prompt == "payload"
    assert max_tokens == 42


def test_consult_runs_members_sequentially() -> None:
    """v2 contract: two 50ms members serialise to ≥100ms total."""
    a = _StubMember("a", "m", CouncilResponse("a", "m", "ok", 1, 1), delay=0.05)
    b = _StubMember("b", "m", CouncilResponse("b", "m", "ok", 1, 1), delay=0.05)
    t0 = time.monotonic()
    consult([a, b], CouncilQuestion(mode="prompt", user_prompt="x"))
    elapsed = time.monotonic() - t0
    assert elapsed >= 0.09, f"expected sequential (>=90ms), got {elapsed*1000:.0f}ms"


# ── error normalisation ───────────────────────────────────────────────────────


def test_consult_normalises_member_exception_into_response() -> None:
    ok = _StubMember("ok", "m", CouncilResponse("ok", "m", "fine", 1, 1))
    bad = _RaisingMember("broken", "m", RuntimeError("rate limit"))
    out = consult([ok, bad], CouncilQuestion(mode="prompt", user_prompt="hi"))
    assert out[0].text == "fine"
    assert out[1].error is not None
    assert "rate limit" in out[1].error
    assert out[1].provider == "broken"


# ── cost-budget abort ─────────────────────────────────────────────────────────


def test_consult_aborts_on_cost_budget_input_exceeded() -> None:
    """v1 fallback (no table): post-call accounting short-circuits remaining members."""

    class _Greedy(ExternalAIClient):
        name, model = "greedy", "m"
        def ask(self, *a: object, **kw: object) -> CouncilResponse:
            return CouncilResponse("greedy", "m", "big", input_tokens=100, output_tokens=1)

    class _Loud(ExternalAIClient):
        name, model = "loud", "m"
        def ask(self, *a: object, **kw: object) -> CouncilResponse:  # pragma: no cover
            raise AssertionError("must not run after greedy busted the budget")

    members = [_Greedy(), _Loud()]
    budget = CostBudget(max_input_tokens=50, max_output_tokens=50, max_calls=10)
    out = consult(members, CouncilQuestion(mode="prompt", user_prompt="x"), budget)
    assert out[0].text == "big"
    assert out[1].error == "cost_budget_exceeded"
    assert out[1].provider == "loud"


def test_consult_rejects_more_members_than_max_calls() -> None:
    members = [_StubMember(f"m{i}", "x", CouncilResponse(f"m{i}", "x", "ok")) for i in range(3)]
    with pytest.raises(ValueError, match="caps at"):
        consult(members, CouncilQuestion(mode="prompt", user_prompt="x"), CostBudget(max_calls=2))


# ── pre-call estimate ─────────────────────────────────────────────────────────


def _table(tmp_path):  # type: ignore[no-untyped-def]
    p = tmp_path / "prices.md"
    bootstrap_from_defaults(p)
    return load_prices(p)


def test_estimate_returns_one_entry_per_member_in_input_order(tmp_path) -> None:  # type: ignore[no-untyped-def]
    table = _table(tmp_path)
    a = _StubMember("anthropic", "claude-sonnet-4-5", CouncilResponse("a", "m", ""))
    b = _StubMember("openai", "gpt-4o", CouncilResponse("b", "m", ""))
    q = CouncilQuestion(mode="prompt", user_prompt="x" * 400, max_tokens=512)
    out = estimate(q, [a, b], table)
    assert [e.provider for e in out] == ["anthropic", "openai"]
    assert all(e.input_tokens > 0 for e in out)
    assert all(e.output_tokens == 512 for e in out)
    assert all(e.total_usd > 0 for e in out)


# ── overrun callback ──────────────────────────────────────────────────────────


def test_consult_invokes_on_overrun_and_proceeds_when_callback_returns_true(tmp_path) -> None:  # type: ignore[no-untyped-def]
    table = _table(tmp_path)
    m = _StubMember("anthropic", "claude-sonnet-4-5", CouncilResponse("anthropic", "claude-sonnet-4-5", "fine", 5, 5))
    q = CouncilQuestion(mode="prompt", user_prompt="x" * 4000, max_tokens=8192)
    # Force overrun: USD ceiling tiny → projected total breaches.
    budget = CostBudget(max_input_tokens=10**9, max_output_tokens=10**9, max_total_usd=0.000001)

    seen: list[OverrunEvent] = []
    out = consult([m], q, budget, table=table, on_overrun=lambda e: (seen.append(e) or True))
    assert len(seen) == 1
    assert seen[0].member_index == 0
    assert seen[0].next_estimate.total_usd > 0
    assert out[0].text == "fine"


def test_consult_skips_member_when_on_overrun_returns_false(tmp_path) -> None:  # type: ignore[no-untyped-def]
    table = _table(tmp_path)
    m = _StubMember("anthropic", "claude-sonnet-4-5", CouncilResponse("anthropic", "claude-sonnet-4-5", "never"))
    q = CouncilQuestion(mode="prompt", user_prompt="x" * 4000, max_tokens=8192)
    budget = CostBudget(max_input_tokens=10**9, max_output_tokens=10**9, max_total_usd=0.000001)
    out = consult([m], q, budget, table=table, on_overrun=lambda e: False)
    assert out[0].error == "cost_budget_exceeded"
    assert m.received is None  # ask() never called


def test_consult_calls_on_overrun_per_member(tmp_path) -> None:  # type: ignore[no-untyped-def]
    table = _table(tmp_path)
    a = _StubMember("anthropic", "claude-sonnet-4-5", CouncilResponse("anthropic", "claude-sonnet-4-5", "a", 1, 1))
    b = _StubMember("openai", "gpt-4o", CouncilResponse("openai", "gpt-4o", "b", 1, 1))
    q = CouncilQuestion(mode="prompt", user_prompt="x" * 4000, max_tokens=8192)
    budget = CostBudget(max_input_tokens=10**9, max_output_tokens=10**9, max_total_usd=0.000001)
    calls: list[int] = []
    out = consult([a, b], q, budget, table=table, on_overrun=lambda e: (calls.append(e.member_index) or True))
    assert calls == [0, 1]
    assert out[0].text == "a"
    assert out[1].text == "b"


# ── handoff preamble integration (Phase 2a) ──────────────────────────────────


def test_consult_passes_handoff_preamble_with_project_and_ask() -> None:
    m = _StubMember("a", "m", CouncilResponse("a", "m", "ok"))
    project = ProjectContext(name="vendor/pkg", stack="PHP")
    consult(
        [m], CouncilQuestion(mode="prompt", user_prompt="payload"),
        project=project, original_ask="should we ship this?",
    )
    assert m.received is not None
    sys_prompt, _, _ = m.received
    assert "Project: vendor/pkg" in sys_prompt
    assert "Stack: PHP" in sys_prompt
    assert "> should we ship this?" in sys_prompt


def test_consult_without_handoff_args_keeps_v1_shape() -> None:
    """E3.3 back-compat: omitted kwargs → no Project/Stack/ask blocks."""
    m = _StubMember("a", "m", CouncilResponse("a", "m", "ok"))
    consult([m], CouncilQuestion(mode="prompt", user_prompt="payload"))
    assert m.received is not None
    sys_prompt, _, _ = m.received
    assert "Project:" not in sys_prompt
    assert "originally asked" not in sys_prompt


# ── render ────────────────────────────────────────────────────────────────────


def test_render_emits_one_section_per_member_plus_summary_slot() -> None:
    rs = [
        CouncilResponse("a", "m1", "first answer", input_tokens=10, output_tokens=5, latency_ms=100),
        CouncilResponse("b", "m2", "", error="timeout"),
    ]
    out = render(rs)
    assert "## a · m1" in out
    assert "first answer" in out
    assert "10 in / 5 out" in out
    assert "## b · m2" in out
    assert "`timeout`" in out
    assert "Convergence / Divergence" in out
    # stable separator between blocks
    assert out.count("\n\n---\n\n") >= 2



# ── non-billable bypass (Phase 2b · F4) ───────────────────────────────────────


class _NonBillable(ExternalAIClient):
    name = "manual"
    model = "manual"
    billable = False

    def __init__(self, response: CouncilResponse):
        self._response = response
        self.called = False

    def ask(self, system_prompt: str, user_prompt: str, max_tokens: int = 1024) -> CouncilResponse:
        self.called = True
        return self._response


def test_non_billable_bypasses_cost_gate_even_when_budget_zero() -> None:
    """A manual member must run even with a $0 USD cap and tight token caps."""
    table = load_prices()
    rs = CouncilResponse("manual", "manual", "free reply", input_tokens=999_999, output_tokens=999_999)
    member = _NonBillable(rs)
    budget = CostBudget(max_input_tokens=10, max_output_tokens=10, max_total_usd=0.0001, max_calls=2)
    out = consult(
        [member], CouncilQuestion(mode="prompt", user_prompt="x" * 5000),
        budget, table=table,
    )
    assert member.called is True
    assert out[0].error is None
    assert out[0].text == "free reply"


def test_non_billable_skips_overrun_callback() -> None:
    table = load_prices()
    member = _NonBillable(CouncilResponse("manual", "manual", "ok"))
    calls: list[OverrunEvent] = []
    consult(
        [member], CouncilQuestion(mode="prompt", user_prompt="y"),
        CostBudget(max_input_tokens=1, max_output_tokens=1, max_total_usd=0.001),
        table=table, on_overrun=lambda ev: calls.append(ev) or True,
    )
    assert calls == []  # callback must NOT fire for non-billable members


def test_non_billable_does_not_consume_usd_budget_for_subsequent_member() -> None:
    """A manual member must not eat into the USD budget that the next billable member needs."""
    table = load_prices()
    free = _NonBillable(CouncilResponse("manual", "manual", "free", input_tokens=10, output_tokens=10))
    paid = _StubMember("anthropic", "claude-sonnet-4-5",
                       CouncilResponse("anthropic", "claude-sonnet-4-5", "paid reply", 5, 5))
    out = consult(
        [free, paid],
        CouncilQuestion(mode="prompt", user_prompt="z"),
        CostBudget(max_input_tokens=50_000, max_output_tokens=50_000, max_total_usd=0.50, max_calls=2),
        table=table,
    )
    assert out[0].text == "free"
    assert out[1].text == "paid reply"
    assert out[1].error is None
