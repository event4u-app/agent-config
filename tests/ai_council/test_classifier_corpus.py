"""Corpus-aware classifier contract (Phase 12, Step 5)."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council.necessity import (  # noqa: E402
    classify_impact_with_corpus,
    load_validated_phrases,
)


_CORPUS = """# Corpus

## On Probation

- "ignored probation entry" — first-seen 2026-05-01 · seen [2026-05-01]

## Validated

- "should this be a dto or array" — domain: low-impact · validated 2026-04-01
- "service vs repository for read paths" — domain: low-impact · validated 2026-04-10

## Anti-Examples (Always Ask User)

- "should i put this in the controller" — architecture trap

## Security & Privacy Floor

text.

## Provenance

last-upstreamed: 0000
"""


def _corpus(tmp_path: Path) -> Path:
    p = tmp_path / "corpus.md"
    p.write_text(_CORPUS, encoding="utf-8")
    return p


def test_load_validated_phrases_strips_punctuation(tmp_path: Path) -> None:
    phrases = load_validated_phrases(_corpus(tmp_path))
    assert "should this be a dto or array" in phrases
    assert "service vs repository for read paths" in phrases


def test_load_validated_skips_probation_and_anti(tmp_path: Path) -> None:
    phrases = load_validated_phrases(_corpus(tmp_path))
    assert "ignored probation entry" not in phrases
    assert "should i put this in the controller" not in phrases


def test_load_validated_missing_file_returns_empty(tmp_path: Path) -> None:
    assert load_validated_phrases(tmp_path / "missing.md") == ()


def test_corpus_match_short_circuits_to_low_impact(tmp_path: Path) -> None:
    verdict = classify_impact_with_corpus(
        "Should this be a DTO or array?",
        corpus_paths=(_corpus(tmp_path),),
    )
    assert verdict.impact_class == "low_impact"
    assert verdict.confidence == 0.9
    assert verdict.category == "corpus_validated"


def test_corpus_match_respects_locked_high_impact(tmp_path: Path) -> None:
    # security marker fires first → locked → corpus lookup skipped
    verdict = classify_impact_with_corpus(
        "Should this DTO carry the api key?",
        corpus_paths=(_corpus(tmp_path),),
    )
    assert verdict.impact_class == "high_impact"


def test_corpus_match_respects_user_fence(tmp_path: Path) -> None:
    verdict = classify_impact_with_corpus(
        "Should this be a DTO or array? Ask me first.",
        corpus_paths=(_corpus(tmp_path),),
    )
    assert verdict.impact_class == "user_required"


def test_no_corpus_falls_through_to_baseline(tmp_path: Path) -> None:
    verdict = classify_impact_with_corpus(
        "Should this be a DTO or array?",
        corpus_paths=None,
    )
    # baseline picks up `dto` low-impact trigger but not at corpus confidence
    assert verdict.impact_class == "low_impact"
    assert verdict.confidence < 0.9


def test_probation_entry_does_not_influence_routing(tmp_path: Path) -> None:
    verdict = classify_impact_with_corpus(
        "ignored probation entry",
        corpus_paths=(_corpus(tmp_path),),
    )
    # Falls through to baseline (which won't classify it as low_impact).
    assert verdict.category != "corpus_validated"


def test_empty_question_returns_user_required(tmp_path: Path) -> None:
    verdict = classify_impact_with_corpus(
        "",
        corpus_paths=(_corpus(tmp_path),),
    )
    assert verdict.impact_class == "user_required"
