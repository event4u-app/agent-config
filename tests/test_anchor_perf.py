"""Performance budget for the anchor walk (Step-7 D6).

The walk is O(depth) with at most ``1 + len(_AGENTS_DIR_MARKERS)``
``Path.exists()`` probes per level. Soft budget: < 5 ms at depth 20.

This test only fails on a true regression — the budget here is wide
enough to absorb CI noise. A 100× safety factor over a plausible warm
run; if it ever fails, something structural broke.
"""
from __future__ import annotations

import time
from pathlib import Path

from scripts._lib import agent_settings as ags

_DEPTH = 20
_BUDGET_SECONDS = 0.005  # 5 ms


def _deep_chain(root: Path, depth: int) -> Path:
    cursor = root
    for i in range(depth):
        cursor = cursor / f"lvl{i}"
    cursor.mkdir(parents=True)
    return cursor


def test_walk_under_budget_no_anchor(tmp_path: Path) -> None:
    leaf = _deep_chain(tmp_path, _DEPTH)
    # No anchor anywhere — worst case, walk reaches fs root.
    start = time.perf_counter()
    ags.find_project_root_with_anchor(leaf)
    elapsed = time.perf_counter() - start
    assert elapsed < _BUDGET_SECONDS * 10, (
        f"walk took {elapsed * 1000:.2f} ms at depth {_DEPTH}; "
        f"budget {_BUDGET_SECONDS * 10 * 1000:.0f} ms"
    )


def test_walk_under_budget_with_git_root(tmp_path: Path) -> None:
    (tmp_path / ".git").mkdir()
    leaf = _deep_chain(tmp_path, _DEPTH)
    start = time.perf_counter()
    result = ags.find_project_root_with_anchor(leaf)
    elapsed = time.perf_counter() - start
    assert result is not None
    assert elapsed < _BUDGET_SECONDS * 10, (
        f"walk took {elapsed * 1000:.2f} ms at depth {_DEPTH}; "
        f"budget {_BUDGET_SECONDS * 10 * 1000:.0f} ms"
    )


def test_walk_under_budget_agents_marker_root(tmp_path: Path) -> None:
    (tmp_path / "agents").mkdir()
    (tmp_path / "agents" / "roadmaps").mkdir()
    leaf = _deep_chain(tmp_path, _DEPTH)
    start = time.perf_counter()
    result = ags.find_project_root_with_anchor(leaf)
    elapsed = time.perf_counter() - start
    assert result is not None
    assert elapsed < _BUDGET_SECONDS * 10, (
        f"walk took {elapsed * 1000:.2f} ms at depth {_DEPTH}; "
        f"budget {_BUDGET_SECONDS * 10 * 1000:.0f} ms"
    )
