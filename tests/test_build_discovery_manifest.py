"""Tests for ``scripts/build_discovery_manifest.py`` — ADR-015 contract.

Covers the Phase-2 generator additions: per-artefact ``checksum``, the
optional ``requires`` field, the top-level ``stats`` block, and
determinism over two consecutive builds against the same fixture tree.

Strategy mirrors ``test_lint_artefact_frontmatter.py`` — build a
self-contained fixture under ``tmp_path`` and monkeypatch the
module-level ``ROOT``, ``SRC``, ``VOCAB_DIR`` so the generator walks the
fixture instead of the live repo.
"""
from __future__ import annotations

import json
import re
import sys
import textwrap
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import build_discovery_manifest as mod  # noqa: E402


SKILL_BASE = textwrap.dedent(
    """\
    ---
    name: {name}
    description: "fixture skill"
    workspaces:
      - engineering
    packs:
      - engineering-base
    {extra}lifecycle: active
    trust:
      level: core
      confidence: high
      human_review_required: false
    install:
      default: true
      removable: true
    ---

    # {name}
    """
)


def _make_repo(tmp_path: Path) -> Path:
    vocab = tmp_path / "config" / "discovery"
    vocab.mkdir(parents=True)
    (vocab / "workspaces.yml").write_text(
        'workspaces:\n  - id: engineering\n    label: "Engineering"\n    description: "devs"\n    default_packs: [engineering-base]\n',
        encoding="utf-8",
    )
    # Loader treats the file as a list at top-level — match the live shape.
    (vocab / "workspaces.yml").write_text(
        '- id: engineering\n  label: "Engineering"\n  description: "devs"\n  default_packs: [engineering-base]\n',
        encoding="utf-8",
    )
    (vocab / "packs.yml").write_text(
        '- id: engineering-base\n  label: "Engineering Base"\n  description: "core eng"\n  workspaces: [engineering]\n  trust_level_default: core\n'
        '- id: php\n  label: "PHP"\n  description: "php runtime"\n  workspaces: [engineering]\n  trust_level_default: professional\n',
        encoding="utf-8",
    )
    (vocab / "unassigned-artefacts.yml").write_text("[]\n", encoding="utf-8")
    (tmp_path / ".agent-src.uncompressed" / "skills").mkdir(parents=True)
    (tmp_path / ".agent-src.uncompressed" / "rules").mkdir()
    (tmp_path / ".agent-src.uncompressed" / "commands").mkdir()
    return tmp_path


