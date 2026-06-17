"""Tests for `scripts/lint_roadmap_later_disposition.py` — the `later/`
roadmap-disposition guard."""

from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))

import lint_roadmap_later_disposition as lint  # noqa: E402


def _roadmaps(tmp_path: Path, monkeypatch):
    """Point the linter at an isolated agents/roadmaps tree under tmp_path."""
    root = tmp_path / "agents" / "roadmaps"
    (root / "later").mkdir(parents=True)
    monkeypatch.setattr(lint, "REPO_ROOT", tmp_path)
    monkeypatch.setattr(lint, "ROADMAP_ROOT", root)
    monkeypatch.setattr(lint, "LATER_DIR", root / "later")
    return root


def _write(path: Path, status: str | None, body: str = "# Roadmap: X\n\n## Phase 1\n\n- [ ] do\n") -> None:
    fm = f"---\nstatus: {status}\n---\n\n" if status else ""
    path.write_text(fm + body, encoding="utf-8")


def test_status_later_in_active_tree_is_a_violation(tmp_path, monkeypatch) -> None:
    root = _roadmaps(tmp_path, monkeypatch)
    _write(root / "road-to-x.md", "later")
    v = lint.check(root)
    assert len(v) == 1
    assert "must be parked in `later/`" in v[0].reason


def test_status_later_under_later_is_clean(tmp_path, monkeypatch) -> None:
    root = _roadmaps(tmp_path, monkeypatch)
    _write(root / "later" / "road-to-x.md", "later")
    assert lint.check(root) == []


def test_later_without_resume_condition_is_a_violation(tmp_path, monkeypatch) -> None:
    root = _roadmaps(tmp_path, monkeypatch)
    _write(root / "later" / "road-to-x.md", "draft")  # no status:later, no resume line
    v = lint.check(root)
    assert len(v) == 1
    assert "no resume condition" in v[0].reason


def test_later_with_blocked_until_line_is_clean(tmp_path, monkeypatch) -> None:
    root = _roadmaps(tmp_path, monkeypatch)
    _write(
        root / "later" / "road-to-x.md", "draft",
        body="# Roadmap: X\n\n> Blocked until the consumer repo lands.\n\n## Phase 1\n\n- [ ] do\n",
    )
    assert lint.check(root) == []


def test_active_ready_roadmap_is_clean(tmp_path, monkeypatch) -> None:
    root = _roadmaps(tmp_path, monkeypatch)
    _write(root / "road-to-x.md", "ready")
    assert lint.check(root) == []


def test_readme_and_template_are_ignored(tmp_path, monkeypatch) -> None:
    root = _roadmaps(tmp_path, monkeypatch)
    (root / "later" / "README.md").write_text("# Later roadmaps\n", encoding="utf-8")
    (root / "later" / "template.md").write_text("# template\n", encoding="utf-8")
    assert lint.check(root) == []


def test_main_exit_codes(tmp_path, monkeypatch, capsys) -> None:
    root = _roadmaps(tmp_path, monkeypatch)
    _write(root / "road-to-x.md", "later")  # Rule A violation
    assert lint.main([]) == 1
    _write(root / "road-to-x.md", "ready")  # now clean
    assert lint.main([]) == 0
