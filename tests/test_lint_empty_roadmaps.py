"""Tests for ``src/scripts/lint_empty_roadmaps.py``.

Covers the empty-roadmap backstop: 0-byte and whitespace-only ``.md`` files
under ``agents/roadmaps/`` (active + nested ``archive/`` etc.) are detected,
files with real content are not, and a missing roadmaps dir is a clean pass.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))

import lint_empty_roadmaps as mod  # noqa: E402


def _mk(root: Path, rel: str, content: str) -> Path:
    p = root / "agents" / "roadmaps" / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(content, encoding="utf-8")
    return p


def test_zero_byte_roadmap_is_flagged(tmp_path: Path):
    _mk(tmp_path, "road-to-x.md", "")
    empties = mod.find_empty_roadmaps(tmp_path)
    assert [str(p) for p in empties] == ["agents/roadmaps/road-to-x.md"]


@pytest.mark.parametrize("blank", ["", "   ", "\n\n", "\t\n  \n"])
def test_whitespace_only_roadmap_is_flagged(tmp_path: Path, blank: str):
    _mk(tmp_path, "road-to-blank.md", blank)
    empties = mod.find_empty_roadmaps(tmp_path)
    assert len(empties) == 1


def test_roadmap_with_content_is_not_flagged(tmp_path: Path):
    _mk(tmp_path, "road-to-real.md", "---\nstatus: ready\n---\n\n# Goal\n\nDo X.\n")
    assert mod.find_empty_roadmaps(tmp_path) == []


def test_nested_archive_empty_is_flagged(tmp_path: Path):
    _mk(tmp_path, "archive/old.md", "")
    _mk(tmp_path, "road-to-real.md", "# Real\n\nbody\n")
    empties = [str(p) for p in mod.find_empty_roadmaps(tmp_path)]
    assert "agents/roadmaps/archive/old.md" in empties
    assert "agents/roadmaps/road-to-real.md" not in empties


def test_missing_roadmaps_dir_is_clean(tmp_path: Path):
    assert mod.find_empty_roadmaps(tmp_path) == []


def test_main_exit_codes(tmp_path: Path, monkeypatch: pytest.MonkeyPatch):
    monkeypatch.chdir(tmp_path)
    _mk(tmp_path, "road-to-ok.md", "# ok\n\nbody\n")
    assert mod.main() == 0
    _mk(tmp_path, "road-to-empty.md", "")
    assert mod.main() == 1
