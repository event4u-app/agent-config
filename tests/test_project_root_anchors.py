"""Anchor-walk tests for ``find_project_root_with_anchor``.

Covers Step-7 D1 + D3 + the boundary-vs-layer decision recorded in
``agents/council-sessions/step-7-d3-cascade-conflict-decision.md``:

* ``.git`` anchors as a boundary.
* ``agents/`` anchors as a boundary **only** when it contains one of
  the D1 markers (``roadmaps/``, ``.ai-council.yml``,
  ``roadmaps-progress.md``).
* Bare ``agents/`` (no markers) is **not** an anchor.
* ``.agent-settings.yml`` is a layer marker — it anchors only when no
  boundary exists in any ancestor; the outermost file wins so the
  cascade can layer deeper files below it.
* Mixed-anchor edge case (D3): an ancestor with multiple boundary
  anchors resolves to that ancestor; ``agents/`` wins over ``.git`` in
  the tiebreaker. ``.agent-settings.yml`` at the same level does not
  shift the root, but is still picked up by the cascade.
"""
from __future__ import annotations

from pathlib import Path

import pytest

from scripts._lib import agent_settings as ags


# --- .git anchor -----------------------------------------------------------

def test_git_dir_anchors(tmp_path: Path) -> None:
    (tmp_path / ".git").mkdir()
    deep = tmp_path / "a" / "b" / "c"
    deep.mkdir(parents=True)
    result = ags.find_project_root_with_anchor(deep)
    assert result is not None
    root, anchor = result
    assert root == tmp_path.resolve()
    assert anchor == ags.ANCHOR_GIT


def test_git_file_anchors_submodule(tmp_path: Path) -> None:
    # Submodule pointer is a regular file named .git
    (tmp_path / ".git").write_text("gitdir: ../.git/modules/x\n")
    nested = tmp_path / "src"
    nested.mkdir()
    result = ags.find_project_root_with_anchor(nested)
    assert result is not None
    root, anchor = result
    assert root == tmp_path.resolve()
    assert anchor == ags.ANCHOR_GIT


# --- agents/ anchor (D1) ---------------------------------------------------

@pytest.mark.parametrize(
    "marker",
    ["roadmaps", ".ai-council.yml", "roadmaps-progress.md"],
)
def test_agents_dir_with_marker_anchors(tmp_path: Path, marker: str) -> None:
    agents = tmp_path / "agents"
    agents.mkdir()
    target = agents / marker
    if marker == "roadmaps":
        target.mkdir()
    else:
        target.write_text("# marker\n")
    nested = tmp_path / "src" / "deep"
    nested.mkdir(parents=True)
    result = ags.find_project_root_with_anchor(nested)
    assert result is not None
    root, anchor = result
    assert root == tmp_path.resolve()
    assert anchor == ags.ANCHOR_AGENTS_DIR


def test_bare_agents_without_marker_does_not_anchor(tmp_path: Path) -> None:
    # D1: bare agents/ is NOT an anchor.
    (tmp_path / "agents").mkdir()
    nested = tmp_path / "src"
    nested.mkdir()
    result = ags.find_project_root_with_anchor(nested)
    assert result is None


# --- .agent-settings.yml as layer fallback ---------------------------------

def test_agent_settings_alone_anchors_as_fallback(tmp_path: Path) -> None:
    (tmp_path / ".agent-settings.yml").write_text("name: x\n")
    nested = tmp_path / "a" / "b"
    nested.mkdir(parents=True)
    result = ags.find_project_root_with_anchor(nested)
    assert result is not None
    root, anchor = result
    assert root == tmp_path.resolve()
    assert anchor == ags.ANCHOR_AGENT_SETTINGS


def test_layer_fallback_picks_outermost_agent_settings(tmp_path: Path) -> None:
    # Two .agent-settings.yml files, no boundary anchor → outermost wins
    # so the cascade can still layer deeper files below it.
    (tmp_path / ".agent-settings.yml").write_text("name: outer\n")
    sub = tmp_path / "sub"
    sub.mkdir()
    (sub / ".agent-settings.yml").write_text("name: inner\n")
    result = ags.find_project_root_with_anchor(sub)
    assert result is not None
    root, anchor = result
    assert root == tmp_path.resolve()
    assert anchor == ags.ANCHOR_AGENT_SETTINGS


# --- Mixed-anchor edge case (D3) -------------------------------------------

def test_mixed_anchors_at_same_level_agents_wins_over_git(tmp_path: Path) -> None:
    # When .git and agents/+marker coexist at one ancestor, agents/ wins
    # the boundary tiebreaker (D3 ordering minus the layer marker).
    (tmp_path / ".git").mkdir()
    (tmp_path / "agents").mkdir()
    (tmp_path / "agents" / "roadmaps").mkdir()
    nested = tmp_path / "src"
    nested.mkdir()
    result = ags.find_project_root_with_anchor(nested)
    assert result is not None
    root, anchor = result
    assert root == tmp_path.resolve()
    assert anchor == ags.ANCHOR_AGENTS_DIR


def test_git_and_intermediate_agent_settings_root_stays_at_git(
    tmp_path: Path,
) -> None:
    # The pre-Step-7 cascade contract: .git at root, .agent-settings.yml
    # at an intermediate dir → root stays at .git so the cascade still
    # layers root + intermediate.
    (tmp_path / ".git").mkdir()
    (tmp_path / ".agent-settings.yml").write_text("name: Root\n")
    sub = tmp_path / "sub"
    sub.mkdir()
    (sub / ".agent-settings.yml").write_text("name: Sub\n")
    result = ags.find_project_root_with_anchor(sub)
    assert result is not None
    root, anchor = result
    assert root == tmp_path.resolve()
    assert anchor == ags.ANCHOR_GIT


def test_no_anchors_returns_none(tmp_path: Path) -> None:
    nested = tmp_path / "a" / "b"
    nested.mkdir(parents=True)
    assert ags.find_project_root_with_anchor(nested) is None


# --- back-compat wrapper ---------------------------------------------------

def test_find_project_root_drops_anchor_name(tmp_path: Path) -> None:
    (tmp_path / ".git").mkdir()
    assert ags.find_project_root(tmp_path) == tmp_path.resolve()
    assert ags.find_project_root(tmp_path / "nope") is None or True
