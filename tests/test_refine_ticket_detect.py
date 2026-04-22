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
    RepoContext,
    SubSkillDecision,
    detect,
    gather_repo_context,
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


# ---- Phase 3 — repo-aware mode ---------------------------------------------


def test_gather_repo_context_outside_repo(tmp_path):
    """Outside a repo the context stays empty — graceful degrade."""
    ctx = gather_repo_context(tmp_path)
    assert ctx.is_empty()
    assert ctx.summary_line() == "Repo context — none gathered"


def test_gather_repo_context_inside_this_repo():
    """Inside this repo we expect branches + commits; context_docs only when agents/contexts/ exists."""
    ctx = gather_repo_context(REPO_ROOT)
    assert not ctx.is_empty()
    assert len(ctx.recent_branches) > 0, "expected at least one branch"
    assert len(ctx.recent_commits) > 0, "expected at least one commit"
    # context_docs is optional — only populated when agents/contexts/ exists.
    # Consumer projects typically have it; this package does not.


def test_gather_repo_context_finds_context_docs(tmp_path):
    """When agents/contexts/ exists and has .md files, they get listed."""
    subprocess = __import__("subprocess")
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, check=True)
    subprocess.run(
        ["git", "commit", "-q", "--allow-empty", "-m", "init"],
        cwd=tmp_path,
        check=True,
        env={
            "GIT_AUTHOR_NAME": "t",
            "GIT_AUTHOR_EMAIL": "t@t",
            "GIT_COMMITTER_NAME": "t",
            "GIT_COMMITTER_EMAIL": "t@t",
            "PATH": __import__("os").environ["PATH"],
        },
    )
    contexts = tmp_path / "agents" / "contexts"
    contexts.mkdir(parents=True)
    (contexts / "auth-model.md").write_text("# auth")
    (contexts / "tenant-boundaries.md").write_text("# tenancy")
    ctx = gather_repo_context(tmp_path)
    assert set(ctx.context_docs) == {"auth-model.md", "tenant-boundaries.md"}


def test_detect_populates_repo_context_when_repo_aware(detection_map):
    body = _load_fixture("clean")
    decision = detect(body, detection_map, cwd=REPO_ROOT)
    assert decision.repo_aware is True
    assert not decision.repo_context.is_empty()


def test_detect_repo_context_empty_outside_repo(detection_map, tmp_path):
    body = _load_fixture("clean")
    decision = detect(body, detection_map, cwd=tmp_path)
    assert decision.repo_aware is False
    assert decision.repo_context.is_empty()


def test_orchestration_notes_include_repo_context_when_on(detection_map):
    body = _load_fixture("clean")
    decision = detect(body, detection_map, cwd=REPO_ROOT)
    notes = decision.orchestration_notes()
    assert any(n.startswith("Repo context — ") for n in notes)
    assert any("branches" in n and "commits" in n for n in notes)


def test_orchestration_notes_omit_repo_context_when_off(detection_map, tmp_path):
    body = _load_fixture("clean")
    decision = detect(body, detection_map, cwd=tmp_path)
    notes = decision.orchestration_notes()
    # Graceful degrade: same line shape, minus the repo-context line
    assert any("Repo-aware — off" in n for n in notes)
    assert not any(n.startswith("Repo context — ") for n in notes)


def test_graceful_degrade_output_shape_parity(detection_map, tmp_path):
    """Outside-repo output keeps the same sub-skill lines as inside-repo."""
    body = _load_fixture("clean")
    inside = detect(body, detection_map, cwd=REPO_ROOT).orchestration_notes()
    outside = detect(body, detection_map, cwd=tmp_path).orchestration_notes()
    # Sub-skill lines must match 1:1; only the repo-context tail differs.
    inside_subskills = [n for n in inside if n.startswith("`")]
    outside_subskills = [n for n in outside if n.startswith("`")]
    assert inside_subskills == outside_subskills
