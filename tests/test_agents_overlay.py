"""Tests for the ``scripts/_lib/agents_overlay`` cascade resolver.

Phase 1 of road-to-portable-runtime-and-update-check (P1.7). Covers
all branches of ``resolve_overlay``:

- no intermediate file (only repo-root layer)
- one intermediate file (root + sub layer)
- CWD file only (deepest is shallow / equal to repo-root)
- user-global ``overrides/`` resolves when no in-project layer carries it
- user-global ``contexts/`` / ``decisions/`` silently skipped
- full chain (CWD → intermediate → repo-root → user-global) — deepest wins
- submodule fixture (``.git`` is a file, not a directory)
- no-``.git`` fixture (walk hits filesystem root → ``None``)
- invalid ``kind`` raises ``ValueError``
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts._lib import agents_overlay as ao  # noqa: E402


# --- fixtures ---------------------------------------------------------------

def _init_git_dir(repo_root: Path) -> None:
    (repo_root / ".git").mkdir()


def _init_git_file(repo_root: Path) -> None:
    (repo_root / ".git").write_text("gitdir: ../.git/modules/sub\n", encoding="utf-8")


def _write_overlay(layer_dir: Path, kind: str, name: str, body: str = "x") -> Path:
    target = layer_dir / "agents" / kind / f"{name}.md"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(body, encoding="utf-8")
    return target


@pytest.fixture
def _isolated_user_global(monkeypatch, tmp_path):
    """Redirect ``USER_GLOBAL_AGENTS_DIR`` to a tmp path for the test."""
    fake_home = tmp_path / "_fake_home"
    fake_global = fake_home / ".config" / "agent-config" / "agents"
    monkeypatch.setattr(ao, "USER_GLOBAL_AGENTS_DIR", fake_global)
    return fake_global


# --- contract / kind guard --------------------------------------------------

def test_invalid_kind_raises(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="not cascade-eligible"):
        ao.resolve_overlay("foo", "roadmaps", tmp_path)


def test_invalid_kind_state_raises(tmp_path: Path) -> None:
    with pytest.raises(ValueError):
        ao.resolve_overlay("anything", "state", tmp_path)


# --- in-project cascade -----------------------------------------------------

def test_no_intermediate_file_returns_none(tmp_path: Path, _isolated_user_global) -> None:
    _init_git_dir(tmp_path)
    deep = tmp_path / "a" / "b"
    deep.mkdir(parents=True)
    assert ao.resolve_overlay("missing", "contexts", deep) is None


def test_repo_root_only_resolves(tmp_path: Path, _isolated_user_global) -> None:
    _init_git_dir(tmp_path)
    target = _write_overlay(tmp_path, "contexts", "shared")
    deep = tmp_path / "a" / "b"
    deep.mkdir(parents=True)
    assert ao.resolve_overlay("shared", "contexts", deep) == target


def test_one_intermediate_layer_wins(tmp_path: Path, _isolated_user_global) -> None:
    _init_git_dir(tmp_path)
    _write_overlay(tmp_path, "contexts", "shared", body="root")
    mid = tmp_path / "mid"
    mid.mkdir()
    mid_target = _write_overlay(mid, "contexts", "shared", body="mid")
    deep = mid / "deep"
    deep.mkdir()
    resolved = ao.resolve_overlay("shared", "contexts", deep)
    assert resolved == mid_target
    assert resolved.read_text(encoding="utf-8") == "mid"


def test_cwd_file_wins_over_root(tmp_path: Path, _isolated_user_global) -> None:
    _init_git_dir(tmp_path)
    _write_overlay(tmp_path, "decisions", "adr-1", body="root")
    cwd = tmp_path / "deep"
    cwd.mkdir()
    cwd_target = _write_overlay(cwd, "decisions", "adr-1", body="cwd")
    resolved = ao.resolve_overlay("adr-1", "decisions", cwd)
    assert resolved == cwd_target
    assert resolved.read_text(encoding="utf-8") == "cwd"


# --- user-global asymmetry --------------------------------------------------

def test_user_global_overrides_resolves(tmp_path: Path, _isolated_user_global) -> None:
    _init_git_dir(tmp_path)
    target = _write_overlay(_isolated_user_global.parent, "overrides", "personal")
    deep = tmp_path / "sub"
    deep.mkdir()
    assert ao.resolve_overlay("personal", "overrides", deep) == target


def test_user_global_contexts_silently_skipped(tmp_path: Path, _isolated_user_global) -> None:
    _init_git_dir(tmp_path)
    # File exists at user-global level, but `contexts` is not whitelisted.
    _write_overlay(_isolated_user_global.parent, "contexts", "leaked")
    deep = tmp_path / "sub"
    deep.mkdir()
    assert ao.resolve_overlay("leaked", "contexts", deep) is None


def test_user_global_decisions_silently_skipped(tmp_path: Path, _isolated_user_global) -> None:
    _init_git_dir(tmp_path)
    _write_overlay(_isolated_user_global.parent, "decisions", "adr-leak")
    deep = tmp_path / "sub"
    deep.mkdir()
    assert ao.resolve_overlay("adr-leak", "decisions", deep) is None


def test_in_project_overrides_beats_user_global(tmp_path: Path, _isolated_user_global) -> None:
    _init_git_dir(tmp_path)
    _write_overlay(_isolated_user_global.parent, "overrides", "p", body="user")
    project_target = _write_overlay(tmp_path, "overrides", "p", body="project")
    deep = tmp_path / "sub"
    deep.mkdir()
    resolved = ao.resolve_overlay("p", "overrides", deep)
    assert resolved == project_target
    assert resolved.read_text(encoding="utf-8") == "project"


# --- submodule + no-.git edge cases ----------------------------------------

def test_submodule_git_file_works(tmp_path: Path, _isolated_user_global) -> None:
    _init_git_file(tmp_path)
    target = _write_overlay(tmp_path, "contexts", "sub")
    deep = tmp_path / "x"
    deep.mkdir()
    assert ao.resolve_overlay("sub", "contexts", deep) == target


def test_no_git_returns_none_for_contexts(tmp_path: Path, _isolated_user_global) -> None:
    deep = tmp_path / "no-git" / "deep"
    deep.mkdir(parents=True)
    # No .git anywhere → in-project chain skipped; contexts not user-global.
    assert ao.resolve_overlay("anything", "contexts", deep) is None
