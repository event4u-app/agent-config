"""Kill-switch tests for ``AGENT_CONFIG_LEGACY_ANCHOR`` (Step-7 D5).

When the env var is set to ``"1"``, :func:`find_project_root_with_anchor`
reverts to the pre-Step-7 ``.git``-only walk. Provides the
one-minor-version soak escape hatch documented in
``docs/installation.md`` (Phase 4).
"""
from __future__ import annotations

import os
from collections.abc import Iterator
from pathlib import Path

import pytest

from scripts._lib import agent_settings as ags

_ENV = "AGENT_CONFIG_LEGACY_ANCHOR"


@pytest.fixture
def legacy_anchor() -> Iterator[None]:
    """Set the kill-switch for the duration of the test."""
    prev = os.environ.get(_ENV)
    os.environ[_ENV] = "1"
    try:
        yield
    finally:
        if prev is None:
            os.environ.pop(_ENV, None)
        else:
            os.environ[_ENV] = prev


def test_kill_switch_recognises_git_anchor(
    tmp_path: Path, legacy_anchor: None,
) -> None:
    (tmp_path / ".git").mkdir()
    nested = tmp_path / "src"
    nested.mkdir()
    result = ags.find_project_root_with_anchor(nested)
    assert result is not None
    root, anchor = result
    assert root == tmp_path.resolve()
    assert anchor == ags.ANCHOR_GIT


def test_kill_switch_ignores_agents_dir_anchor(
    tmp_path: Path, legacy_anchor: None,
) -> None:
    # agents/ with markers should anchor by default, but the kill-switch
    # reverts to .git-only.
    (tmp_path / "agents").mkdir()
    (tmp_path / "agents" / "roadmaps").mkdir()
    nested = tmp_path / "src"
    nested.mkdir()
    assert ags.find_project_root_with_anchor(nested) is None


def test_kill_switch_ignores_agent_settings_anchor(
    tmp_path: Path, legacy_anchor: None,
) -> None:
    (tmp_path / ".agent-settings.yml").write_text("name: x\n")
    nested = tmp_path / "src"
    nested.mkdir()
    assert ags.find_project_root_with_anchor(nested) is None


def test_kill_switch_default_disabled(tmp_path: Path) -> None:
    # Sanity: without the env var, the new behaviour applies.
    assert os.environ.get(_ENV) != "1"
    (tmp_path / "agents").mkdir()
    (tmp_path / "agents" / "roadmaps").mkdir()
    nested = tmp_path / "src"
    nested.mkdir()
    result = ags.find_project_root_with_anchor(nested)
    assert result is not None
    assert result[1] == ags.ANCHOR_AGENTS_DIR
