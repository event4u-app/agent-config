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
    CLOSE_PROMPT_FULL,
    CLOSE_PROMPT_READ_ONLY,
    Decision,
    ProjectAlignment,
    RepoContext,
    SubSkillDecision,
    _evaluate_alt_signals,
    _extract_ac_first_words,
    _extract_description_body,
    _extract_ticket_project_key,
    _gather_repo_identifiers,
    _match_project,
    _split_sentences,
    detect,
    fold_parent_context,
    gather_repo_context,
    issuetype_needs_parent,
    load_map,
    render_close_prompt,
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
    """Inside this repo we expect commits; branches may be empty on CI (shallow / detached-HEAD checkout)."""
    ctx = gather_repo_context(REPO_ROOT)
    assert not ctx.is_empty()
    assert len(ctx.recent_commits) > 0, "expected at least one commit"
    # recent_branches is best-effort — GitHub Actions' default `actions/checkout`
    # uses a detached HEAD with no local refs under refs/heads/, so this list
    # is legitimately empty in CI. The commit log is the load-bearing signal.
    # context_docs is optional — only populated when agents/contexts/ exists.


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


# ---- Phase F2 — word-boundary keyword matching ----------------------------


def test_onepassword_does_not_fire_password_keyword(detection_map):
    """Substring `password` inside `1Password` must not trigger threat-modeling.

    Phase F2: the pre-F2 implementation used `kw in text_lower` which
    fired on any substring — causing a false positive on product names
    like `1Password`. The new word-boundary regex + blocklist combo
    must suppress the match.
    """
    body = (
        "## Ticket\n\n"
        "Users asked us to document the 1Password rollout.\n"
        "No sign-in flow changes are planned — this is a docs-only ticket.\n"
    )
    decision = detect(body, detection_map)
    tm = _get(decision, "threat-modeling")
    assert tm.fired is False, (
        f"1Password must not trigger threat-modeling — matched={tm.matched_keywords}"
    )


def test_lastpass_does_not_fire_password_keyword(detection_map):
    body = "We use LastPass to store shared secrets for the team."
    decision = detect(body, detection_map)
    tm = _get(decision, "threat-modeling")
    # `secret` + `secrets` are still valid signals — but `password` must
    # not appear in the match list from the `LastPass` substring.
    assert "password" not in tm.matched_keywords


def test_bitwarden_does_not_fire_password_keyword(detection_map):
    body = "Document the Bitwarden browser-extension rollout for staff."
    decision = detect(body, detection_map)
    tm = _get(decision, "threat-modeling")
    assert "password" not in tm.matched_keywords
    assert tm.fired is False


def test_real_password_reset_still_fires(detection_map):
    """Word-boundary matching must not suppress legitimate matches."""
    body = "Implement the password reset flow with email token verification."
    decision = detect(body, detection_map)
    tm = _get(decision, "threat-modeling")
    assert tm.fired is True
    assert "password" in tm.matched_keywords
    assert "token" in tm.matched_keywords


def test_api_substring_does_not_fire_on_apiary(detection_map):
    """`api` keyword must not fire on longer words like `apiary`.

    The ``api`` keyword lives in ``validate-feature-fit``. With the
    pre-F2 substring match it fired on ``apiary`` as well; word-boundary
    matching prevents the false positive.
    """
    body = (
        "Team reviewed the apiary report on rapid prototyping.\n"
        "Dashboard redesign needed.\n"
    )
    decision = detect(body, detection_map)
    vff = _get(decision, "validate-feature-fit")
    assert "api" not in vff.matched_keywords


def test_api_fires_as_standalone_word(detection_map):
    body = (
        "Expose reporting numbers through the API.\n"
        "Dashboard redesign for the admin view.\n"
    )
    decision = detect(body, detection_map)
    vff = _get(decision, "validate-feature-fit")
    # `api`, `reporting`, `dashboard`, `admin` all match as standalone words.
    assert "api" in vff.matched_keywords
    assert vff.fired is True


def test_password_and_1password_in_same_text(detection_map):
    """A legitimate `password` plus an unrelated `1Password` fires on password.

    The ``1Password`` product name is masked by the blocklist and does
    not contribute; the singular ``password`` keyword still matches
    against ``forgotten password`` via word boundaries.
    """
    body = (
        "Reset a forgotten password from the login screen.\n"
        "Internal teams use 1Password to store shared credentials.\n"
    )
    decision = detect(body, detection_map)
    tm = _get(decision, "threat-modeling")
    assert "password" in tm.matched_keywords
    assert "login" in tm.matched_keywords
    assert tm.fired is True


