"""Tests for ``scripts/lint_roadmap_ci_steps.py``.

Covers the Hard-Gate semantics from
``.agent-src.uncondensed/rules/roadmap-ci-steps-policy.md``:
detection of CI-shaped literals in checkbox steps and fenced bash
blocks, the carve-out marker, acceptance-criteria suppression, and
the ``quality.local_auto_run`` toggle that short-circuits the linter.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import lint_roadmap_ci_steps as mod  # noqa: E402


# ---------------------------------------------------------------------------
# _scan — detection patterns
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "literal",
    [
        "task ci",
        "task ci-fast",
        "task ci-strict",
        "make ci",
        "make test",
        "npm run check",
        "pnpm run check",
        "yarn check",
        "composer test",
        "vendor/bin/phpunit",
        "php artisan test",
    ],
)
def test_scan_detects_ci_literal_in_checkbox(literal: str):
    text = f"## Phase 1\n\n- [ ] Run {literal} before the boundary\n"
    hits = mod._scan(text)
    assert len(hits) == 1
    assert literal.split()[0] in hits[0][1].lower() or literal in hits[0][1]


def test_scan_detects_inside_fenced_bash_block():
    text = (
        "## Phase 1\n\n"
        "Run the pipeline:\n\n"
        "```bash\n"
        "task ci\n"
        "```\n"
    )
    hits = mod._scan(text)
    assert len(hits) == 1
    assert "task ci" in hits[0][1]


def test_scan_ignores_targeted_phpstan():
    text = (
        "## Phase 1\n\n"
        "- [ ] Run vendor/bin/phpstan analyse app/Modules/X\n"
        "- [ ] Run php artisan test --filter=FooBar\n"
        "- [ ] Run vendor/bin/phpunit tests/Unit/Foo.php\n"
    )
    assert mod._scan(text) == []


def test_scan_honours_carve_out_marker():
    text = (
        "## Phase 1\n\n"
        "- [ ] Run task ci to verify new gate "
        "<!-- carve-out: new-gate-verification -->\n"
    )
    assert mod._scan(text) == []


def test_scan_ignores_acceptance_criteria_block():
    text = (
        "## Phase 1\n\n"
        "- [ ] Do the work\n\n"
        "## Acceptance criteria\n\n"
        "- All quality gates pass (`task ci`)\n"
        "- `make test` green\n"
    )
    assert mod._scan(text) == []


def test_scan_resumes_detection_after_acceptance_block():
    text = (
        "## Acceptance criteria\n\n"
        "- `task ci` documented here\n\n"
        "## Phase 2\n\n"
        "- [ ] Run task ci again\n"
    )
    hits = mod._scan(text)
    assert len(hits) == 1
    assert hits[0][1] == "task ci"


def test_scan_ignores_prose_outside_checkbox_and_fence():
    text = (
        "## Context\n\n"
        "Historically we ran `task ci` on every commit, but that "
        "burned tokens.\n"
    )
    assert mod._scan(text) == []


# ---------------------------------------------------------------------------
# _read_local_auto_run — settings parsing
# ---------------------------------------------------------------------------


def test_read_local_auto_run_false(tmp_path: Path, monkeypatch):
    settings = tmp_path / ".agent-settings.yml"
    settings.write_text(
        "quality:\n  local_auto_run: false\n  wait_for_remote_ci: false\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(mod, "SETTINGS_FILE", settings)
    assert mod._read_local_auto_run() is False


def test_read_local_auto_run_true(tmp_path: Path, monkeypatch):
    settings = tmp_path / ".agent-settings.yml"
    settings.write_text(
        "quality:\n  local_auto_run: true\n", encoding="utf-8"
    )
    monkeypatch.setattr(mod, "SETTINGS_FILE", settings)
    assert mod._read_local_auto_run() is True


def test_read_local_auto_run_missing_file(tmp_path: Path, monkeypatch):
    monkeypatch.setattr(mod, "SETTINGS_FILE", tmp_path / "missing.yml")
    assert mod._read_local_auto_run() is True


def test_read_local_auto_run_missing_key_defaults_true(
    tmp_path: Path, monkeypatch
):
    settings = tmp_path / ".agent-settings.yml"
    settings.write_text("quality:\n  wait_for_remote_ci: false\n", encoding="utf-8")
    monkeypatch.setattr(mod, "SETTINGS_FILE", settings)
    assert mod._read_local_auto_run() is True
