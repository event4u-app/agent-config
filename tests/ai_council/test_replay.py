"""Decision-replay artefact contract (Phase 9).

Pins the renderer in ``scripts/ai_council/replay.py`` — section order,
verdict bands, redacted-vs-full toggle, and the leading H1 / ask
blockquote.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council.clients import CouncilResponse  # noqa: E402
from scripts.ai_council.consensus import (  # noqa: E402
    ConsensusMetadata,
    Finding,
    FindingScore,
)
from scripts.ai_council.replay import (  # noqa: E402
    DecisionReplayInputs,
    render_decision_replay,
)


def _mk_response(provider: str, model: str, text: str) -> CouncilResponse:
    return CouncilResponse(
        provider=provider, model=model, text=text,
        input_tokens=10, output_tokens=20, error=None,
    )


def test_empty_findings_emit_placeholder() -> None:
    body = render_decision_replay(
        DecisionReplayInputs(
            findings=[], scores=[], metadata={}, deliberation=[],
            original_ask="Should we ship?",
        ),
    )
    assert body.startswith("# Decision Replay\n")
    assert "> Should we ship?" in body
    assert "No findings were extracted" in body


def test_strong_consensus_renders_verdict_and_arguments() -> None:
    finding = Finding(id="F1", source="anthropic:claude", text="Ship it.")
    scores = [
        FindingScore(finding_id="F1", scorer="openai:gpt-4o", score=9,
                     agree=True, reason="Tests are green."),
        FindingScore(finding_id="F1", scorer="google:gemini", score=8,
                     agree=True, reason="No regressions in CI."),
    ]
    metadata = {
        "F1": ConsensusMetadata(
            finding_id="F1", consensus_strength=0.85, dissent_count=0,
            scorers=("openai:gpt-4o", "google:gemini"),
            mean_score=8.5, concur_count=2, dissent_reasons=(),
            evidence_quality="H",
        ),
    }
    body = render_decision_replay(
        DecisionReplayInputs(
            findings=[finding], scores=scores, metadata=metadata,
            deliberation=[_mk_response("openai", "gpt-4o", "Looks good."),
                          _mk_response("google", "gemini", "Tests pass.")],
            original_ask="Ship?",
        ),
    )
    assert "## F1 — Ship it." in body
    assert "Strong (0.85)" in body
    assert "Evidence quality**: H" in body
    assert "2/2 members concur, 0 dissent" in body
    assert "Agreeing members" in body
    assert "Tests are green." in body
    assert "No regressions in CI." in body
    assert "artefact mode: full" in body


def test_redacted_mode_drops_per_member_arguments() -> None:
    finding = Finding(id="F1", source="anthropic:claude", text="Ship it.")
    metadata = {
        "F1": ConsensusMetadata(
            finding_id="F1", consensus_strength=0.55, dissent_count=1,
            scorers=("openai:gpt-4o", "google:gemini"),
            mean_score=7.0, concur_count=1,
            dissent_reasons=(("google:gemini", "Flake risk."),),
            evidence_quality="M",
        ),
    }
    body = render_decision_replay(
        DecisionReplayInputs(
            findings=[finding], scores=[], metadata=metadata,
            deliberation=[], original_ask="",
            include_member_arguments=False,
        ),
    )
    assert "Moderate (0.55)" in body
    assert "1/2 members concur, 1 dissent" in body
    assert "Agreeing members" not in body
    assert "Dissenting members" not in body
    assert "Flake risk." not in body
    assert "artefact mode: redacted (counts only)" in body


def test_weak_verdict_band() -> None:
    finding = Finding(id="F1", source="anthropic:claude", text="Pivot.")
    metadata = {
        "F1": ConsensusMetadata(
            finding_id="F1", consensus_strength=0.25, dissent_count=2,
            scorers=(), mean_score=4.0, concur_count=0,
            evidence_quality="L",
        ),
    }
    body = render_decision_replay(
        DecisionReplayInputs(
            findings=[finding], scores=[], metadata=metadata,
            deliberation=[],
        ),
    )
    assert "Weak (0.25)" in body
    assert "Evidence quality**: L" in body


def test_findings_ranked_by_consensus_descending() -> None:
    f_low = Finding(id="F_LOW", source="anthropic:claude", text="Low.")
    f_high = Finding(id="F_HI", source="anthropic:claude", text="High.")
    metadata = {
        "F_LOW": ConsensusMetadata(
            finding_id="F_LOW", consensus_strength=0.3,
            dissent_count=0, scorers=(), mean_score=3.0,
        ),
        "F_HI": ConsensusMetadata(
            finding_id="F_HI", consensus_strength=0.9,
            dissent_count=0, scorers=(), mean_score=9.0,
        ),
    }
    body = render_decision_replay(
        DecisionReplayInputs(
            findings=[f_low, f_high], scores=[], metadata=metadata,
            deliberation=[],
        ),
    )
    assert body.index("## F_HI") < body.index("## F_LOW")


def test_long_ask_is_truncated_with_ellipsis() -> None:
    long_ask = "a" * 500
    body = render_decision_replay(
        DecisionReplayInputs(
            findings=[], scores=[], metadata={}, deliberation=[],
            original_ask=long_ask,
        ),
    )
    assert "…" in body
