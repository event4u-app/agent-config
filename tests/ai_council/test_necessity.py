"""Council-necessity classifier contract (Phase 6).

Pins the three-verdict decision table in
``scripts/ai_council/necessity.py`` plus the lens-strictness override,
the invocation pass-through, and the educate-message shape consumed by
the dispatcher.
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council.necessity import (  # noqa: E402
    ClassificationResult,
    DecisionRouting,
    ImpactVerdict,
    LOCKED_IMPACT_CLASSES,
    SizeFitVerdict,
    classify_impact,
    classify_necessity,
    classify_size_fit,
    downgrade_message,
    educate_message,
    route_decision,
)

# Reference ladders matching the seeded ones in agents/.ai-council.yml.
ANTHROPIC_LADDER = ("claude-haiku-4-5", "claude-sonnet-4-5", "claude-opus-4-5")
OPENAI_LADDER = ("gpt-4o-mini", "gpt-4o", "gpt-4.1")


def test_empty_prompt_is_unnecessary_empty() -> None:
    r = classify_necessity("", lens="analysis")
    assert r.verdict == "unnecessary"
    assert r.category == "empty"
    assert r.necessary_hits == 0
    assert r.unnecessary_hits == 0


def test_whitespace_only_prompt_is_unnecessary_empty() -> None:
    r = classify_necessity("   \n\t  ", lens="analysis")
    assert r.verdict == "unnecessary"
    assert r.category == "empty"


def test_strong_necessary_markers_yield_necessary() -> None:
    prompt = (
        "Should we refactor the service boundary and pick a migration "
        "plan? There are real trade-offs and stakeholders disagree."
    )
    r = classify_necessity(prompt, lens="analysis")
    assert r.verdict == "necessary"
    assert r.necessary_hits >= 2


def test_strong_unnecessary_markers_yield_unnecessary() -> None:
    prompt = "Fix the failing test crash — typo in the import statement."
    r = classify_necessity(prompt, lens="analysis")
    assert r.verdict == "unnecessary"
    assert r.category == "bugfix"


def test_mixed_signals_yield_borderline() -> None:
    # Equal hits on both sides: necessary=architecture/tradeoff (2),
    # unnecessary=crash/typo (2). The decision table demands strict
    # dominance for `necessary`, so this drops to borderline.
    prompt = (
        "Fix the crash and the typo, but think about the architecture "
        "trade-off."
    )
    r = classify_necessity(prompt, lens="analysis")
    assert r.verdict == "borderline"


def test_debate_lens_demotes_borderline_with_no_necessary_hits() -> None:
    # No `necessary` marker, only `unnecessary` lookup signal — analysis
    # lens would call this borderline, but debate is strict.
    prompt = "what is the syntax of dict comprehension"
    r_analysis = classify_necessity(prompt, lens="analysis")
    r_debate = classify_necessity(prompt, lens="debate")
    # Both verdicts agree it isn't necessary; debate just narrows it
    # further when no necessary hit is present.
    assert r_analysis.verdict in {"borderline", "unnecessary"}
    assert r_debate.verdict == "unnecessary"


def test_debate_lens_preserves_necessary_verdicts() -> None:
    prompt = (
        "Strategic question: should we adopt the microservice "
        "architecture? Stakeholders disagree on the trade-off."
    )
    r = classify_necessity(prompt, lens="debate")
    assert r.verdict == "necessary"


def test_invocation_is_not_part_of_verdict() -> None:
    prompt = "Fix the typo on this line."
    r_agent = classify_necessity(prompt, lens="analysis", invocation="agent")
    r_user = classify_necessity(
        prompt, lens="analysis", invocation="user_explicit",
    )
    assert r_agent.verdict == r_user.verdict
    assert r_agent.category == r_user.category


def test_educate_message_mentions_category_and_lens() -> None:
    r = ClassificationResult(
        verdict="unnecessary",
        category="bugfix",
        rationale="…",
        necessary_hits=0,
        unnecessary_hits=3,
    )
    msg = educate_message(r, lens="analysis")
    assert "bugfix" in msg
    assert "analysis" in msg
    assert "--proceed-anyway" in msg


def test_result_is_frozen_dataclass() -> None:
    r = classify_necessity("anything", lens="analysis")
    # Mutating a frozen dataclass must raise.
    try:
        r.verdict = "necessary"  # type: ignore[misc]
    except (AttributeError, Exception):
        return
    raise AssertionError("ClassificationResult must be frozen")


# --- Phase 7: classify_size_fit ------------------------------------------


def test_size_fit_short_simple_prompt_suggests_downgrade() -> None:
    # Short (< 200 chars) with no complexity markers → suggest the rung
    # immediately below the active one (sonnet → haiku).
    v = classify_size_fit(
        "List the files in this directory.",
        current_model="claude-sonnet-4-5",
        ladder=ANTHROPIC_LADDER,
    )
    assert v.fit is False
    assert v.suggested_model == "claude-haiku-4-5"
    assert v.length_tier == "short"
    assert v.complexity_hits == 0


def test_size_fit_short_simple_openai_suggests_mini() -> None:
    v = classify_size_fit(
        "Show me the tests for this module.",
        current_model="gpt-4o",
        ladder=OPENAI_LADDER,
    )
    assert v.fit is False
    assert v.suggested_model == "gpt-4o-mini"


def test_size_fit_short_prompt_top_tier_steps_down_one_rung() -> None:
    # Top-tier on a short prompt only steps down ONE rung, never to the
    # bottom — so opus → sonnet, not opus → haiku.
    v = classify_size_fit(
        "Summarise this paragraph.",
        current_model="claude-opus-4-5",
        ladder=ANTHROPIC_LADDER,
    )
    assert v.fit is False
    assert v.suggested_model == "claude-sonnet-4-5"


def test_size_fit_smallest_tier_keeps_current() -> None:
    # Already on the bottom rung — no further downgrade possible.
    v = classify_size_fit(
        "Tiny lookup query.",
        current_model="claude-haiku-4-5",
        ladder=ANTHROPIC_LADDER,
    )
    assert v.fit is True
    assert v.suggested_model is None
    assert v.current_index == 0


def test_size_fit_complex_short_prompt_keeps_current() -> None:
    # Short but carries two `necessary` markers (architecture +
    # tradeoff) → complexity_hits >= 2 → keep current tier.
    v = classify_size_fit(
        "Strategic decision: architecture trade-off, stakeholders disagree.",
        current_model="claude-sonnet-4-5",
        ladder=ANTHROPIC_LADDER,
    )
    assert v.fit is True
    assert v.complexity_hits >= 2


def test_size_fit_long_prompt_keeps_current() -> None:
    # > 800 chars → long tier → keep current regardless of markers.
    long_prompt = "Implement the function as described. " * 30
    v = classify_size_fit(
        long_prompt,
        current_model="gpt-4o",
        ladder=OPENAI_LADDER,
    )
    assert v.fit is True
    assert v.length_tier == "long"


def test_size_fit_medium_simple_prompt_suggests_downgrade() -> None:
    # ~400 chars, no complexity markers → medium tier eligible for one-
    # rung downgrade.
    medium_prompt = "Please format this small JSON snippet. " * 10
    v = classify_size_fit(
        medium_prompt,
        current_model="gpt-4.1",
        ladder=OPENAI_LADDER,
    )
    assert v.fit is False
    assert v.suggested_model == "gpt-4o"
    assert v.length_tier == "medium"


def test_size_fit_medium_complex_prompt_keeps_current() -> None:
    medium_complex = (
        "Architecture decision: should we adopt microservices? "
        "Stakeholders disagree on the trade-off; we need to weigh the "
        "options and decide the long-term strategy. "
    ) * 4
    v = classify_size_fit(
        medium_complex,
        current_model="claude-sonnet-4-5",
        ladder=ANTHROPIC_LADDER,
    )
    assert v.fit is True
    assert v.complexity_hits >= 2


def test_size_fit_debate_lens_never_downgrades() -> None:
    # Even a trivial short prompt on the debate lens stays on the
    # current tier — dissent quality requires the top model.
    v = classify_size_fit(
        "Quick check.",
        current_model="claude-opus-4-5",
        ladder=ANTHROPIC_LADDER,
        lens="debate",
    )
    assert v.fit is True
    assert v.suggested_model is None
    assert "debate" in v.reason.lower()


def test_size_fit_unknown_model_returns_fit_true() -> None:
    # Model not on the ladder → caller should configure the ladder; do
    # not improvise a downgrade.
    v = classify_size_fit(
        "Anything.",
        current_model="some-unlisted-model",
        ladder=ANTHROPIC_LADDER,
    )
    assert v.fit is True
    assert v.suggested_model is None
    assert v.current_index == -1


def test_size_fit_empty_ladder_returns_fit_true() -> None:
    v = classify_size_fit(
        "Anything.",
        current_model="claude-sonnet-4-5",
        ladder=(),
    )
    assert v.fit is True
    assert v.suggested_model is None


def test_size_fit_empty_prompt_top_tier_suggests_downgrade() -> None:
    # Empty stripped prompt is length 0 → "short" tier, no complexity.
    v = classify_size_fit(
        "",
        current_model="claude-sonnet-4-5",
        ladder=ANTHROPIC_LADDER,
    )
    assert v.fit is False
    assert v.length_tier == "short"


def test_size_fit_verdict_is_frozen_dataclass() -> None:
    v = classify_size_fit(
        "x", current_model="gpt-4o", ladder=OPENAI_LADDER,
    )
    try:
        v.fit = True  # type: ignore[misc]
    except (AttributeError, Exception):
        return
    raise AssertionError("SizeFitVerdict must be frozen")


def test_size_fit_accepts_list_ladder() -> None:
    # YAML hands the ladder in as a list (not a tuple) — both shapes
    # must work.
    v = classify_size_fit(
        "tiny",
        current_model="gpt-4o",
        ladder=list(OPENAI_LADDER),
    )
    assert isinstance(v, SizeFitVerdict)
    assert v.fit is False
    assert v.suggested_model == "gpt-4o-mini"


def test_downgrade_message_mentions_models_and_reason() -> None:
    v = classify_size_fit(
        "short prompt",
        current_model="claude-sonnet-4-5",
        ladder=ANTHROPIC_LADDER,
    )
    msg = downgrade_message(v, "claude-sonnet-4-5")
    assert "claude-sonnet-4-5" in msg
    assert "claude-haiku-4-5" in msg
    assert "oversized" in msg.lower() or "reason" in msg.lower()



# --- Phase 10: Five-class impact classifier + routing -------------------


class _Entry:
    """Minimal stand-in for DecisionResolutionEntry — avoids the
    config import cycle from tests."""

    def __init__(self, mode: str, confidence_threshold: float = 0.6) -> None:
        self.mode = mode
        self.confidence_threshold = confidence_threshold


def _default_classes() -> dict[str, _Entry]:
    return {
        "trivial": _Entry("agent"),
        "low_impact": _Entry("agent"),
        "medium_impact": _Entry("council"),
        "high_impact": _Entry("user"),
        "user_required": _Entry("user"),
    }


def test_classify_impact_empty_is_user_required() -> None:
    v = classify_impact("")
    assert isinstance(v, ImpactVerdict)
    assert v.impact_class == "user_required"
    assert v.confidence == 1.0


def test_classify_impact_trivial_naming() -> None:
    v = classify_impact("What should I call this rename — typo in naming?")
    assert v.impact_class == "trivial"


def test_classify_impact_low_impact_dto() -> None:
    v = classify_impact("Should this DTO use composition or a value object?")
    assert v.impact_class == "low_impact"


def test_classify_impact_medium_impact_api_shape() -> None:
    v = classify_impact("Proposing an API shape change with breaking change.")
    assert v.impact_class == "medium_impact"


def test_classify_impact_high_impact_security() -> None:
    v = classify_impact("Adjust the auth policy for tenant boundary on this endpoint.")
    assert v.impact_class == "high_impact"
    assert v.confidence >= 0.85


def test_classify_impact_user_fence_marker() -> None:
    v = classify_impact("plan only — review first before any change")
    assert v.impact_class == "user_required"
    assert v.confidence == 1.0


def test_classify_impact_high_impact_beats_lower_classes() -> None:
    # Mix: trivial + high — Iron-Law severity precedence picks high.
    v = classify_impact(
        "rename this column and adjust the migration that touches auth."
    )
    assert v.impact_class == "high_impact"


def test_classify_impact_default_when_no_markers() -> None:
    v = classify_impact("Some opaque question with zero markers.")
    assert v.impact_class == "medium_impact"
    assert v.confidence <= 0.4


def test_locked_impact_classes_set_shape() -> None:
    assert LOCKED_IMPACT_CLASSES == frozenset({"high_impact", "user_required"})


def test_route_decision_trivial_goes_to_agent() -> None:
    r = route_decision("rename to camelCase", _default_classes())
    assert isinstance(r, DecisionRouting)
    assert r.mode == "agent"
    assert r.upgraded is False


def test_route_decision_high_impact_always_user() -> None:
    classes = _default_classes()
    # Even if a malicious caller hands us mode=agent — Iron Law fires.
    classes["high_impact"] = _Entry("agent")
    r = route_decision("rotate the auth secret", classes)
    assert r.mode == "user"
    assert "Iron-Law" in r.rationale or "locked" in r.rationale.lower()


def test_route_decision_user_fence_marker_is_user() -> None:
    r = route_decision("rename foo — plan only please", _default_classes())
    assert r.mode == "user"


def test_route_decision_low_confidence_upgrades_one_rung() -> None:
    # No markers → medium_impact / confidence 0.3 → below 0.6 threshold,
    # routing entry default is `council`. Low confidence promotes one
    # rung up to `user`.
    classes = _default_classes()
    r = route_decision("unclear question without markers", classes)
    assert r.verdict.impact_class == "medium_impact"
    assert r.mode == "user"
    assert r.upgraded is True


def test_route_decision_no_entry_falls_back_to_user() -> None:
    r = route_decision("rename this variable", {})
    assert r.mode == "user"
    assert "fallback" in r.rationale.lower() or "defaulting" in r.rationale.lower()
