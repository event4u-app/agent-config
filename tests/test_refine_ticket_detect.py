"""Tests for scripts.refine_ticket_detect.

Covers the orchestration-wiring Phase 2 items of road-to-ticket-refinement:
  - validate-feature-fit invocation path verified on a duplicate-intent ticket
  - threat-modeling invocation path verified on a security-sensitive ticket
  - Clean ticket fires neither sub-skill
  - orchestration-notes format matches the skill's output contract
  - detection-map loads and reports a known version
"""
from __future__ import annotations

from pathlib import Path

import pytest

from scripts.refine_ticket_detect import (
    Decision,
    SubSkillDecision,
    detect,
    load_map,
)

REPO_ROOT = Path(__file__).resolve().parent.parent
FIXTURES = REPO_ROOT / "tests" / "fixtures" / "refine_ticket"


def _load_fixture(name: str) -> str:
    return (FIXTURES / f"{name}.md").read_text(encoding="utf-8")


@pytest.fixture(scope="module")
def detection_map() -> dict:
    return load_map()


def _get(decision: Decision, skill: str) -> SubSkillDecision:
    for ss in decision.sub_skills:
        if ss.skill == skill:
            return ss
    raise AssertionError(f"sub-skill {skill!r} missing from decision")


def test_detection_map_has_both_sub_skills(detection_map):
    assert detection_map["version"] == 1
    assert "validate-feature-fit" in detection_map["sub_skills"]
    assert "threat-modeling" in detection_map["sub_skills"]


def test_clean_ticket_fires_nothing(detection_map):
    body = _load_fixture("clean")
    decision = detect(body, detection_map)
    assert _get(decision, "validate-feature-fit").fired is False
    assert _get(decision, "threat-modeling").fired is False


def test_duplicate_intent_fires_validate_feature_fit(detection_map):
    body = _load_fixture("duplicate_intent")
    decision = detect(body, detection_map)
    vff = _get(decision, "validate-feature-fit")
    assert vff.fired, (
        "expected validate-feature-fit to fire on duplicate-intent "
        f"fixture, matched={vff.matched_keywords}"
    )
    assert len(vff.matched_keywords) >= vff.require_count
    # Spot-check: the fixture names notifications, reporting, invoicing
    assert "notifications" in vff.matched_keywords
    assert "reporting" in vff.matched_keywords


def test_security_sensitive_fires_threat_modeling(detection_map):
    body = _load_fixture("security_sensitive")
    decision = detect(body, detection_map)
    tm = _get(decision, "threat-modeling")
    assert tm.fired, (
        "expected threat-modeling to fire on security-sensitive "
        f"fixture, matched={tm.matched_keywords}"
    )
    # Multiple security signals present
    assert "webhook" in tm.matched_keywords
    assert "secret" in tm.matched_keywords or "api key" in tm.matched_keywords
    assert "tenant" in tm.matched_keywords


def test_security_sensitive_matches_cve_regex(detection_map):
    body = _load_fixture("security_sensitive")
    decision = detect(body, detection_map)
    tm = _get(decision, "threat-modeling")
    assert any("CVE" in rx for rx in tm.matched_regex)


def test_orchestration_notes_format(detection_map):
    body = _load_fixture("duplicate_intent")
    decision = detect(body, detection_map)
    notes = decision.orchestration_notes()
    assert len(notes) == 3  # 2 sub-skills + repo-aware line
    assert any(n.startswith("`validate-feature-fit`") for n in notes)
    assert any(n.startswith("`threat-modeling`") for n in notes)
    assert any(n.startswith("Repo-aware") for n in notes)


def test_orchestration_notes_visible_in_output(detection_map):
    """Fires signal must be visible in the output line, not silent."""
    body = _load_fixture("security_sensitive")
    decision = detect(body, detection_map)
    tm = _get(decision, "threat-modeling")
    tm_line = tm.as_output_line()
    assert "fired on:" in tm_line
    # Line shows the first five matches; "webhook" must at least be in
    # the structured match list even if truncated in the visible line.
    assert "webhook" in tm.matched_keywords

    clean_body = _load_fixture("clean")
    clean_decision = detect(clean_body, detection_map)
    vff_line = _get(clean_decision, "validate-feature-fit").as_output_line()
    assert "skipped" in vff_line


def test_repo_aware_detects_this_repo(detection_map):
    body = _load_fixture("clean")
    decision = detect(body, detection_map, cwd=REPO_ROOT)
    assert decision.repo_aware is True


def test_repo_aware_off_outside_repo(detection_map, tmp_path):
    body = _load_fixture("clean")
    decision = detect(body, detection_map, cwd=tmp_path)
    assert decision.repo_aware is False
