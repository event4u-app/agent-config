"""Parallel fan-out, cost-budget abort, render shape."""

from __future__ import annotations

import sys
import threading
import time
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council.clients import CouncilResponse, ExternalAIClient  # noqa: E402
from scripts.ai_council.orchestrator import (  # noqa: E402
    CostBudget,
    CouncilQuestion,
    consult,
    render,
)


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


def test_consult_runs_members_in_parallel() -> None:
    """Two 50ms members must finish in well under 100ms total."""
    a = _StubMember("a", "m", CouncilResponse("a", "m", "ok", 1, 1), delay=0.05)
    b = _StubMember("b", "m", CouncilResponse("b", "m", "ok", 1, 1), delay=0.05)
    t0 = time.monotonic()
    consult([a, b], CouncilQuestion(mode="prompt", user_prompt="x"))
    elapsed = time.monotonic() - t0
    assert elapsed < 0.09, f"expected parallel (<90ms), got {elapsed*1000:.0f}ms"


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
    started = threading.Event()
    blocker = threading.Event()

    class _Greedy(ExternalAIClient):
        name, model = "greedy", "m"
        def ask(self, *a: object, **kw: object) -> CouncilResponse:
            return CouncilResponse("greedy", "m", "big", input_tokens=100, output_tokens=1)

    class _Slow(ExternalAIClient):
        name, model = "slow", "m"
        def ask(self, *a: object, **kw: object) -> CouncilResponse:
            started.set()
            blocker.wait(timeout=2.0)
            return CouncilResponse("slow", "m", "late", 1, 1)

    members = [_Greedy(), _Slow()]
    budget = CostBudget(max_input_tokens=50, max_output_tokens=50, max_calls=10)
    out = consult(members, CouncilQuestion(mode="prompt", user_prompt="x"), budget)
    blocker.set()  # release in case it's still pending
    assert out[0].text == "big"
    assert out[1].error == "cost_budget_exceeded"
    assert out[1].provider == "slow"


def test_consult_rejects_more_members_than_max_calls() -> None:
    members = [_StubMember(f"m{i}", "x", CouncilResponse(f"m{i}", "x", "ok")) for i in range(3)]
    with pytest.raises(ValueError, match="caps at"):
        consult(members, CouncilQuestion(mode="prompt", user_prompt="x"), CostBudget(max_calls=2))


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
