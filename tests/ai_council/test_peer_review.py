"""Peer-review pass (Phase 5 / F1) — anonymisation, self-filter, render."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council.clients import CouncilResponse, ExternalAIClient  # noqa: E402
from scripts.ai_council.consensus import anonymize_responses  # noqa: E402
from scripts.ai_council.orchestrator import (  # noqa: E402
    PeerReviewResult, render, run_peer_review,
)


# ── stub member ──────────────────────────────────────────────────────────


class _StubMember(ExternalAIClient):
    def __init__(self, name: str, model: str, text: str = "stub-critique") -> None:
        self.name = name
        self.model = model
        self._text = text
        self.received: list[tuple[str, str]] = []

    def ask(self, system_prompt: str, user_prompt: str, max_tokens: int = 1024) -> CouncilResponse:
        self.received.append((system_prompt, user_prompt))
        return CouncilResponse(
            provider=self.name, model=self.model,
            input_tokens=10, output_tokens=20,
            text=self._text, error=None,
        )


def _make_response(provider: str, model: str, text: str) -> CouncilResponse:
    return CouncilResponse(
        provider=provider, model=model,
        input_tokens=10, output_tokens=20, text=text, error=None,
    )


# ── anonymize_responses ──────────────────────────────────────────────────


def test_anonymize_responses_assigns_deterministic_letters() -> None:
    pairs = [("anthropic:claude", "alpha body"), ("openai:gpt", "beta body")]
    anon, label_to_source = anonymize_responses(pairs)
    assert list(anon.keys()) == ["Response-A", "Response-B"]
    assert anon["Response-A"] == "alpha body"
    assert label_to_source["Response-A"] == "anthropic:claude"
    assert label_to_source["Response-B"] == "openai:gpt"


def test_anonymize_responses_skips_empty_bodies() -> None:
    pairs = [("a:m", ""), ("b:m", "   "), ("c:m", "real")]
    anon, label_to_source = anonymize_responses(pairs)
    assert list(anon.keys()) == ["Response-A"]
    assert label_to_source["Response-A"] == "c:m"


def test_anonymize_responses_preserves_persona_when_provided() -> None:
    pairs = [("anthropic:opus", "x"), ("openai:gpt", "y")]
    persona_labels = {"anthropic:opus": "Contrarian"}
    anon, label_to_source = anonymize_responses(pairs, persona_labels=persona_labels)
    assert "Response-A (Contrarian)" in anon
    assert label_to_source["Response-A (Contrarian)"] == "anthropic:opus"
    assert "Response-B" in anon  # no persona for openai


# ── run_peer_review ──────────────────────────────────────────────────────


def test_run_peer_review_filters_reviewer_own_response() -> None:
    a = _StubMember("anthropic", "claude-sonnet", text="A-critique")
    b = _StubMember("openai", "gpt-4o", text="B-critique")
    deliberation = [
        _make_response("anthropic", "claude-sonnet", "alpha"),
        _make_response("openai", "gpt-4o", "beta"),
    ]
    result = run_peer_review([a, b], deliberation)
    assert isinstance(result, PeerReviewResult)
    assert len(result.responses) == 2
    # reviewer 'a' must not see its own ("alpha") text in the prompt
    a_prompt = a.received[0][1]
    assert "alpha" not in a_prompt
    assert "beta" in a_prompt
    # reviewer 'b' must not see its own ("beta") text
    b_prompt = b.received[0][1]
    assert "beta" not in b_prompt
    assert "alpha" in b_prompt


def test_run_peer_review_returns_empty_when_under_two_responses() -> None:
    a = _StubMember("anthropic", "claude-sonnet")
    deliberation = [_make_response("anthropic", "claude-sonnet", "alpha")]
    result = run_peer_review([a], deliberation)
    assert result.responses == []
    assert result.label_to_source == {}


def test_run_peer_review_skips_errored_deliberation_outputs() -> None:
    a = _StubMember("anthropic", "claude", text="A-crit")
    b = _StubMember("openai", "gpt", text="B-crit")
    deliberation = [
        _make_response("anthropic", "claude", "alpha"),
        CouncilResponse(provider="openai", model="gpt",
                        input_tokens=0, output_tokens=0,
                        text="", error="rate-limit"),
    ]
    # Only one usable deliberation output → no peer-review.
    result = run_peer_review([a, b], deliberation)
    assert result.responses == []


# ── render integration ───────────────────────────────────────────────────


def test_render_emits_peer_review_section_when_provided() -> None:
    deliberation = [
        _make_response("anthropic", "claude", "alpha"),
        _make_response("openai", "gpt", "beta"),
    ]
    peer_review = PeerReviewResult(
        responses=[
            _make_response("anthropic", "claude", "critique-from-A"),
            _make_response("openai", "gpt", "critique-from-B"),
        ],
        label_to_source={"Response-A": "anthropic:claude",
                         "Response-B": "openai:gpt"},
        persona_labels={},
    )
    out = render(deliberation, peer_review=peer_review)
    assert "Peer-Review" in out or "peer-review" in out.lower()
    assert "critique-from-A" in out
    assert "critique-from-B" in out


def test_render_without_peer_review_omits_section() -> None:
    deliberation = [
        _make_response("anthropic", "claude", "alpha"),
        _make_response("openai", "gpt", "beta"),
    ]
    out = render(deliberation, peer_review=None)
    assert "Peer-Review-Surfaced" not in out
