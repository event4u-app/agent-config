"""Pytest entry for the Golden Transcript replay harness.

Replays each captured GT scenario against the live ``work_engine`` and
asserts no structural drift versus the locked baseline. The actual
comparison logic lives in :mod:`tests.golden.harness`.

A representative subset is tagged with ``@pytest.mark.smoke`` so PR
CI can run ``pytest -m smoke`` for sub-second feedback while the full
matrix runs nightly + on engine-path PRs (see ``freeze-guard.yml``).
"""
from __future__ import annotations

import pytest

from . import harness

# Smoke subset — one representative per recipe family, picked to cover
# the four comparators (exit codes, state, halt markers, delivery
# report) without paying the full 25-scenario cost on every PR:
#
#   GT-1   — R1 ticket happy path
#   GT-2   — R1 ambiguity halt (questions/numbered options)
#   GT-P1  — R2 prompt high-confidence
#   GT-U1  — UI build-track happy
#   GT-U10 — UI greenfield-bare (resume + state)
#   GT-U15 — UI preview-fail (failure path + delivery report)
#
# Full coverage runs in the nightly freeze-guard workflow and on any
# PR that touches ``scripts/work_engine/**`` or the baseline itself.
SMOKE_GT_IDS = frozenset({"GT-1", "GT-2", "GT-P1", "GT-U1", "GT-U10", "GT-U15"})


def _params() -> list:
    out = []
    for gt_id in harness.all_gt_ids():
        marks = [pytest.mark.smoke] if gt_id in SMOKE_GT_IDS else []
        out.append(pytest.param(gt_id, id=gt_id, marks=marks))
    return out


@pytest.mark.parametrize("gt_id", _params())
def test_golden_replay(gt_id: str) -> None:
    """Each Golden Transcript replays without structural drift."""
    _, _, diffs = harness.replay_and_compare(gt_id)
    if diffs:
        rendered = "\n".join(f"  {d}" for d in diffs)
        pytest.fail(
            f"\n{gt_id} drifted from locked baseline ({len(diffs)} diff(s)):\n{rendered}",
            pytrace=False,
        )
