"""Two-branch merge fixture — proves that parallel intake JSONL appends
merge cleanly under `merge=union`.

Covers Phase 0 of `road-to-memory-merge-safety.md`.
"""

from __future__ import annotations

import shutil
import subprocess as sp
from pathlib import Path

import pytest

FIXTURES = Path("tests/fixtures/memory-merge")


def _git(cwd: Path, *args: str) -> sp.CompletedProcess:
    return sp.run(["git", *args], cwd=cwd, check=True,
                  capture_output=True, text=True)


def _init(cwd: Path) -> None:
    _git(cwd, "init", "-q", "-b", "main")
    _git(cwd, "config", "user.email", "t@e.x")
    _git(cwd, "config", "user.name", "t")
    _git(cwd, "config", "commit.gpgsign", "false")
    _git(cwd, "config", "merge.union.name", "union-merge")
    # `git merge-file --union` is built in; declare the driver binding.
    _git(cwd, "config", "merge.union.driver",
         "git merge-file --union %A %O %B")


def test_parallel_intake_appends_merge_clean(tmp_path):
    repo = tmp_path / "repo"
    repo.mkdir()
    _init(repo)

    # Configure merge=union for the intake glob.
    intake_dir = repo / "agents" / "memory" / "intake"
    intake_dir.mkdir(parents=True)
    (repo / ".gitattributes").write_text(
        "agents/memory/intake/*.jsonl merge=union eol=lf\n",
    )

    # Seed the repo with the base fixture.
    shutil.copy(FIXTURES / "base.jsonl", intake_dir / "learnings.jsonl")
    _git(repo, "add", "-A")
    _git(repo, "commit", "-q", "-m", "base")

    # Branch A: apply branch-a.jsonl on top of base.
    _git(repo, "checkout", "-q", "-b", "branch-a")
    shutil.copy(FIXTURES / "branch-a.jsonl", intake_dir / "learnings.jsonl")
    _git(repo, "commit", "-q", "-am", "branch-a append")

    # Branch B: start from main, apply branch-b.jsonl.
    _git(repo, "checkout", "-q", "main")
    _git(repo, "checkout", "-q", "-b", "branch-b")
    shutil.copy(FIXTURES / "branch-b.jsonl", intake_dir / "learnings.jsonl")
    _git(repo, "commit", "-q", "-am", "branch-b append")

    # Merge A into B. Must succeed with no conflict markers.
    result = sp.run(
        ["git", "merge", "--no-edit", "branch-a"],
        cwd=repo, capture_output=True, text=True,
    )
    merged = (intake_dir / "learnings.jsonl").read_text()
    assert result.returncode == 0, result.stdout + result.stderr
    assert "<<<<<<<" not in merged, "union merge produced conflict markers"

    # Every line from both branches must survive. Order is not guaranteed
    # by `merge=union`; we only assert set membership.
    merged_ids = {line for line in merged.splitlines() if line.strip()}
    base = set((FIXTURES / "base.jsonl").read_text().splitlines())
    a = set((FIXTURES / "branch-a.jsonl").read_text().splitlines()) - base
    b = set((FIXTURES / "branch-b.jsonl").read_text().splitlines()) - base
    assert base <= merged_ids
    assert a <= merged_ids
    assert b <= merged_ids



def test_content_addressed_same_entry_converges(tmp_path):
    """Phase 2 property: same entry promoted on two branches = one file."""
    repo = tmp_path / "repo"
    repo.mkdir()
    _init(repo)
    promo_dir = repo / "agents" / "memory" / "domain-invariants"
    promo_dir.mkdir(parents=True)
    (repo / "seed.txt").write_text("seed")
    _git(repo, "add", "-A")
    _git(repo, "commit", "-q", "-m", "seed")

    entry_yaml = (
        "id: shared\nstatus: active\nrule: |\n  Tenant ids never cross.\n"
    )
    hash_yml = "a1b2c3d4e5f6.yml"  # any stable name

    _git(repo, "checkout", "-q", "-b", "branch-a")
    (promo_dir / hash_yml).write_text(entry_yaml)
    _git(repo, "add", "-A")
    _git(repo, "commit", "-q", "-m", "promote A")

    _git(repo, "checkout", "-q", "main")
    _git(repo, "checkout", "-q", "-b", "branch-b")
    promo_dir.mkdir(parents=True, exist_ok=True)
    (promo_dir / hash_yml).write_text(entry_yaml)  # identical content
    _git(repo, "add", "-A")
    _git(repo, "commit", "-q", "-m", "promote B")

    result = sp.run(
        ["git", "merge", "--no-edit", "branch-a"],
        cwd=repo, capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    merged = (promo_dir / hash_yml).read_text()
    assert "<<<<<<<" not in merged
    # Only one file exists; the content is unchanged.
    assert merged == entry_yaml
    files = sorted(p.name for p in promo_dir.iterdir())
    assert files == [hash_yml]


def test_content_addressed_different_entries_stay_separate(tmp_path):
    """Two different promotions → two files, no conflict."""
    repo = tmp_path / "repo"
    repo.mkdir()
    _init(repo)
    promo_dir = repo / "agents" / "memory" / "domain-invariants"
    promo_dir.mkdir(parents=True)
    (repo / "seed.txt").write_text("seed")
    _git(repo, "add", "-A")
    _git(repo, "commit", "-q", "-m", "seed")

    _git(repo, "checkout", "-q", "-b", "branch-a")
    (promo_dir / "aaa111bbb222.yml").write_text("id: one\n")
    _git(repo, "add", "-A")
    _git(repo, "commit", "-q", "-m", "A")

    _git(repo, "checkout", "-q", "main")
    _git(repo, "checkout", "-q", "-b", "branch-b")
    promo_dir.mkdir(parents=True, exist_ok=True)
    (promo_dir / "ccc333ddd444.yml").write_text("id: two\n")
    _git(repo, "add", "-A")
    _git(repo, "commit", "-q", "-m", "B")

    result = sp.run(
        ["git", "merge", "--no-edit", "branch-a"],
        cwd=repo, capture_output=True, text=True,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    files = sorted(p.name for p in promo_dir.iterdir())
    assert files == ["aaa111bbb222.yml", "ccc333ddd444.yml"]
