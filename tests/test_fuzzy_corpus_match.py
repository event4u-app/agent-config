"""Fuzzy corpus-match classifier with safety vetoes (step-9 P5).

Covers the four Iron Laws of ``classify_impact_with_corpus_fuzzy``:

1. ratio ≥ threshold → ``low_impact`` (``corpus_validated_fuzzy``);
2. ratio < threshold → falls through to base verdict;
3. ``high_impact`` trigger token in query → base verdict (Iron Law);
4. anti-example similarity ≥ validated similarity → base verdict.

The fixture mirrors the production corpus shape used by the lenient
loaders in :mod:`scripts.ai_council.low_impact_corpus`.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.ai_council.low_impact import (  # noqa: E402
    classify_impact_with_corpus_fuzzy,
)


_CORPUS = """# Corpus

## On Probation

- "ignored probation entry" — first-seen 2026-05-01 · seen [2026-05-01]

## Validated

- "should this be a dto or array" — domain: low-impact · validated 2026-04-01
- "service vs repository for read paths" — domain: low-impact · validated 2026-04-10
- "use array_map or foreach for this transform" — domain: low-impact · validated 2026-04-15

## Anti-Examples (Always Ask User)

- "should i put this in the controller" — architecture trap
- "rotate this api key now" — security trap

## Security & Privacy Floor

text.

## Provenance

last-upstreamed: 0000
"""


@pytest.fixture
def corpus(tmp_path: Path) -> tuple[Path, ...]:
    p = tmp_path / "corpus.md"
    p.write_text(_CORPUS, encoding="utf-8")
    return (p,)


def test_paraphrase_above_threshold_returns_low_impact(corpus):
    # Near-paraphrase of "should this be a dto or array" — same words,
    # different particles. ratio() should clear 0.85.
    verdict = classify_impact_with_corpus_fuzzy(
        "should this be a dto or just an array",
        corpus_paths=corpus,
        threshold=0.85,
    )
    assert verdict.impact_class == "low_impact"
    assert verdict.category == "corpus_validated_fuzzy"
    assert 0.0 < verdict.confidence <= 0.9


def test_array_map_vs_foreach_example(corpus):
    # The example called out in the roadmap AC.
    verdict = classify_impact_with_corpus_fuzzy(
        "should i use array_map or foreach for this transform",
        corpus_paths=corpus,
        threshold=0.85,
    )
    assert verdict.impact_class == "low_impact"
    assert verdict.category == "corpus_validated_fuzzy"


def test_below_threshold_falls_through_to_base(corpus):
    # Unrelated text; ratio() stays well below 0.92.
    verdict = classify_impact_with_corpus_fuzzy(
        "what time is it",
        corpus_paths=corpus,
        threshold=0.92,
    )
    assert verdict.category != "corpus_validated_fuzzy"


def test_high_impact_token_vetoes_match(corpus):
    # Even with a perfect paraphrase of a validated entry, presence of
    # a high-impact trigger token (security) wins the Iron Law.
    verdict = classify_impact_with_corpus_fuzzy(
        "should this be a dto or array — security review needed",
        corpus_paths=corpus,
        threshold=0.50,
    )
    assert verdict.impact_class == "high_impact"
    assert verdict.category != "corpus_validated_fuzzy"


def test_anti_example_veto(corpus):
    # Near-paraphrase of an Anti-Examples entry — even if validated has
    # *some* similarity, the anti-example should match at least as well.
    verdict = classify_impact_with_corpus_fuzzy(
        "should i put this logic in the controller",
        corpus_paths=corpus,
        threshold=0.50,
    )
    assert verdict.category != "corpus_validated_fuzzy"


def test_locked_class_skips_fuzzy_lookup(corpus):
    # The base classifier flags "rotate api key" as high_impact via the
    # `api key` trigger — fuzzy lookup must not override.
    verdict = classify_impact_with_corpus_fuzzy(
        "rotate the api key now please",
        corpus_paths=corpus,
        threshold=0.10,
    )
    assert verdict.impact_class == "high_impact"


def test_empty_query_returns_base(corpus):
    verdict = classify_impact_with_corpus_fuzzy(
        "",
        corpus_paths=corpus,
        threshold=0.92,
    )
    assert verdict.category != "corpus_validated_fuzzy"


def test_no_corpus_returns_base():
    verdict = classify_impact_with_corpus_fuzzy(
        "should this be a dto or array",
        corpus_paths=None,
        threshold=0.92,
    )
    assert verdict.category != "corpus_validated_fuzzy"


def test_threshold_out_of_range_returns_base(corpus):
    verdict = classify_impact_with_corpus_fuzzy(
        "should this be a dto or array",
        corpus_paths=corpus,
        threshold=0.0,
    )
    assert verdict.category != "corpus_validated_fuzzy"
