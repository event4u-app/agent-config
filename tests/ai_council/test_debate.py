"""Phase 7 debate orchestrator — round-loop, cost gate, hard cap, seed pivot."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council.clients import CouncilResponse, ExternalAIClient  # noqa: E402
from scripts.ai_council.orchestrator import (  # noqa: E402
    CostBudget,
    CouncilQuestion,
    DebateCapExceeded,
    DebateCheckpoint,
    _augment_for_debate_round,
    run_debate,
)
from scripts.ai_council.pricing import load_prices  # noqa: E402


# ── stub members ────────────────────────────────────────────────────────────


class _CountingMember(ExternalAIClient):
    """Returns a canned response and counts every ask() call."""

    def __init__(self, name: str, model: str, *, text: str = "position-text",
                 input_tokens: int = 100, output_tokens: int = 50) -> None:
        self.name = name
        self.model = model
        self._text = text
        self._input_tokens = input_tokens
        self._output_tokens = output_tokens
        self.calls: list[tuple[str, str, int]] = []
        self._counter = 0

    def ask(self, system_prompt: str, user_prompt: str,
            max_tokens: int = 1024) -> CouncilResponse:
        self.calls.append((system_prompt, user_prompt, max_tokens))
        self._counter += 1
        # Neutral response text — must not leak provider/model identity.
        return CouncilResponse(
            provider=self.name, model=self.model,
            text=f"{self._text} round{self._counter}",
            input_tokens=self._input_tokens,
            output_tokens=self._output_tokens,
        )


def _question(topic: str = "Should we ship X?") -> CouncilQuestion:
    return CouncilQuestion(mode="debate", user_prompt=topic, max_tokens=256)


def _table() -> object:
    return load_prices()


# ── call-count math ─────────────────────────────────────────────────────────


def test_run_debate_call_count_equals_members_times_rounds() -> None:
    """N members × R rounds = N×R real calls."""
    a = _CountingMember("anthropic", "claude-sonnet-4-5")
    o = _CountingMember("openai", "gpt-4o")
    rounds = run_debate(
        [a, o], _question(), max_rounds=3, table=_table(),
    )
    assert len(rounds) == 3
    assert len(a.calls) == 3
    assert len(o.calls) == 3


def test_run_debate_round_1_uses_original_prompt() -> None:
    a = _CountingMember("anthropic", "claude-sonnet-4-5")
    o = _CountingMember("openai", "gpt-4o")
    run_debate([a, o], _question("Topic alpha"), max_rounds=2, table=_table())
    # Round 1 user_prompt is verbatim; Round 2 wraps with anonymised prior.
    assert "Topic alpha" in a.calls[0][1]
    assert "Prior round positions" not in a.calls[0][1]
    assert "Prior round positions" in a.calls[1][1]


def test_run_debate_round_2_anonymises_prior() -> None:
    """Round 2 prompt must not name anthropic/openai/gpt-4o."""
    a = _CountingMember("anthropic", "claude-sonnet-4-5")
    o = _CountingMember("openai", "gpt-4o")
    run_debate([a, o], _question(), max_rounds=2, table=_table())
    round2_prompt = a.calls[1][1]
    assert "anthropic" not in round2_prompt.lower()
    assert "openai" not in round2_prompt.lower()
    assert "gpt-4o" not in round2_prompt.lower()
    assert "claude" not in round2_prompt.lower()
    assert "Reviewer A" in round2_prompt
    assert "Reviewer B" in round2_prompt


# ── continue-prompt gate ────────────────────────────────────────────────────


def test_run_debate_on_continue_false_stops_after_round_1() -> None:
    a = _CountingMember("anthropic", "claude-sonnet-4-5")
    o = _CountingMember("openai", "gpt-4o")
    captured: list[DebateCheckpoint] = []

    def _stop(cp: DebateCheckpoint) -> bool:
        captured.append(cp)
        return False

    rounds = run_debate(
        [a, o], _question(), max_rounds=3,
        on_continue=_stop, table=_table(),
    )
    assert len(rounds) == 1
    assert len(captured) == 1
    assert captured[0].completed_round == 1
    assert captured[0].total_planned_rounds == 3
    assert len(a.calls) == 1


def test_run_debate_auto_continue_no_prompt_runs_all_rounds() -> None:
    """on_continue=None auto-continues every round."""
    a = _CountingMember("anthropic", "claude-sonnet-4-5")
    rounds = run_debate(
        [a], _question(), max_rounds=2, on_continue=None, table=_table(),
    )
    assert len(rounds) == 2
    assert len(a.calls) == 2


# ── hard cap ────────────────────────────────────────────────────────────────


def test_run_debate_hard_cap_raises_after_round_1() -> None:
    """When next-round projection breaches max_total_usd, raise DebateCapExceeded."""
    a = _CountingMember("anthropic", "claude-sonnet-4-5",
                       input_tokens=1000, output_tokens=500)
    table = _table()
    # Compute actual round-1 cost; set cap just above it so round 1
    # completes but round 2 projection breaches.
    from scripts.ai_council.pricing import estimate_cost
    one_round_usd = estimate_cost(
        "anthropic", "claude-sonnet-4-5", 1000, 500, table,
    ).total_usd
    cap = one_round_usd * 1.2  # fits round 1 (incl. preamble), breaches round 2
    budget = CostBudget(
        max_input_tokens=10_000, max_output_tokens=10_000,
        max_calls=10, max_total_usd=cap,
    )
    with pytest.raises(DebateCapExceeded) as exc:
        run_debate([a], _question(), max_rounds=3,
                   budget=budget, table=table)
    assert exc.value.completed_round == 1



# ── seed (continue-as-debate) ───────────────────────────────────────────────


def test_run_debate_seed_round_1_no_calls_billed() -> None:
    """seed_round_1 reuses existing responses verbatim — no round-1 calls."""
    a = _CountingMember("anthropic", "claude-sonnet-4-5")
    seed = [CouncilResponse(
        provider="anthropic", model="claude-sonnet-4-5",
        text="seeded position", input_tokens=200, output_tokens=80,
    )]
    rounds = run_debate(
        [a], _question(), max_rounds=2, table=_table(),
        seed_round_1=seed,
    )
    assert len(rounds) == 2
    # Round 1 reused, only round 2 makes a real call.
    assert len(a.calls) == 1
    assert rounds[0][0].text == "seeded position"
    # Round 2 prompt anonymises the seeded response.
    assert "Reviewer A" in a.calls[0][1]


# ── augment helper ──────────────────────────────────────────────────────────


def test_augment_for_debate_round_strips_identity() -> None:
    prior = [
        CouncilResponse(provider="anthropic", model="claude-sonnet-4-5",
                        text="Yes, ship it.", input_tokens=10, output_tokens=5),
        CouncilResponse(provider="openai", model="gpt-4o",
                        text="No, the blast radius is too wide.",
                        input_tokens=10, output_tokens=5),
    ]
    out = _augment_for_debate_round("Topic X", prior, 2)
    assert "Reviewer A" in out
    assert "Reviewer B" in out
    assert "Yes, ship it." in out
    assert "blast radius" in out
    assert "anthropic" not in out.lower()
    assert "openai" not in out.lower()
    assert "rebuttal" in out.lower()
    assert "common ground" in out.lower()


def test_augment_for_debate_round_skips_error_responses() -> None:
    prior = [
        CouncilResponse(provider="a", model="m", text="position",
                        input_tokens=10, output_tokens=5),
        CouncilResponse(provider="b", model="m", text="",
                        error="ConnectionError: x"),
    ]
    out = _augment_for_debate_round("Topic", prior, 2)
    assert "Reviewer A" in out
    assert "Reviewer B" not in out  # error skipped


# ── validation ──────────────────────────────────────────────────────────────


def test_run_debate_rejects_max_rounds_below_1() -> None:
    a = _CountingMember("anthropic", "claude-sonnet-4-5")
    with pytest.raises(ValueError):
        run_debate([a], _question(), max_rounds=0)


def test_run_debate_empty_members_returns_empty() -> None:
    assert run_debate([], _question(), max_rounds=2) == []