def test_multi_word_keyword_matches_api_key(detection_map):
    """Multi-word keywords (``api key``) must still match with word boundaries."""
    body = "Rotate the stored api key before the next release."
    decision = detect(body, detection_map)
    tm = _get(decision, "threat-modeling")
    assert "api key" in tm.matched_keywords


def test_hyphenated_keyword_matches_multi_tenant(detection_map):
    body = "Verify the multi-tenant query scopes in the reporting module."
    decision = detect(body, detection_map)
    tm = _get(decision, "threat-modeling")
    assert "multi-tenant" in tm.matched_keywords



# ---- Phase F1 — repo-awareness sanity check ------------------------------


def _init_git_repo(path: Path) -> None:
    """Initialise a quiet git repo with one empty commit for tests."""
    import os
    import subprocess as _sp

    env = {
        "GIT_AUTHOR_NAME": "t",
        "GIT_AUTHOR_EMAIL": "t@t",
        "GIT_COMMITTER_NAME": "t",
        "GIT_COMMITTER_EMAIL": "t@t",
        "PATH": os.environ["PATH"],
    }
    _sp.run(["git", "init", "-q"], cwd=path, check=True)
    _sp.run(
        ["git", "commit", "-q", "--allow-empty", "-m", "init"],
        cwd=path, check=True, env=env,
    )


def test_extract_project_key_from_heading():
    body = "# DEV-6182 — fix login flow\n\nSome body."
    assert _extract_ticket_project_key(body) == "DEV"


def test_extract_project_key_returns_none_without_reference():
    body = "# Fix the login flow\n\nNo ticket ID anywhere."
    assert _extract_ticket_project_key(body) is None


def test_extract_project_key_picks_most_frequent():
    body = (
        "# DEV-6182 — see also DEV-6047 and FOO-12.\n"
        "Parent: DEV-6047."
    )
    assert _extract_ticket_project_key(body) == "DEV"


def test_gather_repo_identifiers_reads_composer_and_package(tmp_path):
    (tmp_path / "composer.json").write_text('{"name": "event4u/agent-config"}')
    (tmp_path / "package.json").write_text('{"name": "@event4u/agent-config"}')
    ids = _gather_repo_identifiers(tmp_path)
    lowered = [x.lower() for x in ids]
    assert "event4u" in lowered
    assert "agent-config" in lowered


def test_gather_repo_identifiers_survives_malformed_json(tmp_path):
    (tmp_path / "composer.json").write_text("not { valid json")
    assert _gather_repo_identifiers(tmp_path) == []


def test_gather_repo_identifiers_includes_branch_prefixes(tmp_path):
    _init_git_repo(tmp_path)
    import subprocess as _sp
    _sp.run(["git", "checkout", "-q", "-b", "DEV-6182-login-fix"], cwd=tmp_path, check=True)
    _sp.run(["git", "checkout", "-q", "-b", "FOO-12-other"], cwd=tmp_path, check=True)
    ids = _gather_repo_identifiers(tmp_path)
    assert "DEV" in ids
    assert "FOO" in ids


def test_match_project_substring_either_way():
    assert _match_project("DEV", ["devtools", "unrelated"]) is True
    assert _match_project("EVENT4U", ["event4u"]) is True
    assert _match_project("EVENT", ["event4u", "agent-config"]) is True
    assert _match_project("FOO", ["event4u", "agent-config"]) is False


def test_alignment_line_mismatch_in_orchestration_notes(detection_map, tmp_path):
    (tmp_path / "composer.json").write_text('{"name": "event4u/agent-config"}')
    body = "# FOO-42 — add dashboard widget\n\nBody copy."
    decision = detect(body, detection_map, cwd=tmp_path)
    notes = decision.orchestration_notes()
    assert decision.alignment.matched is False
    mismatch = [n for n in notes if n.startswith("Repo project mismatch")]
    assert len(mismatch) == 1
    assert "`FOO`" in mismatch[0]
    assert "context may not apply" in mismatch[0]


def test_alignment_line_match_when_keys_align(detection_map, tmp_path):
    (tmp_path / "composer.json").write_text('{"name": "event4u/agent-config"}')
    # "AGENT-42" → repo identifier "agent-config" contains "agent".
    body = "# AGENT-42 — tune refine-ticket skill\n\nBody."
    decision = detect(body, detection_map, cwd=tmp_path)
    assert decision.alignment.matched is True
    notes = decision.orchestration_notes()
    assert any(n.startswith("Repo project match") for n in notes)


