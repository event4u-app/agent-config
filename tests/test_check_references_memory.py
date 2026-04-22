"""Tests for the YAML-memory branch of scripts/check_references.py."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import check_references as cr  # noqa: E402

pytest.importorskip("yaml")


def _setup_repo(tmp_path: Path) -> Path:
    (tmp_path / ".agent-src/skills/demo-skill").mkdir(parents=True)
    (tmp_path / ".agent-src/skills/demo-skill/SKILL.md").write_text("# demo", encoding="utf-8")
    (tmp_path / ".agent-src/rules").mkdir(parents=True)
    (tmp_path / ".agent-src/commands").mkdir(parents=True)
    (tmp_path / ".agent-src/guidelines").mkdir(parents=True)
    (tmp_path / "agents/memory/domain-invariants").mkdir(parents=True)
    return tmp_path


def _write_yaml(repo: Path, rel: str, body: str) -> None:
    target = repo / rel
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(body, encoding="utf-8")


def test_valid_local_path_passes(tmp_path):
    repo = _setup_repo(tmp_path)
    (repo / "tests/Example.php").parent.mkdir(parents=True, exist_ok=True)
    (repo / "tests/Example.php").write_text("<?php", encoding="utf-8")
    _write_yaml(repo, "agents/memory/domain-invariants/ok.yml", """
version: 1
entries:
  - id: x
    enforcement:
      - test: tests/Example.php
""")
    broken = cr.scan_all(repo)
    assert not [b for b in broken if b.ref_type == "memory-path"]


def test_missing_local_path_fails(tmp_path):
    repo = _setup_repo(tmp_path)
    _write_yaml(repo, "agents/memory/domain-invariants/bad.yml", """
version: 1
entries:
  - id: x
    enforcement:
      - test: tests/Missing.php
""")
    broken = cr.scan_all(repo)
    paths = [b for b in broken if b.ref_type == "memory-path"]
    assert len(paths) == 1
    assert paths[0].ref == "tests/Missing.php"


def test_urls_and_adr_skipped(tmp_path):
    repo = _setup_repo(tmp_path)
    _write_yaml(repo, "agents/memory/domain-invariants/urls.yml", """
version: 1
entries:
  - id: x
    source:
      - https://example.com/repo/pull/1
      - adr://0007-whatever
      - ticket://ABC-1
""")
    broken = cr.scan_all(repo)
    assert not [b for b in broken if b.ref_type == "memory-path"]


def test_globs_skipped(tmp_path):
    repo = _setup_repo(tmp_path)
    _write_yaml(repo, "agents/memory/domain-invariants/globs.yml", """
version: 1
entries:
  - id: x
    paths:
      - app/Models/**
      - app/Policies/Tenant*.php
""")
    broken = cr.scan_all(repo)
    assert not [b for b in broken if b.ref_type == "memory-path"]


def test_known_skill_passes(tmp_path):
    repo = _setup_repo(tmp_path)
    _write_yaml(repo, "agents/memory/domain-invariants/skill-ok.yml", """
version: 1
entries:
  - id: x
    skill: demo-skill
""")
    broken = cr.scan_all(repo)
    assert not [b for b in broken if b.ref_type == "memory-skill"]


def test_unknown_skill_warns(tmp_path):
    repo = _setup_repo(tmp_path)
    _write_yaml(repo, "agents/memory/domain-invariants/skill-bad.yml", """
version: 1
entries:
  - id: x
    skill: nonexistent-skill
""")
    broken = cr.scan_all(repo)
    skill_refs = [b for b in broken if b.ref_type == "memory-skill"]
    assert len(skill_refs) == 1
    assert skill_refs[0].ref == "nonexistent-skill"
    assert skill_refs[0].severity == "warning"


def test_skills_list_validated(tmp_path):
    repo = _setup_repo(tmp_path)
    _write_yaml(repo, "agents/memory/domain-invariants/skills-list.yml", """
version: 1
entries:
  - id: x
    skills:
      - demo-skill
      - also-missing
""")
    broken = cr.scan_all(repo)
    refs = [b.ref for b in broken if b.ref_type == "memory-skill"]
    assert refs == ["also-missing"]


def test_empty_memory_dir_is_clean(tmp_path):
    repo = _setup_repo(tmp_path)
    # directory exists but contains no YAML files
    broken = cr.scan_all(repo)
    assert broken == []
