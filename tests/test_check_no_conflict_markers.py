"""Tests for scripts/check_no_conflict_markers.py."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location(
    "check_no_conflict_markers",
    REPO_ROOT / "src" / "scripts" / "check_no_conflict_markers.py",
)
assert SPEC and SPEC.loader
cm = importlib.util.module_from_spec(SPEC)
sys.modules["check_no_conflict_markers"] = cm
SPEC.loader.exec_module(cm)


def test_repo_is_clean():
    """The committed tree must carry no conflict markers / unmerged entries."""
    assert cm.main(["--quiet"]) == 0


def test_detects_conflict_envelope(tmp_path: Path, monkeypatch):
    """A file with the <<<<<<< ... >>>>>>> envelope is flagged."""
    f = tmp_path / "x.txt"
    f.write_text("<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> branch\n")
    monkeypatch.setattr(cm, "tracked_text_files", lambda: [str(f.relative_to(cm.REPO))]
                        if str(f).startswith(str(cm.REPO)) else [])
    # Use REPO-relative resolution: point REPO at tmp_path for isolation.
    monkeypatch.setattr(cm, "REPO", tmp_path)
    monkeypatch.setattr(cm, "tracked_text_files", lambda: ["x.txt"])
    monkeypatch.setattr(cm, "unmerged_paths", lambda: [])
    assert cm.scan_markers(set()) == ["x.txt"]


def test_ignore_comment_suppresses(tmp_path: Path, monkeypatch):
    f = tmp_path / "doc.md"
    f.write_text(
        "<<<<<<< HEAD  # conflict-marker-check: ignore\n"
        "=======  # conflict-marker-check: ignore\n"
        ">>>>>>> b  # conflict-marker-check: ignore\n"
    )
    monkeypatch.setattr(cm, "REPO", tmp_path)
    monkeypatch.setattr(cm, "tracked_text_files", lambda: ["doc.md"])
    assert cm.scan_markers(set()) == []


def test_allowlist_skips_file(tmp_path: Path, monkeypatch):
    f = tmp_path / "skill.md"
    f.write_text("<<<<<<< HEAD\nx\n=======\ny\n>>>>>>> z\n")
    monkeypatch.setattr(cm, "REPO", tmp_path)
    monkeypatch.setattr(cm, "tracked_text_files", lambda: ["skill.md"])
    assert cm.scan_markers({"skill.md"}) == []
