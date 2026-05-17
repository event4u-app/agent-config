"""Phase 4 Step 3 — Prompt optimization contract tests.

The ``prompt-optimizer`` skill is implemented as a markdown-driven
agent-in-the-loop contract, not a Python module. These tests validate
that the contract artefacts (skill body, settings template, sibling
``refine-prompt``, public-figures policy linkage) carry the load-bearing
clauses the roadmap and the supporting rules depend on.

Filesystem only — no LLM calls, no network. Covered:

1. BASIC vs DETAIL classifier path is documented with detection signals.
2. Clarifying-question generation is single-question per turn
   (cites ``ask-when-uncertain`` Iron Law).
3. The skill does not instruct the model to echo or paraphrase user
   secrets; the redaction expectation is wired through
   ``language-and-tone`` / settings (``bypass_prefix``).
4. Round-trip stability — bypass_prefix path (``/raw``) emits the
   prompt verbatim (idempotent).
5. Public-figure refusal path — the policy file is reachable from
   code (importable path) AND the routing rule cites it,
   single-question (``ask-when-uncertain``) is honoured.
"""
from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent

PROMPT_OPTIMIZER = (
    REPO_ROOT / ".agent-src.uncompressed" / "skills" / "prompt-optimizer" / "SKILL.md"
)
REFINE_PROMPT = (
    REPO_ROOT / ".agent-src.uncompressed" / "skills" / "refine-prompt" / "SKILL.md"
)
SETTINGS_TEMPLATE = (
    REPO_ROOT
    / ".agent-src.uncompressed"
    / "templates"
    / "agents"
    / "agent-project-settings.example.yml"
)
PUBLIC_FIGURES_POLICY = REPO_ROOT / "agents" / "policies" / "media" / "public-figures.md"
MEDIA_ROUTING_RULE = (
    REPO_ROOT / ".agent-src.uncompressed" / "rules" / "media-governance-routing.md"
)
ASK_WHEN_UNCERTAIN_RULE = (
    REPO_ROOT / ".agent-src.uncompressed" / "rules" / "ask-when-uncertain.md"
)


# ---------------------------------------------------------------------------
# (1) BASIC vs DETAIL classifier path
# ---------------------------------------------------------------------------

def test_basic_vs_detail_classifier_documents_detection_signals() -> None:
    """The skill body MUST publish the auto-detect signal table the
    dispatcher relies on. Without it, the classifier is a black box.
    """
    body = PROMPT_OPTIMIZER.read_text(encoding="utf-8")
    assert "BASIC" in body and "DETAIL" in body
    for signal in (
        "One-line ask",
        "Multi-paragraph",
        "Tiebreaker",
    ):
        assert signal in body, (
            f"prompt-optimizer skill missing classifier signal '{signal}' — "
            "BASIC/DETAIL auto-detect would be unspecified"
        )
    # Tiebreaker MUST default to the safer path (DETAIL).
    tiebreaker = re.search(r"Tiebreaker.*?DETAIL", body, flags=re.DOTALL)
    assert tiebreaker is not None, "Tiebreaker MUST resolve to DETAIL (safer)."


# ---------------------------------------------------------------------------
# (2) Single-question-per-turn — ask-when-uncertain Iron Law
# ---------------------------------------------------------------------------

def test_clarifying_question_is_single_per_turn() -> None:
    """DETAIL path MUST ask exactly one clarifying question per turn,
    citing the ``ask-when-uncertain`` Iron Law. Batching questions
    violates the kernel rule.
    """
    body = PROMPT_OPTIMIZER.read_text(encoding="utf-8")
    assert "one question per turn" in body.lower() or "one per turn" in body.lower(), (
        "prompt-optimizer must enforce one-question-per-turn"
    )
    assert "ask-when-uncertain" in body, (
        "prompt-optimizer must cite the ask-when-uncertain Iron Law"
    )
    # The Iron Law itself must exist with the one-question clause.
    iron_law = ASK_WHEN_UNCERTAIN_RULE.read_text(encoding="utf-8")
    assert "ONE QUESTION PER TURN" in iron_law, (
        "ask-when-uncertain rule lost its ONE QUESTION PER TURN Iron Law"
    )


