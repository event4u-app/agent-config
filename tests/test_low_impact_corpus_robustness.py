"""Strict-mode parser contract for the low-impact decisions corpus.

Step-9 Phase 4 — see ``agents/roadmaps/step-9-pr150-feedback-hardening.md``.

Seven failure-mode fixtures under ``tests/fixtures/corpus-robust/`` each
trip exactly one ``CorpusParseError.reason`` tag; one happy-path fixture
parses cleanly. The lenient back-compat shim
(``load_validated_phrases``) keeps degrading silently for the routing
hot-path — checked in the last test.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.ai_council.low_impact_corpus import (  # noqa: E402
    CorpusParseError,
    load_validated_phrases,
    parse_corpus_strict,
)


_FIXTURES = Path(__file__).parent / "fixtures" / "corpus-robust"


@pytest.mark.parametrize(
    ("fixture", "reason"),
    [
        ("01-curly-quotes.md", "curly_quotes"),
        ("02-single-quotes.md", "single_quotes"),
        ("03-non-dash-bullet.md", "non_dash_bullet"),
        ("04-unclosed-quote.md", "unclosed_quote"),
        ("05-empty-phrase.md", "empty_phrase"),
        ("06-heading-drift.md", "heading_drift"),
        ("07-missing-anchor.md", "missing_anchor"),
    ],
)
def test_strict_parser_raises_with_typed_reason(fixture: str, reason: str) -> None:
    path = _FIXTURES / fixture
    assert path.exists(), f"fixture missing: {fixture}"
    with pytest.raises(CorpusParseError) as exc_info:
        parse_corpus_strict(path)
    assert exc_info.value.reason == reason, (
        f"expected reason={reason!r}, got {exc_info.value.reason!r}"
    )


def test_strict_parser_accepts_canonical_corpus() -> None:
    result = parse_corpus_strict(_FIXTURES / "00-canonical-ok.md")
    assert len(result.validated) == 2
    assert "should this be a dto or array" in result.phrases("validated")
    assert "service vs repository for read paths" in result.phrases("validated")
    assert len(result.probation) == 1
    assert len(result.anti_examples) == 2


def test_strict_parser_missing_file_returns_empty(tmp_path: Path) -> None:
    result = parse_corpus_strict(tmp_path / "missing.md")
    assert result.validated == ()
    assert result.probation == ()
    assert result.anti_examples == ()


def test_strict_parser_error_carries_line_and_section() -> None:
    with pytest.raises(CorpusParseError) as exc_info:
        parse_corpus_strict(_FIXTURES / "01-curly-quotes.md")
    err = exc_info.value
    assert err.line is not None and err.line > 0
    assert err.section == "validated"
    assert "line" in str(err)


def test_lenient_shim_drops_per_bullet_drift_silently() -> None:
    # Bullet-level drift fixtures drop the offending entry but never raise.
    # 07-missing-anchor is a file-level structural issue (intake-only); the
    # routing shim still extracts the well-formed Validated bullet from it.
    for fixture in (
        "01-curly-quotes.md",
        "02-single-quotes.md",
        "03-non-dash-bullet.md",
        "04-unclosed-quote.md",
        "05-empty-phrase.md",
    ):
        phrases = load_validated_phrases(_FIXTURES / fixture)
        assert "should this be a dto or array" not in phrases, (
            f"{fixture} leaked a malformed entry into routing"
        )


def test_lenient_shim_extracts_anchor_drift_fixture() -> None:
    # Missing intake-anchor does NOT block routing — the Validated bullet
    # itself is well-formed, so the lenient shim returns it.
    phrases = load_validated_phrases(_FIXTURES / "07-missing-anchor.md")
    assert "should this be a dto or array" in phrases


def test_lenient_shim_preserves_existing_contract() -> None:
    # Canonical fixture round-trips through the back-compat path.
    phrases = load_validated_phrases(_FIXTURES / "00-canonical-ok.md")
    assert "should this be a dto or array" in phrases
    assert "service vs repository for read paths" in phrases
