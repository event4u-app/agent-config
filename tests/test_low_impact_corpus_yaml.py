"""YAML lockfile runtime contract for the low-impact corpus.

Step-10 Phase 2 — see ``agents/roadmaps/step-10-corpus-yaml-lockfile.md``.

Covers the runtime switch from Markdown parsing to the
``.lock.yaml`` lockfile:

- ``load_corpus_lock`` happy path: schema-v1 YAML -> ``CorpusParseResult``
- missing lockfile -> empty result (matches Markdown contract)
- schema-version mismatch -> typed ``CorpusParseError``
- lenient loaders prefer YAML when both files are present
- lenient loaders fall back to Markdown when the lockfile is absent
- broken YAML -> lenient loaders fall back to Markdown (never raise)
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.ai_council.compile_corpus import compile_corpus  # noqa: E402
from scripts.ai_council.low_impact_corpus import (  # noqa: E402
    CorpusParseError,
    load_anti_example_phrases,
    load_corpus_lock,
    load_validated_phrases,
)

_FIXTURES = Path(__file__).parent / "fixtures" / "corpus-robust"


def _compile_canonical(tmp_path: Path) -> tuple[Path, Path]:
    source = tmp_path / "corpus.md"
    source.write_text(
        _FIXTURES.joinpath("00-canonical-ok.md").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    out = tmp_path / "corpus.lock.yaml"
    compile_corpus(source, out)
    return source, out


def test_load_corpus_lock_happy_path(tmp_path: Path) -> None:
    _, lock = _compile_canonical(tmp_path)
    result = load_corpus_lock(lock)
    assert len(result.validated) == 2
    assert "should this be a dto or array" in result.phrases("validated")
    assert "service vs repository for read paths" in result.phrases("validated")
    assert len(result.probation) == 1
    assert len(result.anti_examples) == 2


def test_load_corpus_lock_missing_file_returns_empty(tmp_path: Path) -> None:
    result = load_corpus_lock(tmp_path / "missing.lock.yaml")
    assert result.validated == ()
    assert result.probation == ()
    assert result.anti_examples == ()


def test_load_corpus_lock_schema_mismatch_raises(tmp_path: Path) -> None:
    lock = tmp_path / "corpus.lock.yaml"
    lock.write_text(
        "schema_version: 2\nvalidated: []\nprobation: []\nanti_examples: []\n",
        encoding="utf-8",
    )
    with pytest.raises(CorpusParseError) as exc_info:
        load_corpus_lock(lock)
    assert exc_info.value.reason == "schema_version_mismatch"


def test_load_validated_phrases_prefers_yaml_lockfile(tmp_path: Path) -> None:
    source, _ = _compile_canonical(tmp_path)
    # Mutate the Markdown so the two sources disagree; YAML must win.
    source.write_text(
        source.read_text(encoding="utf-8").replace(
            "Should this be a DTO or array",
            "Mutated phrase that should NOT appear",
        ),
        encoding="utf-8",
    )
    phrases = load_validated_phrases(source)
    assert "should this be a dto or array" in phrases
    assert "mutated phrase that should not appear" not in phrases


def test_load_anti_example_phrases_prefers_yaml_lockfile(tmp_path: Path) -> None:
    source, _ = _compile_canonical(tmp_path)
    phrases = load_anti_example_phrases(source)
    # canonical fixture has 2 anti-examples
    assert len(phrases) == 2


def test_load_validated_phrases_falls_back_to_markdown(tmp_path: Path) -> None:
    # No lockfile generated -> lenient Markdown parsing kicks in.
    source = tmp_path / "corpus.md"
    source.write_text(
        _FIXTURES.joinpath("00-canonical-ok.md").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    phrases = load_validated_phrases(source)
    assert "should this be a dto or array" in phrases
    assert "service vs repository for read paths" in phrases


def test_load_anti_example_phrases_falls_back_to_markdown(tmp_path: Path) -> None:
    source = tmp_path / "corpus.md"
    source.write_text(
        _FIXTURES.joinpath("00-canonical-ok.md").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    phrases = load_anti_example_phrases(source)
    assert len(phrases) == 2


def test_lenient_loaders_recover_from_broken_lockfile(tmp_path: Path) -> None:
    """Malformed YAML must not block routing — fall back to Markdown."""
    source = tmp_path / "corpus.md"
    source.write_text(
        _FIXTURES.joinpath("00-canonical-ok.md").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    lock = tmp_path / "corpus.lock.yaml"
    lock.write_text("schema_version: 1\nvalidated: [: : :\n", encoding="utf-8")
    # YAML parse fails -> sibling Markdown takes over.
    phrases = load_validated_phrases(source)
    assert "should this be a dto or array" in phrases


def test_lenient_loaders_recover_from_schema_mismatched_lockfile(tmp_path: Path) -> None:
    """Schema-version mismatch raises in strict load -> lenient falls back."""
    source = tmp_path / "corpus.md"
    source.write_text(
        _FIXTURES.joinpath("00-canonical-ok.md").read_text(encoding="utf-8"),
        encoding="utf-8",
    )
    lock = tmp_path / "corpus.lock.yaml"
    lock.write_text(
        "schema_version: 99\nvalidated: []\nprobation: []\nanti_examples: []\n",
        encoding="utf-8",
    )
    phrases = load_validated_phrases(source)
    assert "should this be a dto or array" in phrases


def test_repo_lockfile_is_consumed_by_lenient_loader() -> None:
    """The committed lockfile drives the repo's routing classifier."""
    repo_corpus = Path(__file__).resolve().parents[1] / "agents" / "low-impact-decisions.md"
    repo_lock = repo_corpus.with_suffix("").with_suffix(".lock.yaml")
    # Repo-relative anchor: just confirm the file exists and is consumed
    # without raising. Phrase-content tests use isolated fixtures above.
    if not repo_lock.exists():
        pytest.skip("repo lockfile missing")
    doc = yaml.safe_load(repo_lock.read_text(encoding="utf-8"))
    assert doc["schema_version"] == 1
    # lenient loader against the repo corpus must return a tuple (possibly empty)
    phrases = load_validated_phrases(repo_corpus)
    assert isinstance(phrases, tuple)
