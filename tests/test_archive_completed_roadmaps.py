"""Tests for the PR-gate archival sweep (scripts/archive_completed_roadmaps.py)."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

SCRIPT = (Path(__file__).resolve().parent.parent
          / "src" / "agent-src" / "scripts" / "archive_completed_roadmaps.py")


def _git(repo: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run(["git", *args], cwd=repo, capture_output=True, text=True)


def _init_repo(tmp_path: Path) -> Path:
    repo = tmp_path / "repo"
    repo.mkdir()
    _git(repo, "init", "-q")
    _git(repo, "config", "user.email", "t@t.t")
    _git(repo, "config", "user.name", "t")
    _git(repo, "config", "commit.gpgsign", "false")
    return repo


def _write(repo: Path, rel: str, text: str) -> None:
    p = repo / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")


_COMPLETE = """# Roadmap: Done thing

> One sentence.

## Phase 1 — A

- [x] did the thing
- [x] did the other thing
"""

_OPEN = """# Roadmap: WIP

> One sentence.

## Phase 1 — A

- [x] did one
- [ ] still open
"""


def _run_sweep(repo: Path, *args: str) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, str(SCRIPT), *args],
                          cwd=repo, capture_output=True, text=True)


def test_complete_roadmap_archived_with_ref_migration(tmp_path):
    repo = _init_repo(tmp_path)
    _write(repo, "agents/roadmaps/road-to-done.md", _COMPLETE)
    # An inbound reference from a stable artifact (ADR).
    _write(repo, "docs/decisions/ADR-001.md",
           "See `agents/roadmaps/road-to-done.md` — the executing roadmap.\n")
    _git(repo, "add", "-A")
    _git(repo, "commit", "-qm", "seed")

    res = _run_sweep(repo, "--all")
    assert res.returncode == 0, res.stderr

    assert not (repo / "agents/roadmaps/road-to-done.md").exists()
    assert (repo / "agents/roadmaps/archive/road-to-done.md").exists()
    # Inbound ref rewritten to the archive path.
    adr = (repo / "docs/decisions/ADR-001.md").read_text(encoding="utf-8")
    assert "agents/roadmaps/archive/road-to-done.md" in adr
    assert "agents/roadmaps/road-to-done.md" not in adr.replace(
        "agents/roadmaps/archive/road-to-done.md", "")


def test_open_roadmap_left_alone(tmp_path):
    repo = _init_repo(tmp_path)
    _write(repo, "agents/roadmaps/road-to-wip.md", _OPEN)
    _git(repo, "add", "-A")
    _git(repo, "commit", "-qm", "seed")

    res = _run_sweep(repo, "--all")
    assert res.returncode == 0
    assert (repo / "agents/roadmaps/road-to-wip.md").exists()
    assert not (repo / "agents/roadmaps/archive/road-to-wip.md").exists()


def test_changed_only_skips_untouched_complete_roadmap(tmp_path):
    repo = _init_repo(tmp_path)
    # Complete roadmap committed on the base branch (not in this branch's diff).
    _write(repo, "agents/roadmaps/road-to-old.md", _COMPLETE)
    _git(repo, "add", "-A")
    _git(repo, "commit", "-qm", "base")
    _git(repo, "branch", "-M", "main")
    # Simulate origin/main pointing at the base commit.
    _git(repo, "update-ref", "refs/remotes/origin/main", "HEAD")
    # New branch with an unrelated change.
    _git(repo, "checkout", "-qb", "feature")
    _write(repo, "README.md", "unrelated\n")
    _git(repo, "add", "-A")
    _git(repo, "commit", "-qm", "unrelated")

    res = _run_sweep(repo)  # default --changed-only, base origin/main
    assert res.returncode == 0, res.stderr
    # road-to-old completed on base, not touched on this branch → NOT archived.
    assert (repo / "agents/roadmaps/road-to-old.md").exists()
