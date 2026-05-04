"""Phase 2.4 outcome baselines — locked behavior contracts.

CI fails if a future change degrades any of the three locked baselines
without an explicit roadmap entry (per Phase 2.4 of
`agents/roadmaps/road-to-context-layer-maturity.md`). Scope and scaling
criteria for adding rule #4 onward live in
`tests/golden/outcomes/README.md`.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from tests.golden.outcomes.scorer import score

OUTCOMES_DIR = Path(__file__).parent / "golden" / "outcomes"

LOCKED_BASELINES = [
    "ask_when_uncertain.json",
    "verify_before_complete.json",
    "direct_answers.json",
]


@pytest.mark.parametrize("fixture_name", LOCKED_BASELINES)
def test_outcome_baseline_matches_iron_law_shape(fixture_name: str) -> None:
    """Each locked fixture's `baseline_reply` must satisfy its Iron-Law
    shape contract (expected/forbidden patterns + counters).

    A failure here means either the fixture drifted or the Iron Law it
    encodes was relaxed without a roadmap entry. Re-lock by editing the
    fixture *and* the corresponding rule, never the scorer.
    """
    fixture = OUTCOMES_DIR / fixture_name
    assert fixture.exists(), f"missing locked outcome fixture: {fixture}"
    ok, failures = score(fixture)
    assert ok, (
        f"Outcome baseline {fixture_name} drifted from its Iron-Law "
        f"shape contract:\n  - " + "\n  - ".join(failures)
    )
