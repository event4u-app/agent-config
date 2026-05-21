"""Compiler contract for ``agents/decisions/low-impact-decisions.md`` -> YAML lockfile.

Step-10 Phase 1 — see ``agents/roadmaps/step-10-corpus-yaml-lockfile.md``.

The compiler reuses :func:`parse_corpus_strict` from the hardened
Markdown parser (step-9 P4); these tests cover the YAML serialisation
contract on top of it:

- happy path: canonical fixture -> populated schema-v1 document
- empty corpus -> empty lists, valid schema
- parse error -> raises ``CorpusParseError``, leaves the existing
  lockfile untouched
- idempotency: compile -> read -> compile-again -> byte-identical
- ``--check`` mode: stale lockfile -> exit code 1
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from scripts.ai_council.compile_corpus import (  # noqa: E402
    SCHEMA_VERSION,
    build_lock_document,
    compile_corpus,
    dump_lock_yaml,
    _main,
)
from scripts.ai_council.low_impact_corpus import (  # noqa: E402
    CorpusParseError,
    parse_corpus_strict,
)

_FIXTURES = Path(__file__).parent / "fixtures" / "corpus-robust"
_REPO_CORPUS = Path(__file__).resolve().parents[1] / "agents" / "decisions" / "low-impact-decisions.md"
_REPO_LOCKFILE = Path(__file__).resolve().parents[1] / "agents" / "decisions" / "low-impact-decisions.lock.yaml"


def test_compile_canonical_fixture_produces_populated_lockfile(tmp_path: Path) -> None:
    out = tmp_path / "corpus.lock.yaml"
    yaml_text = compile_corpus(_FIXTURES / "00-canonical-ok.md", out)
    doc = yaml.safe_load(yaml_text)
    assert doc["schema_version"] == SCHEMA_VERSION
    assert doc["provenance"]["source_sha256"]
    assert len(doc["validated"]) == 2
    assert len(doc["probation"]) == 1
    assert len(doc["anti_examples"]) == 2
    phrases = {entry["normalised"] for entry in doc["validated"]}
    assert "should this be a dto or array" in phrases
    assert "service vs repository for read paths" in phrases


def test_compile_missing_source_produces_empty_document(tmp_path: Path) -> None:
    out = tmp_path / "corpus.lock.yaml"
    compile_corpus(tmp_path / "missing.md", out)
    doc = yaml.safe_load(out.read_text(encoding="utf-8"))
    assert doc["schema_version"] == SCHEMA_VERSION
    assert doc["validated"] == []
    assert doc["probation"] == []
    assert doc["anti_examples"] == []
    assert doc["provenance"]["source_sha256"] == (
        "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
    )


def test_compile_parse_error_does_not_clobber_existing_lockfile(tmp_path: Path) -> None:
    out = tmp_path / "corpus.lock.yaml"
    out.write_text("preserved\n", encoding="utf-8")
    with pytest.raises(CorpusParseError):
        compile_corpus(_FIXTURES / "01-curly-quotes.md", out)
    assert out.read_text(encoding="utf-8") == "preserved\n"


def test_compile_is_idempotent(tmp_path: Path) -> None:
    out = tmp_path / "corpus.lock.yaml"
    first = compile_corpus(_FIXTURES / "00-canonical-ok.md", out)
    second = compile_corpus(_FIXTURES / "00-canonical-ok.md", out)
    assert first == second
    # YAML re-load -> re-dump round-trip is also stable.
    doc = yaml.safe_load(out.read_text(encoding="utf-8"))
    assert dump_lock_yaml(doc) == first


def test_repo_lockfile_is_in_sync() -> None:
    """The committed lockfile must match a fresh compile of the source."""
    if not _REPO_CORPUS.exists() or not _REPO_LOCKFILE.exists():
        pytest.skip("repo corpus / lockfile not present")
    source_text = _REPO_CORPUS.read_text(encoding="utf-8")
    result = parse_corpus_strict(_REPO_CORPUS)
    fresh = dump_lock_yaml(build_lock_document(_REPO_CORPUS, result, source_text))
    existing = _REPO_LOCKFILE.read_text(encoding="utf-8")
    assert fresh == existing, (
        "agents/decisions/low-impact-decisions.lock.yaml is stale — "
        "run: python3 -m scripts.ai_council.compile_corpus"
    )


def test_check_mode_passes_on_fresh_lockfile(tmp_path: Path) -> None:
    source = tmp_path / "corpus.md"
    source.write_text(_FIXTURES.joinpath("00-canonical-ok.md").read_text(encoding="utf-8"), encoding="utf-8")
    out = tmp_path / "corpus.lock.yaml"
    compile_corpus(source, out)
    rc = _main(["--source", str(source), "--out", str(out), "--check"])
    assert rc == 0


def test_check_mode_fails_on_stale_lockfile(tmp_path: Path) -> None:
    source = tmp_path / "corpus.md"
    source.write_text(_FIXTURES.joinpath("00-canonical-ok.md").read_text(encoding="utf-8"), encoding="utf-8")
    out = tmp_path / "corpus.lock.yaml"
    out.write_text("schema_version: 1\nvalidated: []\nprobation: []\nanti_examples: []\n", encoding="utf-8")
    rc = _main(["--source", str(source), "--out", str(out), "--check"])
    assert rc == 1


def test_check_mode_returns_parse_error_code(tmp_path: Path) -> None:
    out = tmp_path / "corpus.lock.yaml"
    rc = _main([
        "--source", str(_FIXTURES / "01-curly-quotes.md"),
        "--out", str(out),
        "--check",
    ])
    assert rc == 2


def test_provenance_captures_last_upstreamed_sha(tmp_path: Path) -> None:
    source = tmp_path / "corpus.md"
    source.write_text(
        "# Test\n\n## Validated\n\n<!-- intake-anchor: validated -->\n\n"
        "<!-- intake-anchor: probation -->\n\n"
        "## Provenance\n\nlast-upstreamed: abcdef0123456789abcdef0123456789abcdef01\n",
        encoding="utf-8",
    )
    out = tmp_path / "corpus.lock.yaml"
    compile_corpus(source, out)
    doc = yaml.safe_load(out.read_text(encoding="utf-8"))
    assert doc["provenance"]["last_upstreamed"] == "abcdef0123456789abcdef0123456789abcdef01"