# ---------------------------------------------------------------------------
# (3) No secret echo — bypass_prefix + Do-NOT block
# ---------------------------------------------------------------------------

def test_optimizer_does_not_echo_secrets_in_input() -> None:
    """The skill MUST (a) honour a ``bypass_prefix`` so a user can
    submit a raw prompt without having it restructured, AND (b) include
    a Do-NOT block that forbids executing the prompt and returning its
    answer unless the user explicitly asks. Both clauses together stop
    the optimiser from leaking a secret-bearing prompt back through an
    LLM call.
    """
    body = PROMPT_OPTIMIZER.read_text(encoding="utf-8")
    assert "bypass_prefix" in body and "/raw" in body, (
        "prompt-optimizer missing bypass_prefix / /raw clause — secret-safe "
        "verbatim path lost"
    )
    assert "Do NOT execute the optimized prompt" in body, (
        "prompt-optimizer missing Do-NOT-execute clause — optimiser may "
        "leak secret-bearing prompt back through an LLM call"
    )


# ---------------------------------------------------------------------------
# (4) Round-trip stability — idempotent on /raw prompts
# ---------------------------------------------------------------------------

def test_round_trip_stability_via_bypass_prefix() -> None:
    """The skill MUST instruct the model to echo a ``bypass_prefix``
    prompt verbatim. This is the contract guarantee for idempotency:
    re-running the optimiser on an already-optimised prompt that the
    user wraps with ``/raw`` returns the same text.
    """
    body = PROMPT_OPTIMIZER.read_text(encoding="utf-8")
    # Both the Setting-awareness section and the Do-NOT section must
    # mention the verbatim-echo expectation.
    assert "echoed verbatim" in body or "Echo it verbatim" in body, (
        "prompt-optimizer missing verbatim-echo clause for bypass_prefix"
    )
    # Sibling refine-prompt skill MUST honour the same setting so the
    # round-trip survives across the engine-inbound / engine-outbound
    # split.
    sibling = REFINE_PROMPT.read_text(encoding="utf-8")
    assert "bypass_prefix" in sibling, (
        "refine-prompt sibling lost bypass_prefix — round-trip stability "
        "broken across engine-inbound / engine-outbound split"
    )


# ---------------------------------------------------------------------------
# (5) Public-figure refusal path — agent-in-the-loop reachability
# ---------------------------------------------------------------------------

def test_public_figure_refusal_path_is_reachable_from_routing_rule() -> None:
    """Per the Council-debate verdict, naming a public figure MUST
    surface the project-local policy through the routing rule, and the
    refusal MUST be a single question (not silent, not batched).

    The contract has three structural links:

    1. The policy file exists at the load-bearing path.
    2. The Iron Law is "ask one question; do not render" — not silent
       refusal.
    3. The media-governance routing rule cites the policy so the agent
       reaches it on a ``/video:*`` or ``in the voice of`` trigger.
    """
    assert PUBLIC_FIGURES_POLICY.is_file(), (
        f"public-figures policy missing at {PUBLIC_FIGURES_POLICY} — "
        "refusal path is unreachable"
    )
    policy = PUBLIC_FIGURES_POLICY.read_text(encoding="utf-8")
    assert "ASK ONE QUESTION; DO NOT RENDER" in policy, (
        "public-figures policy lost its single-question Iron Law"
    )

    routing = MEDIA_ROUTING_RULE.read_text(encoding="utf-8")
    assert "agents/policies/media/public-figures.md" in routing, (
        "media-governance-routing rule no longer cites public-figures.md "
        "— agent cannot reach the refusal path from a video trigger"
    )
    assert "in the voice of" in routing and "/video:" in routing, (
        "media-governance-routing rule lost a trigger that activates "
        "the public-figure refusal path"
    )
