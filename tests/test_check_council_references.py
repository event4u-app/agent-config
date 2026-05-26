"""Tests for scripts/check_council_references.py."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts import check_council_references as ccr


@pytest.fixture(autouse=True)
def _reset_root(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Point the linter at a clean tmp tree for every test."""
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(ccr, "ROOT", Path("."))


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


# ---------------------------------------------------------------------------
# Forbidden hits — the linter must catch these.
# ---------------------------------------------------------------------------

def test_forbidden_session_reference_in_context(tmp_path: Path) -> None:
    _write(
        tmp_path / "agents/settings/contexts/foo.md",
        "See `agents/runtime/council/sessions/2026-05-06.json` for the trace.",
    )
    assert ccr.main() == 1


def test_forbidden_question_reference_in_roadmap(tmp_path: Path) -> None:
    _write(
        tmp_path / "agents/roadmaps/road-to-x.md",
        "Question: agents/runtime/council/questions/topic.md",
    )
    assert ccr.main() == 1


def test_forbidden_response_reference_in_contract(tmp_path: Path) -> None:
    _write(
        tmp_path / "docs/contracts/foo.md",
        "Source: agents/runtime/council/responses/topic.json",
    )
    assert ccr.main() == 1


def test_forbidden_response_reference_in_adr(tmp_path: Path) -> None:
    _write(
        tmp_path / "docs/decisions/ADR-x.md",
        "See agents/runtime/council/responses/x.json",
    )
    assert ccr.main() == 1


# ---------------------------------------------------------------------------
# Allowed forms — the linter must let these pass.
# ---------------------------------------------------------------------------

def test_allowed_directory_mention(tmp_path: Path) -> None:
    _write(
        tmp_path / "agents/settings/contexts/foo.md",
        "Sessions live under agents/runtime/council/sessions/ and rotate after 7 days.",
    )
    assert ccr.main() == 0


def test_allowed_placeholder_path(tmp_path: Path) -> None:
    _write(
        tmp_path / "agents/settings/contexts/foo.md",
        "Schema: `agents/runtime/council/sessions/<UTC-timestamp>/raw-text.md`",
    )
    assert ccr.main() == 0


def test_allowed_in_archive(tmp_path: Path) -> None:
    _write(
        tmp_path / "agents/roadmaps/archive/old.md",
        "Round 1 — `agents/runtime/council/sessions/2026-05-03.json` — historical.",
    )
    assert ccr.main() == 0


def test_allowed_in_analysis(tmp_path: Path) -> None:
    _write(
        tmp_path / "agents/evidence/analysis/compare-foo.md",
        "Source: `agents/runtime/council/responses/foo.json`",
    )
    assert ccr.main() == 0


def test_allowed_in_rule_itself(tmp_path: Path) -> None:
    _write(
        tmp_path / ".agent-src.uncondensed/rules/no-roadmap-references.md",
        "Forbidden: `agents/runtime/council/sessions/<file>.json`",
    )
    assert ccr.main() == 0


def test_allowed_in_ai_council_skill(tmp_path: Path) -> None:
    _write(
        tmp_path / ".agent-src.uncondensed/skills/ai-council/SKILL.md",
        "Output: agents/runtime/council/sessions/2026-05-06.json",
    )
    assert ccr.main() == 0


def test_inline_pragma_suppresses(tmp_path: Path) -> None:
    _write(
        tmp_path / "docs/decisions/ADR-x.md",
        "Trace: agents/runtime/council/sessions/x.json "
        "<!-- council-ref-allowed: ADR decision trace -->",
    )
    assert ccr.main() == 0


# ---------------------------------------------------------------------------
# Structural carve-outs (P3.5) — immutable inputs / decision provenance.
# ---------------------------------------------------------------------------

def test_carveout_evaluation_context_to_council_question(tmp_path: Path) -> None:
    _write(
        tmp_path / "agents/settings/contexts/evaluation-2-2-2-followups.md",
        "Question file at "
        "`agents/runtime/council/questions/composer-fallback-feasibility.md`.",
    )
    assert ccr.main() == 0


def test_carveout_contract_to_session_synthesis(tmp_path: Path) -> None:
    _write(
        tmp_path / "docs/contracts/tier-3-contrib-plugin.md",
        "Surfaced during the "
        "[`2026-05-12-installer-expansion`]"
        "(../../agents/runtime/council/sessions/2026-05-12-installer-expansion/synthesis.md)"
        " council round.",
    )
    assert ccr.main() == 0


def test_carveout_does_not_widen_evaluation_to_session(tmp_path: Path) -> None:
    """evaluation-* → session.json is NOT in the carve-out — must still fail."""
    _write(
        tmp_path / "agents/settings/contexts/evaluation-foo.md",
        "See `agents/runtime/council/sessions/2026-05-06/raw.json` for the trace.",
    )
    assert ccr.main() == 1


def test_carveout_does_not_widen_contract_to_question(tmp_path: Path) -> None:
    """contract → council-question is NOT in the carve-out — must still fail."""
    _write(
        tmp_path / "docs/contracts/foo.md",
        "See `agents/runtime/council/questions/topic.md`.",
    )
    assert ccr.main() == 1


def test_carveout_does_not_widen_non_evaluation_context(tmp_path: Path) -> None:
    """Non-evaluation context → council-question must still fail."""
    _write(
        tmp_path / "agents/settings/contexts/auth-model.md",
        "Reference: `agents/runtime/council/questions/topic.md`.",
    )
    assert ccr.main() == 1


def test_carveout_does_not_widen_contract_to_non_synthesis(tmp_path: Path) -> None:
    """contract → session non-synthesis file (e.g. raw responses) must still fail."""
    _write(
        tmp_path / "docs/contracts/foo.md",
        "See `agents/runtime/council/sessions/2026-05-06/responses.json`.",
    )
    assert ccr.main() == 1


# ---------------------------------------------------------------------------
# Scope — files outside SCAN_ROOTS must not be scanned.
# ---------------------------------------------------------------------------

def test_unscanned_directory_ignored(tmp_path: Path) -> None:
    _write(
        tmp_path / "scripts/something.py",
        '_PATH = "agents/runtime/council/sessions/x.json"',
    )
    assert ccr.main() == 0


def test_clean_repo_passes(tmp_path: Path) -> None:
    _write(tmp_path / "agents/settings/contexts/foo.md", "All good.")
    assert ccr.main() == 0