def test_alignment_absent_when_no_ticket_key(detection_map, tmp_path):
    (tmp_path / "composer.json").write_text('{"name": "event4u/agent-config"}')
    body = "# Untagged cleanup ticket\n\nNo identifiers anywhere."
    decision = detect(body, detection_map, cwd=tmp_path)
    assert decision.alignment.has_data() is False
    notes = decision.orchestration_notes()
    assert not any("Repo project" in n for n in notes)


def test_alignment_absent_when_cwd_is_none(detection_map):
    body = "# DEV-6182 — fix login flow\n\nBody."
    decision = detect(body, detection_map)
    assert decision.alignment.has_data() is False
    notes = decision.orchestration_notes()
    assert not any("Repo project" in n for n in notes)


# ---- Phase F7 — cross-repo warning independent of repo_aware --------------


def test_f7_alignment_line_present_when_repo_aware_off(detection_map, tmp_path):
    """Mismatch must surface even when repo-aware context gathering is off.

    We simulate repo_aware=off by forcing `require_count` higher than the
    available signal count, while still dropping a composer.json into the
    directory so the alignment heuristic has data to work with.
    """
    (tmp_path / "composer.json").write_text('{"name": "event4u/agent-config"}')
    body = "# FOO-42 — add dashboard widget\n\nBody."
    # Copy and patch the map so repo_aware is impossible to trigger.
    patched = dict(detection_map)
    patched["repo_aware"] = {
        "description": "forced off",
        "signals": [],
        "require_count": 1,
    }
    decision = detect(body, patched, cwd=tmp_path)
    assert decision.repo_aware is False, "repo_aware must be off for F7 test"
    notes = decision.orchestration_notes()
    assert any("Repo-aware — off" in n for n in notes)
    mismatch = [n for n in notes if n.startswith("Repo project mismatch")]
    assert len(mismatch) == 1, (
        f"cross-repo warning must appear even with repo_aware=off; got: {notes}"
    )


# ---- Phase F3 — validate-feature-fit alternative signals -------------------


def test_extract_description_body_isolates_description_heading():
    body = (
        "# Title\n\n"
        "## Description\n\n"
        "One sentence. Two sentences.\n\n"
        "## Acceptance criteria\n\n"
        "- [ ] Thing\n"
    )
    assert _extract_description_body(body).startswith("One sentence.")
    assert "Acceptance criteria" not in _extract_description_body(body)


def test_extract_description_body_falls_back_to_whole_body():
    """No `## Description` → whole body (minus leading/trailing whitespace)."""
    body = "Plain prose. Another sentence."
    assert _extract_description_body(body) == body


def test_split_sentences_counts_basic_punctuation():
    assert len(_split_sentences("One. Two. Three.")) == 3
    assert len(_split_sentences("First! Second? Third.")) == 3
    assert _split_sentences("") == []


def test_extract_ac_first_words_picks_first_token_per_bullet():
    body = (
        "## Acceptance criteria\n\n"
        "- [ ] Investigate the retry policy\n"
        "- [ ] Rewrite the dedup logic\n"
        "- [ ] Add an alert\n"
        "- [x] Completed item stays counted\n"
    )
    words = _extract_ac_first_words(body)
    assert words == ["investigate", "rewrite", "add", "completed"]


def test_clean_fixture_stays_below_alt_thresholds(detection_map):
    """Calibration fixture 1 — must NOT fire validate-feature-fit."""
    body = _load_fixture("clean")
    decision = detect(body, detection_map)
    vff = _get(decision, "validate-feature-fit")
    assert vff.fired is False, (
        f"clean.md must stay below alt-signal thresholds; got "
        f"alt={vff.matched_alt_signals}"
    )
    assert vff.matched_alt_signals == []


def test_scope_creep_prose_fires_via_alt_signals(detection_map):
    """Calibration fixture 2 — many AC first-words + long prose trigger."""
    body = _load_fixture("scope_creep_prose")
    decision = detect(body, detection_map)
    vff = _get(decision, "validate-feature-fit")
    assert vff.fired is True
    # At least one alt-signal reason must be present — this is how F3
    # rescues tickets that keywords alone would miss.
    assert vff.matched_alt_signals, (
        "scope_creep_prose.md must fire at least one alt-signal"
    )


def test_alt_signals_visible_in_output_line(detection_map):
    body = _load_fixture("scope_creep_prose")
    decision = detect(body, detection_map)
    vff = _get(decision, "validate-feature-fit")
    line = vff.as_output_line()
    assert "fired on" in line
    # The human-readable signal tag must be cited in the line so the
    # user sees WHY the sub-skill fired, not just THAT it fired.
    assert any(tag in line for tag in ("body sentences", "ac first-words"))


