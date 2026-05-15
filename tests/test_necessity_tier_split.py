"""Step-8 Phase 5 — two-tier necessity-classifier dispatch tests.

Behavioural contract (step-8 D2):

- ``invocation="user_explicit"`` defaults to ``warn-only`` — the
  verdict is annotated on stdout but the dispatcher **proceeds** with
  ``exit 0``. No ``--proceed-anyway`` needed.
- ``invocation="agent"`` keeps the legacy ``educate`` default — an
  ``unnecessary`` verdict skips the run silently with ``exit 0``.
- Legacy ``mode=block`` survives unchanged: both tiers are blocked
  with ``exit 0`` and the ``--proceed-anyway`` flag has no effect.
- ``mode=off`` (either tier) short-circuits before
  ``classify_necessity`` runs.
- The ``user_explicit_mode`` knob can downgrade the user-tier
  back to ``educate`` for callers that prefer the strict default.

Test prompts use the keyword-heuristic vocabulary the classifier
expects: short imperatives with ``fix … bug`` shape land in the
``trivial_fix`` / ``unnecessary`` bucket; an open-ended trade-off
question lands on ``necessary``.
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts import council_cli  # noqa: E402

_UNNECESSARY_PROMPT = "fix the typo crash failing test bug"


def _cfg(mode: str = "educate", user_explicit_mode: str | None = "warn-only") -> dict:
    block = {"enabled": True, "mode": mode}
    if user_explicit_mode is not None:
        block["user_explicit_mode"] = user_explicit_mode
    return {"necessity_classifier": block}


def test_user_explicit_unnecessary_proceeds_with_warn_only_default() -> None:
    """User-typed call + unnecessary verdict → annotated proceed (exit 0)."""
    buf = io.StringIO()
    proceed, rc, result = council_cli._necessity_gate(
        prompt=_UNNECESSARY_PROMPT,
        lens="analysis",
        invocation="user_explicit",
        proceed_anyway=False,
        ai_cfg=_cfg(mode="educate", user_explicit_mode="warn-only"),
        stdout=buf,
    )
    assert proceed is True
    assert rc == 0
    assert result is not None
    assert result.verdict == "unnecessary"
    out = buf.getvalue()
    assert "warn-only" in out
    assert "skipped" not in out


def test_agent_unnecessary_skips_silently_with_educate_default() -> None:
    """Agent-initiated call + unnecessary verdict → silent skip (exit 0)."""
    buf = io.StringIO()
    proceed, rc, result = council_cli._necessity_gate(
        prompt=_UNNECESSARY_PROMPT,
        lens="analysis",
        invocation="agent",
        proceed_anyway=False,
        ai_cfg=_cfg(mode="educate", user_explicit_mode="warn-only"),
        stdout=buf,
    )
    assert proceed is False
    assert rc == 0
    assert result is not None
    assert result.verdict == "unnecessary"
    assert "skipped (agent" in buf.getvalue()


def test_legacy_block_mode_blocks_both_tiers_ignoring_proceed_anyway() -> None:
    """Backward-compat: ``mode=block`` still blocks both tiers."""
    for invocation in ("user_explicit", "agent"):
        buf = io.StringIO()
        proceed, rc, _ = council_cli._necessity_gate(
            prompt=_UNNECESSARY_PROMPT,
            lens="analysis",
            invocation=invocation,
            proceed_anyway=True,
            ai_cfg=_cfg(mode="block", user_explicit_mode="block"),
            stdout=buf,
        )
        assert proceed is False, invocation
        assert rc == 0, invocation
        assert "mode=block" in buf.getvalue()


def test_user_explicit_mode_off_short_circuits_before_classifier() -> None:
    """``user_explicit_mode=off`` → no classify, no stdout, proceed."""
    buf = io.StringIO()
    proceed, rc, result = council_cli._necessity_gate(
        prompt=_UNNECESSARY_PROMPT,
        lens="analysis",
        invocation="user_explicit",
        proceed_anyway=False,
        ai_cfg=_cfg(mode="educate", user_explicit_mode="off"),
        stdout=buf,
    )
    assert proceed is True
    assert rc == 0
    assert result is None  # gate returns None when mode resolves to off
    assert buf.getvalue() == ""


def test_user_explicit_mode_educate_downgrades_to_legacy_behaviour() -> None:
    """``user_explicit_mode=educate`` → educate stdout + exit 2 path."""
    buf = io.StringIO()
    proceed, rc, _ = council_cli._necessity_gate(
        prompt=_UNNECESSARY_PROMPT,
        lens="analysis",
        invocation="user_explicit",
        proceed_anyway=False,
        ai_cfg=_cfg(mode="educate", user_explicit_mode="educate"),
        stdout=buf,
    )
    assert proceed is False
    assert rc == 2
    assert "--proceed-anyway" in buf.getvalue()


def test_necessary_verdict_proceeds_on_both_tiers() -> None:
    """``necessary`` short-circuits the warn/skip path — both tiers proceed."""
    necessary = (
        "Should we refactor the service boundary? Stakeholders "
        "disagree on the architecture trade-off."
    )
    for invocation in ("user_explicit", "agent"):
        buf = io.StringIO()
        proceed, rc, result = council_cli._necessity_gate(
            prompt=necessary,
            lens="analysis",
            invocation=invocation,
            proceed_anyway=False,
            ai_cfg=_cfg(mode="educate", user_explicit_mode="warn-only"),
            stdout=buf,
        )
        assert proceed is True, invocation
        assert rc == 0, invocation
        assert result is not None
        assert result.verdict == "necessary"
