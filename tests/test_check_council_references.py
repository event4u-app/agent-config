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
        tmp_path / "agents/contexts/foo.md",
        "See `agents/council-sessions/2026-05-06.json` for the trace.",
    )
    assert ccr.main() == 1


def test_forbidden_question_reference_in_roadmap(tmp_path: Path) -> None:
    _write(
        tmp_path / "agents/roadmaps/road-to-x.md",
        "Question: agents/council-questions/topic.md",
    )
    assert ccr.main() == 1


def test_forbidden_response_reference_in_contract(tmp_path: Path) -> None:
    _write(
        tmp_path / "docs/contracts/foo.md",
        "Source: agents/council-responses/topic.json",
    )
    assert ccr.main() == 1


def test_forbidden_response_reference_in_adr(tmp_path: Path) -> None:
    _write(
        tmp_path / "docs/decisions/ADR-x.md",
        "See agents/council-responses/x.json",
    )
    assert ccr.main() == 1


# ---------------------------------------------------------------------------
# Allowed forms — the linter must let these pass.
# ---------------------------------------------------------------------------

def test_allowed_directory_mention(tmp_path: Path) -> None:
    _write(
        tmp_path / "agents/contexts/foo.md",
        "Sessions live under agents/council-sessions/ and rotate after 7 days.",
    )
    assert ccr.main() == 0


def test_allowed_placeholder_path(tmp_path: Path) -> None:
    _write(
        tmp_path / "agents/contexts/foo.md",
        "Schema: `agents/council-sessions/<UTC-timestamp>/raw-text.md`",
    )
    assert ccr.main() == 0


def test_allowed_in_archive(tmp_path: Path) -> None:
    _write(
        tmp_path / "agents/roadmaps/archive/old.md",
        "Round 1 — `agents/council-sessions/2026-05-03.json` — historical.",
    )
    assert ccr.main() == 0


def test_allowed_in_analysis(tmp_path: Path) -> None:
    _write(
        tmp_path / "agents/analysis/compare-foo.md",
        "Source: `agents/council-responses/foo.json`",
    )
    assert ccr.main() == 0


def test_allowed_in_rule_itself(tmp_path: Path) -> None:
    _write(
        tmp_path / ".agent-src.uncompressed/rules/no-council-references.md",
        "Forbidden: `agents/council-sessions/<file>.json`",
    )
    assert ccr.main() == 0


def test_allowed_in_ai_council_skill(tmp_path: Path) -> None:
    _write(
        tmp_path / ".agent-src.uncompressed/skills/ai-council/SKILL.md",
        "Output: agents/council-sessions/2026-05-06.json",
    )
    assert ccr.main() == 0


def test_inline_pragma_suppresses(tmp_path: Path) -> None:
    _write(
        tmp_path / "docs/decisions/ADR-x.md",
        "Trace: agents/council-sessions/x.json "
        "<!-- council-ref-allowed: ADR decision trace -->",
    )
    assert ccr.main() == 0


# ---------------------------------------------------------------------------
# Scope — files outside SCAN_ROOTS must not be scanned.
# ---------------------------------------------------------------------------

def test_unscanned_directory_ignored(tmp_path: Path) -> None:
    _write(
        tmp_path / "scripts/something.py",
        '_PATH = "agents/council-sessions/x.json"',
    )
    assert ccr.main() == 0


def test_clean_repo_passes(tmp_path: Path) -> None:
    _write(tmp_path / "agents/contexts/foo.md", "All good.")
    assert ccr.main() == 0
