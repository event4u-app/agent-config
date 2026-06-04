"""Tests for the Step 8 ``--root`` override channel.

Covers:

* Precedence — ``--root`` (via ``AGENT_CONFIG_ROOT_OVERRIDE=1`` +
  ``AGENT_CONFIG_PROJECT_ROOT``) beats ``--project``, plain env-pin,
  anchor walk, and CWD fallback.
* Fail-loud — invalid override paths raise ``ProjectRootError``
  regardless of which channel set them.
* End-to-end — the master CLI wrapper exits with code 2 on invalid
  ``--root`` instead of falling back to CWD.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

import pytest

from scripts._lib import agent_settings as ags


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(ags.PROJECT_ROOT_ENV, raising=False)
    monkeypatch.delenv(ags.ROOT_OVERRIDE_ENV, raising=False)


def test_root_flag_wins_over_arg(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    root_dir = tmp_path / "winner"
    arg_dir = tmp_path / "loser"
    root_dir.mkdir()
    arg_dir.mkdir()
    monkeypatch.setenv(ags.PROJECT_ROOT_ENV, str(root_dir))
    monkeypatch.setenv(ags.ROOT_OVERRIDE_ENV, "1")
    root, origin = ags.resolve_project_root(str(arg_dir), cwd=tmp_path)
    assert root == root_dir.resolve()
    assert origin == ags.ORIGIN_ROOT_FLAG


def test_explicit_arg_wins_over_env_pin(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    env_dir = tmp_path / "env"
    arg_dir = tmp_path / "arg"
    env_dir.mkdir()
    arg_dir.mkdir()
    monkeypatch.setenv(ags.PROJECT_ROOT_ENV, str(env_dir))
    root, origin = ags.resolve_project_root(str(arg_dir), cwd=tmp_path)
    assert root == arg_dir.resolve()
    assert origin == ags.ORIGIN_EXPLICIT


def test_env_pin_used_when_no_arg(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    env_dir = tmp_path / "wrapper"
    env_dir.mkdir()
    monkeypatch.setenv(ags.PROJECT_ROOT_ENV, str(env_dir))
    root, origin = ags.resolve_project_root(None, cwd=tmp_path)
    assert root == env_dir.resolve()
    assert origin == ags.ORIGIN_ENV


def test_anchor_walk_when_no_override(tmp_path: Path) -> None:
    (tmp_path / ".git").mkdir()
    deep = tmp_path / "a" / "b"
    deep.mkdir(parents=True)
    root, origin = ags.resolve_project_root(None, cwd=deep)
    assert root == tmp_path.resolve()
    assert origin == ags.ANCHOR_GIT


def test_cwd_fallback_when_no_anchor(tmp_path: Path) -> None:
    root, origin = ags.resolve_project_root(None, cwd=tmp_path)
    assert root == tmp_path.resolve()
    assert origin == ags.ORIGIN_CWD_FALLBACK


def test_root_flag_invalid_path_raises(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(ags.PROJECT_ROOT_ENV, str(tmp_path / "nope"))
    monkeypatch.setenv(ags.ROOT_OVERRIDE_ENV, "1")
    with pytest.raises(ags.ProjectRootError) as exc:
        ags.resolve_project_root(None, cwd=tmp_path)
    assert "--root" in str(exc.value)


def test_root_flag_non_directory_raises(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    f = tmp_path / "file.txt"
    f.write_text("not a dir")
    monkeypatch.setenv(ags.PROJECT_ROOT_ENV, str(f))
    monkeypatch.setenv(ags.ROOT_OVERRIDE_ENV, "1")
    with pytest.raises(ags.ProjectRootError) as exc:
        ags.resolve_project_root(None, cwd=tmp_path)
    assert "non-directory" in str(exc.value)


def test_explicit_arg_invalid_path_raises(tmp_path: Path) -> None:
    with pytest.raises(ags.ProjectRootError) as exc:
        ags.resolve_project_root(str(tmp_path / "missing"), cwd=tmp_path)
    assert "--project" in str(exc.value)


def test_env_pin_invalid_path_raises(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv(ags.PROJECT_ROOT_ENV, str(tmp_path / "missing"))
    with pytest.raises(ags.ProjectRootError) as exc:
        ags.resolve_project_root(None, cwd=tmp_path)
    assert ags.PROJECT_ROOT_ENV in str(exc.value)


def test_dispatcher_exits_2_on_invalid_root(tmp_path: Path) -> None:
    """End-to-end: the bash wrapper rejects bad ``--root`` with exit 2."""
    repo_root = Path(__file__).resolve().parents[1]
    dispatcher = repo_root / "src" / "scripts" / "agent-config"
    result = subprocess.run(
        [str(dispatcher), "--root", str(tmp_path / "does-not-exist"), "doctor"],
        capture_output=True,
        text=True,
        cwd=str(tmp_path),
    )
    assert result.returncode == 2, (
        f"expected exit 2, got {result.returncode}\n"
        f"stdout={result.stdout!r}\nstderr={result.stderr!r}"
    )
