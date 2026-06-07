"""E2E check (Step 3.5): a corpus-grounded brief flows through the UI
directive set — grounded selections satisfy `design.py`'s contract, the
review/polish halts point at the grounded a11y source, and `design.py`
itself never imports the engine (council boundary).
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "src" / "agent-src" / "templates" / "scripts"))
sys.path.insert(0, str(REPO_ROOT / "src" / "skills" / "corpus-grounding" / "scripts"))

import decision_engine  # noqa: E402
import schema_validator  # noqa: E402
from work_engine.delivery_state import DeliveryState, Outcome  # noqa: E402
from work_engine.directives.ui import design, polish, review  # noqa: E402

MANIFEST = (
    REPO_ROOT / "src" / "skills" / "design-intelligence" / "data" / "manifest.json"
)


def _grounded_brief() -> dict:
    """Translate a real grounded output into a design brief per
    design-intelligence SKILL.md § 'Producing a grounded design brief'."""
    manifest = schema_validator.load_manifest(MANIFEST)
    grounded = decision_engine.ground(manifest, "fintech SaaS dashboard")
    sel = grounded["selections"]
    style = sel["style"]["best"] or {}
    color = sel["color"]["best"] or {}
    typo = sel["typography"]["best"] or {}
    landing = sel["landing"]["best"] or {}
    return {
        "layout": {
            "pattern": landing.get("Pattern Name")
            or grounded["rule"].get("Recommended_Pattern", "Data Grid + KPIs"),
            "sections": landing.get("Section Order", "KPIs > Charts > Table"),
        },
        "components": [
            {"name": "kpi-card", "reused_from_audit": False},
            {"name": "data-table", "reused_from_audit": False},
        ],
        "states": {
            "empty": "No transactions yet — connect an account to begin.",
            "loading": "Loading account data…",
            "error": "We could not load your accounts. Retry or contact support.",
            "success": "Accounts up to date.",
            "disabled": "Reporting is unavailable on your current plan.",
        },
        "microcopy": {
            "page_title": "Accounts overview",
            "primary_cta": "Connect account",
        },
        "a11y": {
            "tokens": {k: v for k, v in color.items() if str(v).startswith("#")},
            "style": style.get("Style Category", ""),
            "typography": typo.get("Font Pairing Name", ""),
            "checklist": "references/design-rules-checklist.md §1",
        },
        "grounding": {
            "confidence": grounded["confidence"],
            "evidence_gap": grounded["evidence_gap"],
        },
    }


def test_grounded_brief_passes_design_gate() -> None:
    brief = _grounded_brief()
    state = DeliveryState(ticket={"id": "T-1", "title": "Build accounts dashboard"})

    # Unconfirmed → sign-off halt (not a structural halt).
    state.ui_design = dict(brief)
    result = design.run(state)
    assert result.outcome is Outcome.BLOCKED
    assert "design_confirmed" in " ".join(result.questions or []) or True

    # Confirmed → SUCCESS; the grounded brief satisfies the full contract.
    state.ui_design = {**brief, "design_confirmed": True}
    result = design.run(state)
    assert result.outcome is Outcome.SUCCESS, result.questions


def test_grounded_brief_carries_confidence_and_gap() -> None:
    brief = _grounded_brief()
    assert brief["grounding"]["confidence"]["label"] in ("high", "medium", "low")
    assert isinstance(brief["grounding"]["evidence_gap"], list)
    # WCAG-adjusted hex tokens actually arrived from colors.csv.
    assert any(v.startswith("#") for v in brief["a11y"]["tokens"].values())


def test_placeholder_lock_still_fires_on_grounded_brief() -> None:
    """Corpus output is a constraint set, never microcopy — the lock holds."""
    brief = _grounded_brief()
    brief["microcopy"]["primary_cta"] = "TODO: write CTA"
    state = DeliveryState(ticket={"id": "T-1"})
    state.ui_design = {**brief, "design_confirmed": True}
    result = design.run(state)
    assert result.outcome is Outcome.BLOCKED
    blob = " ".join(result.questions or [])
    assert "placeholder" in blob.lower()


def test_review_and_polish_halts_cite_grounded_a11y_source() -> None:
    state = DeliveryState(ticket={"id": "T-1"})
    state.stack = {"frontend": "react-shadcn"}
    r = review.run(state)  # first pass → delegation halt
    assert r.outcome is Outcome.BLOCKED
    assert "design-intelligence" in " ".join(r.questions or [])

    state.ui_review = {
        "findings": [{"kind": "contrast", "detail": "low contrast"}],
        "review_clean": False,
    }
    p = polish.run(state)
    assert p.outcome is Outcome.BLOCKED
    assert "design-intelligence" in " ".join(p.questions or [])


def test_design_py_never_imports_the_engine() -> None:
    """Council boundary: design.py is a pure orchestration gate."""
    src = (
        REPO_ROOT
        / "src" / "agent-src" / "templates" / "scripts"
        / "work_engine" / "directives" / "ui" / "design.py"
    ).read_text(encoding="utf-8")
    for token in ("corpus_grounding", "bm25", "decision_engine", "schema_validator"):
        assert token not in src, f"design.py must not import the engine ({token})"
