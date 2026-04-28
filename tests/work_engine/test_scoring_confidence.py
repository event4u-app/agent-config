"""Unit tests for ``work_engine.scoring.confidence``.

The scorer is heuristic-only and the dispatcher routes on its band.
These tests pin two contracts:

- Each per-dimension scorer maps the documented signal to the
  documented score (0/1/2). One representative case per branch.
- The band thresholds match the roadmap (``high ≥ 0.8``,
  ``medium 0.5–0.79``, ``low < 0.5``) on the boundary values.

The fixtures below are intentionally small and abstract — the
end-to-end dispatcher fixtures live in
``tests/work_engine/test_refine_prompt_dispatch.py``.
"""
from __future__ import annotations

import pytest

from work_engine.scoring import confidence as c


class TestGoalClarity:
    def test_action_verb_with_bounded_length_scores_two(self) -> None:
        result = c.score(raw="Add a CSV export endpoint to the audit log", ac=[])
        assert result.dimensions["goal_clarity"] == 2

    def test_question_scores_zero(self) -> None:
        result = c.score(raw="Why is this slow?", ac=[])
        assert result.dimensions["goal_clarity"] == 0

    def test_conjunction_split_caps_at_one(self) -> None:
        result = c.score(raw="Refactor auth and also rewrite the dashboard", ac=[])
        assert result.dimensions["goal_clarity"] == 1

    def test_no_recognised_verb_scores_zero(self) -> None:
        result = c.score(raw="Make it nicer", ac=[])
        assert result.dimensions["goal_clarity"] == 0


class TestScopeBoundary:
    def test_explicit_file_path_scores_two(self) -> None:
        result = c.score(raw="Fix bug in app/Http/Controllers/UserController.php", ac=[])
        assert result.dimensions["scope_boundary"] == 2

    def test_php_namespace_scores_two(self) -> None:
        result = c.score(raw="Refactor App\\Services\\Billing", ac=[])
        assert result.dimensions["scope_boundary"] == 2

    def test_domain_noun_only_scores_one(self) -> None:
        result = c.score(raw="Refactor authentication logic", ac=[])
        assert result.dimensions["scope_boundary"] == 1

    def test_no_anchor_scores_zero(self) -> None:
        result = c.score(raw="Improve performance", ac=[])
        assert result.dimensions["scope_boundary"] == 0


class TestAcceptanceEvidence:
    def test_three_anchored_criteria_scores_two(self) -> None:
        result = c.score(
            raw="Add export",
            ac=[
                "Endpoint should return CSV.",
                "Empty range must return 204.",
                "Given a 30-day range, then stream the rows.",
            ],
        )
        assert result.dimensions["ac_evidence"] == 2

    def test_one_unanchored_criterion_scores_one(self) -> None:
        result = c.score(raw="Add export", ac=["faster"])
        assert result.dimensions["ac_evidence"] == 1

    def test_empty_list_scores_zero(self) -> None:
        result = c.score(raw="Add export", ac=[])
        assert result.dimensions["ac_evidence"] == 0


class TestStackData:
    def test_no_stack_signal_scores_two(self) -> None:
        result = c.score(raw="Refactor the controller", ac=[])
        assert result.dimensions["stack_data"] == 2

    def test_stack_signal_with_target_scores_two(self) -> None:
        result = c.score(raw="Add a column email_verified_at", ac=[])
        assert result.dimensions["stack_data"] == 2

    def test_stack_signal_without_target_scores_zero(self) -> None:
        result = c.score(raw="Run a database migration", ac=[])
        assert result.dimensions["stack_data"] == 0


class TestReversibility:
    def test_irreversible_keyword_scores_zero(self) -> None:
        result = c.score(raw="Drop the production users table", ac=[])
        assert result.dimensions["reversibility"] == 0

    def test_config_keyword_scores_one(self) -> None:
        result = c.score(raw="Update the deploy config", ac=[])
        assert result.dimensions["reversibility"] == 1

    def test_plain_code_change_scores_two(self) -> None:
        result = c.score(raw="Refactor the controller", ac=[])
        assert result.dimensions["reversibility"] == 2


class TestBandThresholds:
    @pytest.mark.parametrize("score_value,expected", [
        (1.0, "high"),
        (0.8, "high"),       # inclusive lower bound — roadmap contract
        (0.79, "medium"),
        (0.5, "medium"),     # inclusive lower bound
        (0.49, "low"),
        (0.0, "low"),
    ])
    def test_band_from_score(self, score_value: float, expected: str) -> None:
        assert c._band_from_score(score_value) == expected

    def test_score_is_normalised_against_max(self) -> None:
        # All five dimensions perfect → 10/10 → 1.0.
        result = c.score(
            raw="Add a CSV export endpoint to the audit log; "
                "stream up to 90 days. File: app/Http/Controllers/AuditLogController.php",
            ac=[
                "Should return CSV.",
                "Empty ranges must return 204.",
                "Given 30 days, then stream rows.",
            ],
        )
        assert result.score == 1.0
        assert result.band == "high"


class TestUiIntent:
    def test_ui_keyword_flags_intent(self) -> None:
        result = c.score(raw="Tweak the dashboard tailwind layout", ac=[])
        assert result.ui_intent is True

    def test_no_ui_keyword_keeps_flag_false(self) -> None:
        result = c.score(raw="Refactor the billing service", ac=[])
        assert result.ui_intent is False


class TestImmutability:
    def test_result_is_frozen(self) -> None:
        result = c.score(raw="Add a feature", ac=[])
        with pytest.raises(Exception):  # FrozenInstanceError subclass of AttributeError
            result.band = "medium"  # type: ignore[misc]
