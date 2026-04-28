"""Pytest entry for the Golden Transcript replay harness.

Replays each captured GT scenario against the live ``work_engine`` and
asserts no structural drift versus the locked baseline. The actual
comparison logic lives in :mod:`tests.golden.harness`.
"""
from __future__ import annotations

import pytest

from . import harness


@pytest.mark.parametrize("gt_id", harness.all_gt_ids())
def test_golden_replay(gt_id: str) -> None:
    """Each Golden Transcript replays without structural drift."""
    _, _, diffs = harness.replay_and_compare(gt_id)
    if diffs:
        rendered = "\n".join(f"  {d}" for d in diffs)
        pytest.fail(
            f"\n{gt_id} drifted from locked baseline ({len(diffs)} diff(s)):\n{rendered}",
            pytrace=False,
        )
