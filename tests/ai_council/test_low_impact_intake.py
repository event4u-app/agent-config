"""Intake trigger + dedup contract (Phase 12, Step 2)."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council.low_impact_intake import (  # noqa: E402
    matches_trigger,
    normalise,
    record_intake,
)


_CORPUS_SKELETON = """# Low-Impact Decisions Corpus

## On Probation

<!-- intake-anchor: probation -->

## Validated

<!-- intake-anchor: validated -->

## Anti-Examples (Always Ask User)

- "irrelevant" — placeholder

## Security & Privacy Floor

floor text.

## Provenance

last-upstreamed: 0000000000000000000000000000000000000000
"""


def _corpus(tmp_path: Path, body: str = _CORPUS_SKELETON) -> Path:
    p = tmp_path / "low-impact-decisions.md"
    p.write_text(body, encoding="utf-8")
    return p


def test_trigger_german() -> None:
    assert matches_trigger("Das ist eine leichte Frage, oder?")
    assert matches_trigger("Mach das selber.")
    assert matches_trigger("löse das im council")


def test_trigger_english() -> None:
    assert matches_trigger("This is a low-impact question.")
    assert matches_trigger("Council should answer this.")
    assert matches_trigger("Ask the council, please.")


def test_trigger_negative() -> None:
    assert not matches_trigger("Implement the feature.")
    assert not matches_trigger("Sollen wir das committen?")


def test_normalise() -> None:
    assert normalise("Service VS Repository?") == "service vs repository"
    assert normalise("  hello\tworld!  ") == "hello world"


def test_new_probation_entry_created(tmp_path: Path) -> None:
    corpus = _corpus(tmp_path)
    res = record_intake(corpus, "DTO vs array?", today="2026-05-14")
    assert res.kind == "new_probation"
    txt = corpus.read_text(encoding="utf-8")
    assert '- "DTO vs array?"' in txt
    assert "first-seen 2026-05-14" in txt
    assert "seen [2026-05-14]" in txt


def test_dedup_appends_seen_date(tmp_path: Path) -> None:
    corpus = _corpus(tmp_path)
    record_intake(corpus, "DTO vs array?", today="2026-05-14")
    res = record_intake(corpus, "DTO vs array?", today="2026-05-20")
    assert res.kind == "appended_seen"
    txt = corpus.read_text(encoding="utf-8")
    assert "seen [2026-05-14, 2026-05-20]" in txt


def test_same_day_noop(tmp_path: Path) -> None:
    corpus = _corpus(tmp_path)
    record_intake(corpus, "DTO vs array?", today="2026-05-14")
    res = record_intake(corpus, "DTO vs array?", today="2026-05-14")
    assert res.kind == "noop"
    txt = corpus.read_text(encoding="utf-8")
    assert txt.count("DTO vs array") == 1


def test_validated_match_skipped(tmp_path: Path) -> None:
    body = _CORPUS_SKELETON.replace(
        "<!-- intake-anchor: validated -->",
        '<!-- intake-anchor: validated -->\n\n- "DTO vs array?" — '
        'domain: low-impact · validated 2026-04-01',
    )
    corpus = _corpus(tmp_path, body)
    res = record_intake(corpus, "DTO vs array?", today="2026-05-14")
    assert res.kind == "duplicate_validated"
    txt = corpus.read_text(encoding="utf-8")
    assert txt.count("DTO vs array") == 1


def test_normalisation_drives_match(tmp_path: Path) -> None:
    corpus = _corpus(tmp_path)
    record_intake(corpus, "DTO vs array?", today="2026-05-14")
    res = record_intake(corpus, "  dto  VS   array!  ", today="2026-05-20")
    assert res.kind == "appended_seen"


def test_returns_today_in_outcome(tmp_path: Path) -> None:
    corpus = _corpus(tmp_path)
    res = record_intake(corpus, "X?", today="2026-05-14")
    assert res.today == "2026-05-14"