@pytest.fixture
def repo(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    root = _make_repo(tmp_path)
    src = root / ".agent-src.uncompressed"
    monkeypatch.setattr(mod, "ROOT", root)
    monkeypatch.setattr(mod, "SRC", src)
    monkeypatch.setattr(mod, "VOCAB_DIR", root / "config" / "discovery")
    # Post-ADR-017 the manifest builder discovers sources via multi-root
    # helpers from `_lib.agent_src`. Scope them to the fixture tree so the
    # test doesn't walk real package roots.
    monkeypatch.setattr(mod, "artefact_roots", lambda: [src])

    def _resolve_logical(rel: str):
        p = src / rel.replace("\\", "/").lstrip("/")
        return p if p.exists() else None

    monkeypatch.setattr(mod, "resolve_logical", _resolve_logical)
    return root


def _write_skill(repo: Path, name: str, extra: str = "") -> Path:
    p = repo / ".agent-src.uncompressed" / "skills" / name / "SKILL.md"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(SKILL_BASE.format(name=name, extra=extra), encoding="utf-8")
    return p


def test_empty_tree_yields_zero_stats(repo: Path) -> None:
    manifest, _ = mod._build(strict=False)
    assert manifest["stats"]["total_artefacts"] == 0
    assert manifest["stats"]["by_category"]["skill"] == 0
    assert manifest["stats"]["unassigned_count"] == 0
    assert manifest["artefacts"] == []


def test_single_skill_carries_checksum(repo: Path) -> None:
    _write_skill(repo, "sample-a")
    manifest, _ = mod._build(strict=False)
    assert len(manifest["artefacts"]) == 1
    entry = manifest["artefacts"][0]
    assert re.fullmatch(r"sha256:[0-9a-f]{64}", entry["checksum"])
    assert "requires" not in entry  # absent when not declared
    assert manifest["stats"]["by_category"]["skill"] == 1
    assert manifest["stats"]["by_trust_level"]["core"] == 1


def test_optional_requires_is_emitted(repo: Path) -> None:
    _write_skill(repo, "sample-b", extra="requires:\n  - php\n")
    manifest, _ = mod._build(strict=False)
    entry = manifest["artefacts"][0]
    assert entry["requires"] == ["php"]


def test_unknown_requires_marks_unassigned(repo: Path) -> None:
    _write_skill(repo, "sample-c", extra="requires:\n  - mars-colony\n")
    manifest, _ = mod._build(strict=False)
    assert manifest["artefacts"] == []
    assert len(manifest["unassigned"]) == 1
    assert "requires" in manifest["unassigned"][0]["reason"]


def test_determinism_byte_identical(repo: Path) -> None:
    _write_skill(repo, "sample-d")
    _write_skill(repo, "sample-e", extra="requires:\n  - php\n")
    a, _ = mod._build(strict=False)
    b, _ = mod._build(strict=False)
    mod._finalise_checksum(a)
    mod._finalise_checksum(b)
    norm = lambda m: {**m, "generated_at": "X"}
    assert mod._serialize(norm(a)) == mod._serialize(norm(b))


def test_checksum_changes_when_body_changes(repo: Path) -> None:
    path = _write_skill(repo, "sample-f")
    m1, _ = mod._build(strict=False)
    c1 = m1["artefacts"][0]["checksum"]
    path.write_text(path.read_text(encoding="utf-8") + "\nextra content\n", encoding="utf-8")
    m2, _ = mod._build(strict=False)
    c2 = m2["artefacts"][0]["checksum"]
    assert c1 != c2


def test_stats_total_matches_artefact_list(repo: Path) -> None:
    _write_skill(repo, "s1")
    _write_skill(repo, "s2")
    _write_skill(repo, "s3", extra="requires:\n  - php\n")
    manifest, _ = mod._build(strict=False)
    assert manifest["stats"]["total_artefacts"] == len(manifest["artefacts"]) == 3



def _write_skill_with(
    repo: Path,
    name: str,
    pack: str = "engineering-base",
    lifecycle: str = "active",
    trust_level: str = "core",
) -> Path:
    body = textwrap.dedent(
        f"""\
        ---
        name: {name}
        description: "fixture skill"
        workspaces:
          - engineering
        packs:
          - {pack}
        lifecycle: {lifecycle}
        trust:
          level: {trust_level}
          confidence: high
          human_review_required: false
        install:
          default: true
          removable: true
        ---

        # {name}
        """
    )
    p = repo / ".agent-src.uncompressed" / "skills" / name / "SKILL.md"
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(body, encoding="utf-8")
    return p


def test_orphan_artefact_detected_for_sparse_pack(repo: Path) -> None:
    _write_skill_with(repo, "sample-eng", pack="engineering-base")
    _write_skill_with(repo, "sample-eng-2", pack="engineering-base")
    _write_skill_with(repo, "sample-php-solo", pack="php")
    manifest, _ = mod._build(strict=False)
    orphans = mod._orphan_artefacts(manifest)
    assert len(orphans) == 1
    assert orphans[0]["pack"] == "php"


def test_experimental_lifecycle_exempts_from_orphan(repo: Path) -> None:
    _write_skill_with(repo, "sample-eng", pack="engineering-base")
    _write_skill_with(repo, "sample-eng-2", pack="engineering-base")
    _write_skill_with(repo, "sample-php-solo", pack="php", lifecycle="experimental")
    manifest, _ = mod._build(strict=False)
    assert mod._orphan_artefacts(manifest) == []


def test_deprecation_report_lists_deprecated(repo: Path) -> None:
    _write_skill_with(repo, "active-one", pack="engineering-base")
    _write_skill_with(repo, "old-one", pack="engineering-base", lifecycle="deprecated")
    manifest, _ = mod._build(strict=False)
    report = mod._deprecation_report(manifest)
    assert "Deprecated artefacts: **1**" in report
    assert "old-one" in report


def test_trust_report_aggregates_by_workspace(repo: Path) -> None:
    _write_skill_with(repo, "a", pack="engineering-base", trust_level="core")
    _write_skill_with(repo, "b", pack="engineering-base", trust_level="professional")
    manifest, _ = mod._build(strict=False)
    report = mod._trust_report(manifest)
    assert "`engineering`" in report
    assert "Workspaces tracked: **1**" in report


def test_orphan_report_is_deterministic(repo: Path) -> None:
    _write_skill_with(repo, "eng-1", pack="engineering-base")
    _write_skill_with(repo, "eng-2", pack="engineering-base")
    _write_skill_with(repo, "php-solo", pack="php")
    m1, _ = mod._build(strict=False)
    m2, _ = mod._build(strict=False)
    assert mod._orphan_report(m1) == mod._orphan_report(m2)


def test_workspaces_view_lists_each_workspace(repo: Path) -> None:
    _write_skill_with(repo, "s1", pack="engineering-base")
    _write_skill_with(repo, "s2", pack="engineering-base")
    manifest, _ = mod._build(strict=False)
    mod._finalise_checksum(manifest)
    view = mod._workspaces_view(manifest)
    assert view["checksum"] == manifest["checksum"]
    assert len(view["workspaces"]) == 1
    ws = view["workspaces"][0]
    assert ws["id"] == "engineering"
    assert ws["artefact_count"] == 2


def test_packs_view_carries_lifecycle_and_trust_counts(repo: Path) -> None:
    _write_skill_with(repo, "a", pack="engineering-base", trust_level="core")
    _write_skill_with(repo, "b", pack="engineering-base", trust_level="core")
    _write_skill_with(repo, "c", pack="engineering-base", lifecycle="deprecated", trust_level="core")
    manifest, _ = mod._build(strict=False)
    mod._finalise_checksum(manifest)
    view = mod._packs_view(manifest)
    pack = next(p for p in view["packs"] if p["id"] == "engineering-base")
    assert pack["artefact_count"] == 3
    assert pack["by_lifecycle"]["active"] == 2
    assert pack["by_lifecycle"]["deprecated"] == 1
    assert pack["by_trust_level"]["core"] == 3


def test_subviews_are_deterministic(repo: Path) -> None:
    _write_skill_with(repo, "s1", pack="engineering-base")
    _write_skill_with(repo, "s2", pack="engineering-base")
    m1, _ = mod._build(strict=False)
    m2, _ = mod._build(strict=False)
    mod._finalise_checksum(m1)
    mod._finalise_checksum(m2)
    import json as _json

    assert _json.dumps(mod._workspaces_view(m1), sort_keys=True) == _json.dumps(
        mod._workspaces_view(m2), sort_keys=True
    )
    assert _json.dumps(mod._packs_view(m1), sort_keys=True) == _json.dumps(
        mod._packs_view(m2), sort_keys=True
    )



def test_check_artefact_checksums_detects_drift(repo: Path, monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
    """Phase-6 gate flags a manifest entry that no longer matches its source bytes."""
    import check_artefact_checksums as gate  # noqa: WPS433

    monkeypatch.setattr(gate, "ROOT", repo)
    skill_path = _write_skill(repo, "drift-check")
    manifest, _ = mod._build(strict=False)
    mod._finalise_checksum(manifest)

    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    code, errors = gate._check(manifest_path)
    assert code == 0, errors

    # Mutate source — checksum must drift.
    skill_path.write_text(skill_path.read_text(encoding="utf-8") + "\nextra body line\n", encoding="utf-8")
    code, errors = gate._check(manifest_path)
    assert code == 1
    assert any("drift" in e for e in errors)
