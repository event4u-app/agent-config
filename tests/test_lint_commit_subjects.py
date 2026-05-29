"""Tests for scripts/lint_commit_subjects.py — the commit-subject CI lint.

The lint feeds the auto-generated changelog via scripts/release.py.
Subjects that fail this lint would otherwise leak into the public
CHANGELOG.md and into the next release's `### Breaking` section.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import lint_commit_subjects as lcs  # noqa: E402


# ---------------------------------------------------------------------------
# Clean subjects — must pass with zero issues.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("subject", [
    "feat(roadmaps): add Iron Law 3 — block silent archive of [~] deferred items",
    "fix: prevent silent archive of deferred items",
    "fix(wizard): prefill roles + packs from saved state for returning users",
    "chore(roadmaps): regenerate dashboard after archiving",
    "docs(adr): land ADR-033 distribution-identity npm-primary",
    "refactor: split parse_frontmatter into loader + injector helpers",
    "feat!: drop Composer surface; npm-primary per ADR-033",
    "chore: bump @event4u/agent-config to 5.1.0",
])
def test_clean_subjects_pass(subject: str) -> None:
    assert lcs.check_subject(subject) == [], (
        f"Expected clean, got issues for: {subject!r}"
    )


# ---------------------------------------------------------------------------
# Short subjects — body after type-prefix is < MIN_SUBJECT_LEN.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("subject", [
    "fix: bug",            # body = "bug" — 3 chars
    "feat: x",             # body = "x" — 1 char
    "chore: typo",         # body = "typo" — 4 chars
    "wip",                 # entire subject 3 chars; blocklist also triggers
    "tmp",                 # entire subject 3 chars; blocklist also triggers
    "fix",                 # entire subject 3 chars
])
def test_short_subjects_fail(subject: str) -> None:
    issues = lcs.check_subject(subject)
    assert issues, f"Expected at least one issue for: {subject!r}"


# ---------------------------------------------------------------------------
# Blocklist tokens — even if the subject is otherwise long.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("subject", [
    "chore: commit leftovers from yesterday",
    "fix: wip on the wizard prefill logic",
    "chore: temp commit to capture progress",
    "chore(roadmaps): fixup the dashboard regen",
    "fix: tmp shim until the loader patch lands",
    "feat: add LEFTOVER cleanup script",  # uppercase still matched
])
def test_blocklist_tokens_fail(subject: str) -> None:
    issues = lcs.check_subject(subject)
    assert issues, f"Expected blocklist hit for: {subject!r}"
    assert any("blocklist token" in i for i in issues), (
        f"Expected blocklist-token issue specifically: {issues}"
    )


# ---------------------------------------------------------------------------
# Whole-word matching — `template`, `temporary`, `wipro`-style false-positive
# avoidance. These should NOT trigger the blocklist.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("subject", [
    "feat: add template for new roadmaps",  # 'template' must not match 'temp'
    "docs: clarify temporary auth flow",    # 'temporary' must not match 'temp'
])
def test_whole_word_blocklist_no_false_positive(subject: str) -> None:
    issues = lcs.check_subject(subject)
    # Whole-word matching: regex `[A-Za-z]+` extracts `template` as one token,
    # which is not in BLOCKLIST. The lint must not flag it.
    assert not any("blocklist" in i for i in issues), (
        f"False-positive blocklist hit for: {subject!r} — issues: {issues}"
    )


# ---------------------------------------------------------------------------
# Carve-outs — GitHub-generated merge/revert subjects are skipped.
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("subject", [
    "Merge pull request #287 from event4u-app/feat/preserve-deferred-roadmap-scope",
    "Merge branch 'main' into feat/distribution-identity",
    "Merge remote-tracking branch 'origin/main'",
    'Revert "fix: wip on the dashboard regen"',  # body contains wip but skipped
])
def test_carve_out_subjects_skipped(subject: str) -> None:
    assert lcs.check_subject(subject) == [], (
        f"Expected carve-out skip for: {subject!r}"
    )