def test_alt_signals_empty_when_spec_omits_them():
    spec_no_alt = {"keywords": [], "require_count": 1}
    body = "Doesn't matter. Many. Sentences. Here."
    assert _evaluate_alt_signals(body, spec_no_alt) == []


def test_duplicate_intent_fires_via_keywords_not_alt(detection_map):
    """Guard — alt-signals must not accidentally catch existing fixture.

    duplicate_intent.md has 3 AC first-words + 3 sentences (below the
    7/6 threshold) and fires via keywords alone. If either threshold
    is ever lowered, this test stops the regression.
    """
    body = _load_fixture("duplicate_intent")
    decision = detect(body, detection_map)
    vff = _get(decision, "validate-feature-fit")
    assert vff.fired is True
    assert vff.matched_alt_signals == []
    assert len(vff.matched_keywords) >= 2



# ---- Phase F4 — auto-fetch parent on Story / Sub-task ----------------------


def test_issuetype_needs_parent_matches_story_and_subtask():
    assert issuetype_needs_parent("Story") is True
    assert issuetype_needs_parent("story") is True
    assert issuetype_needs_parent("Sub-task") is True
    assert issuetype_needs_parent("Subtask") is True
    assert issuetype_needs_parent("SUB-TASK") is True


def test_issuetype_needs_parent_skips_task_bug_epic():
    assert issuetype_needs_parent("Task") is False
    assert issuetype_needs_parent("Bug") is False
    assert issuetype_needs_parent("Epic") is False
    assert issuetype_needs_parent("") is False
    assert issuetype_needs_parent(None) is False


def test_fold_parent_context_prepends_canonical_block():
    ticket = "# PROJ-2 — Story\n\n## Description\n\nChild body.\n"
    parent = "# PROJ-1 — Epic\n\n- [ ] Parent AC line\n"
    folded = fold_parent_context(ticket, parent, "PROJ-1")
    assert folded.startswith("## Parent context — PROJ-1\n\n")
    assert "Parent AC line" in folded
    assert "Child body." in folded
    # Child heading stays after the separator
    assert folded.index("## Parent context") < folded.index("# PROJ-2")


def test_fold_parent_context_is_idempotent():
    ticket = "# PROJ-2 — Story\n\n## Description\n\nChild body.\n"
    parent = "# PROJ-1 — Epic\n\n- [ ] Parent AC\n"
    once = fold_parent_context(ticket, parent, "PROJ-1")
    twice = fold_parent_context(once, parent, "PROJ-1")
    assert once == twice, "folding the same parent twice must not duplicate"
    assert twice.count("## Parent context — PROJ-1") == 1


def test_fold_parent_context_empty_parent_stays_marked():
    folded = fold_parent_context("Child", "", "PROJ-1")
    assert "_(parent body empty)_" in folded


def test_fold_parent_context_feeds_detection(detection_map):
    """Parent-level AC keywords must now fire sub-skills on the child."""
    child = (
        "# PROJ-2 — Story\n\n"
        "## Description\n\nStraightforward one-line child.\n"
    )
    parent = (
        "# PROJ-1 — Epic\n\n"
        "## Description\n\n"
        "Combine the notifications module with the reporting dashboard "
        "and fold in invoicing. Admin-only access.\n"
    )
    folded = fold_parent_context(child, parent, "PROJ-1")
    decision = detect(folded, detection_map)
    vff = _get(decision, "validate-feature-fit")
    assert vff.fired is True, (
        "parent AC with multiple distinct feature keywords must trigger "
        "validate-feature-fit on the folded body"
    )


# ---- Phase F6 — close-prompt write-permission probe ------------------------


def test_render_close_prompt_full_when_write_access_present():
    prompt = render_close_prompt(True)
    assert prompt == CLOSE_PROMPT_FULL
    assert "1. Comment on Jira" in prompt
    assert "2. Replace description" in prompt
    assert "3. Nothing" in prompt


def test_render_close_prompt_single_option_when_read_only():
    prompt = render_close_prompt(False)
    assert prompt == CLOSE_PROMPT_READ_ONLY
    assert "Copy-paste" in prompt
    # Exactly one numbered option — options 2 and 3 must be hidden.
    assert "2." not in prompt
    assert "3." not in prompt


def test_render_close_prompt_probe_failure_degrades_to_full():
    """None means probe failed (network / auth) — fall back to v1 behaviour."""
    prompt = render_close_prompt(None)
    assert prompt == CLOSE_PROMPT_FULL
