"""Tests for ``scripts/lint_artefact_frontmatter.py``.

Covers the ADR-013 per-artefact contract: presence of the five keys
(``workspaces``, ``packs``, ``lifecycle``, ``trust``, ``install``),
closed-vocabulary enforcement, enum + bool typing, and the
``unassigned-artefacts.yml`` quarantine collision rule.

Strategy: build a self-contained fixture tree under ``tmp_path``
(`.agent-src.uncondensed/{skills,rules,commands,templates}` plus
`config/discovery/{workspaces,packs,unassigned-artefacts}.yml`) and
monkeypatch the module-level ``ROOT``, ``SRC``, ``VOCAB_DIR`` so the
linter walks the fixture instead of the live repo.
"""
from __future__ import annotations

import sys
import textwrap
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))

import lint_artefact_frontmatter as mod  # noqa: E402


VALID_FRONTMATTER = textwrap.dedent(
    """\
    ---
    name: sample-skill
    description: "fixture skill for tests"
    workspaces:
      - engineering
    packs:
      - engineering-base
    lifecycle: active
    trust:
      level: core
      confidence: high
      human_review_required: false
    install:
      default: true
      removable: true
    ---

    # sample-skill
    """
)


def _make_repo(tmp_path: Path, skill_body: str = VALID_FRONTMATTER) -> Path:
    """Materialise a minimal fixture tree the linter can walk."""
    vocab = tmp_path / "config" / "discovery"
    vocab.mkdir(parents=True)
    (vocab / "workspaces.yml").write_text(
        "- id: engineering\n- id: product\n",
        encoding="utf-8",
    )
    (vocab / "packs.yml").write_text(
        "- id: engineering-base\n- id: product-basic\n",
        encoding="utf-8",
    )
    (vocab / "unassigned-artefacts.yml").write_text("[]\n", encoding="utf-8")

    src = tmp_path / ".agent-src.uncondensed"
    skill_dir = src / "skills" / "sample-skill"
    skill_dir.mkdir(parents=True)
    (skill_dir / "SKILL.md").write_text(skill_body, encoding="utf-8")
    return tmp_path


@pytest.fixture
def repo(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    root = _make_repo(tmp_path)
    monkeypatch.setattr(mod, "ROOT", root)
    monkeypatch.setattr(mod, "SRC", root / ".agent-src.uncondensed")
    monkeypatch.setattr(mod, "VOCAB_DIR", root / "config" / "discovery")
    return root


def _skill_path(repo: Path) -> Path:
    return repo / ".agent-src.uncondensed" / "skills" / "sample-skill" / "SKILL.md"


def test_valid_frontmatter_clean(repo, capsys):
    assert mod.main(["--quiet"]) == 0


def test_missing_required_key_fails(repo, capsys):
    body = VALID_FRONTMATTER.replace("lifecycle: active\n", "")
    _skill_path(repo).write_text(body, encoding="utf-8")
    assert mod.main(["--quiet"]) == 1
    err = capsys.readouterr().err
    assert "missing required key `lifecycle`" in err


def test_unknown_workspace_fails(repo, capsys):
    body = VALID_FRONTMATTER.replace("- engineering\n", "- mars-colony\n")
    _skill_path(repo).write_text(body, encoding="utf-8")
    assert mod.main(["--quiet"]) == 1
    assert "workspaces not in workspaces.yml" in capsys.readouterr().err


def test_unknown_pack_fails(repo, capsys):
    body = VALID_FRONTMATTER.replace("- engineering-base\n", "- nope-pack\n")
    _skill_path(repo).write_text(body, encoding="utf-8")
    assert mod.main(["--quiet"]) == 1
    assert "packs not in packs.yml" in capsys.readouterr().err


def test_bad_lifecycle_enum_fails(repo, capsys):
    body = VALID_FRONTMATTER.replace("lifecycle: active", "lifecycle: yolo")
    _skill_path(repo).write_text(body, encoding="utf-8")
    assert mod.main(["--quiet"]) == 1
    assert "lifecycle `yolo` not in" in capsys.readouterr().err


def test_bad_trust_level_fails(repo, capsys):
    body = VALID_FRONTMATTER.replace("level: core", "level: divine")
    _skill_path(repo).write_text(body, encoding="utf-8")
    assert mod.main(["--quiet"]) == 1
    assert "trust.level `divine` not in" in capsys.readouterr().err


def test_non_bool_install_default_fails(repo, capsys):
    body = VALID_FRONTMATTER.replace("default: true", 'default: "yes"')
    _skill_path(repo).write_text(body, encoding="utf-8")
    assert mod.main(["--quiet"]) == 1
    assert "install.default must be bool" in capsys.readouterr().err


def test_missing_frontmatter_block_fails(repo, capsys):
    _skill_path(repo).write_text("# sample-skill\n\nno frontmatter here.\n", encoding="utf-8")
    assert mod.main(["--quiet"]) == 1
    assert "missing or unparseable frontmatter" in capsys.readouterr().err


def test_quarantine_path_skipped_when_clean(tmp_path, monkeypatch, capsys):
    root = _make_repo(tmp_path, skill_body="# no frontmatter\n")
    (root / "config" / "discovery" / "unassigned-artefacts.yml").write_text(
        "- path: .agent-src.uncondensed/skills/sample-skill/SKILL.md\n"
        "  reason: scaffold under construction\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(mod, "ROOT", root)
    monkeypatch.setattr(mod, "SRC", root / ".agent-src.uncondensed")
    monkeypatch.setattr(mod, "VOCAB_DIR", root / "config" / "discovery")
    assert mod.main(["--quiet"]) == 0


def test_quarantine_collision_with_frontmatter_fails(tmp_path, monkeypatch, capsys):
    root = _make_repo(tmp_path)
    (root / "config" / "discovery" / "unassigned-artefacts.yml").write_text(
        "- path: .agent-src.uncondensed/skills/sample-skill/SKILL.md\n"
        "  reason: should not also carry frontmatter\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(mod, "ROOT", root)
    monkeypatch.setattr(mod, "SRC", root / ".agent-src.uncondensed")
    monkeypatch.setattr(mod, "VOCAB_DIR", root / "config" / "discovery")
    assert mod.main(["--quiet"]) == 1
    assert "quarantined" in capsys.readouterr().err
