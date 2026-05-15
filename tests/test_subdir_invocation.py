"""Subdir invocation hardening — Step 7 Phase 3, Phase 5 test gate.

Exercises :func:`resolve_project_root` from deep subdirectories and via
``AGENT_CONFIG_PROJECT_ROOT`` to confirm subdir-invoked commands resolve
to the canonical project root. Mirrors the wrapper contract:
``./agent-config`` exports ``AGENT_CONFIG_PROJECT_ROOT=$SELF_DIR`` so
child commands skip the anchor walk entirely.
"""
from __future__ import annotations

import os
from pathlib import Path

import pytest

from scripts._lib.agent_settings import (
    ORIGIN_CWD_FALLBACK,
    ORIGIN_ENV,
    ORIGIN_EXPLICIT,
    PROJECT_ROOT_ENV,
    resolve_project_root,
)


@pytest.fixture(autouse=True)
def _clear_env(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv(PROJECT_ROOT_ENV, raising=False)
    monkeypatch.delenv("AGENT_CONFIG_LEGACY_ANCHOR", raising=False)


def _anchor(root: Path) -> None:
    (root / ".git").mkdir()


def test_subdir_invocation_resolves_to_anchor_root(tmp_path: Path) -> None:
    """A deeply-nested cwd walks back to the anchored root."""
    root = tmp_path / "proj"
    deep = root / "a" / "b" / "c" / "d"
    deep.mkdir(parents=True)
    _anchor(root)

    resolved, origin = resolve_project_root(None, cwd=deep)
    assert resolved == root.resolve()
    assert origin == "git"


def test_env_var_overrides_anchor_walk(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """``AGENT_CONFIG_PROJECT_ROOT`` short-circuits the walk (wrapper contract)."""
    root = tmp_path / "proj"
    intermediate = root / "nested-proj"
    deep = intermediate / "subdir"
    deep.mkdir(parents=True)
    _anchor(root)
    _anchor(intermediate)  # stray anchor that would win without the env pin

    monkeypatch.setenv(PROJECT_ROOT_ENV, str(root))
    resolved, origin = resolve_project_root(None, cwd=deep)
    assert resolved == root.resolve()
    assert origin == ORIGIN_ENV


def test_explicit_arg_overrides_env(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """``--project`` flag beats env var and anchor walk."""
    root = tmp_path / "proj"
    other = tmp_path / "other"
    root.mkdir()
    other.mkdir()
    _anchor(root)
    _anchor(other)

    monkeypatch.setenv(PROJECT_ROOT_ENV, str(other))
    resolved, origin = resolve_project_root(str(root), cwd=other)
    assert resolved == root.resolve()
    assert origin == ORIGIN_EXPLICIT


def test_no_anchor_falls_back_to_cwd(tmp_path: Path) -> None:
    """Empty-tree subdir invocations return ``cwd`` with the fallback origin."""
    deep = tmp_path / "no_anchor_anywhere" / "a" / "b"
    deep.mkdir(parents=True)
    resolved, origin = resolve_project_root(None, cwd=deep)
    assert resolved == deep.resolve()
    assert origin == ORIGIN_CWD_FALLBACK


def test_wrapper_pinned_root_survives_chdir(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Once the wrapper exports the env var, ``os.chdir`` does not move the root.

    Mirrors the production scenario: ``./agent-config`` is invoked from
    ``<root>/services/api`` → wrapper exports ``AGENT_CONFIG_PROJECT_ROOT=<root>``
    → master CLI's ``os.getcwd()`` returns ``services/api`` but the
    resolver still returns ``<root>``.
    """
    root = tmp_path / "proj"
    deep = root / "services" / "api"
    deep.mkdir(parents=True)
    _anchor(root)
    monkeypatch.setenv(PROJECT_ROOT_ENV, str(root))
    monkeypatch.chdir(deep)

    resolved, origin = resolve_project_root(None)
    assert resolved == root.resolve()
    assert origin == ORIGIN_ENV
    # Confirm cwd was indeed deep when we resolved.
    assert Path(os.getcwd()).resolve() == deep.resolve()
