"""Trigger-coverage CI gate (roadmap Phase 2.2).

Runs the deterministic MUST-LOAD floor (`scripts/trigger_coverage.py`)
against `dist/router.json` + `tests/eval/trigger-coverage.yaml`. Gates at
100%: a single case where a required rule does not fire blocks the merge.

This is the safety net that makes "a needed rule silently fails to fire"
impossible to ship — it must stay green before any auto-tier rule body is
demoted to a router-resolved pointer in Phase 3.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest
import yaml

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts import trigger_coverage as tc  # noqa: E402

_CORPUS = yaml.safe_load(tc.CORPUS.read_text(encoding="utf-8")) or []
_ROUTER = tc.load_router()


def test_corpus_nonempty_and_router_present():
    assert tc.ROUTER.is_file(), "dist/router.json must exist"
    assert len(_CORPUS) >= 20, "seed at least 20 adversarial coverage cases"


@pytest.mark.parametrize("case", _CORPUS, ids=[c["id"] for c in _CORPUS])
def test_required_rules_fire(case):
    fired = tc.fired_rules(case["prompt"], _ROUTER)
    missing = [r for r in case.get("expect", []) if r not in fired]
    assert not missing, (
        f"case {case['id']!r}: required rule(s) {missing} did not fire for "
        f"prompt {case['prompt']!r}. A trigger was removed or mis-tiered — "
        f"this rule would silently fail to surface."
    )


def test_kernel_always_fires():
    """Every kernel rule must fire for any prompt (always-on floor)."""
    fired = tc.fired_rules("an arbitrary unrelated prompt", _ROUTER)
    for kid in _ROUTER.get("kernel", []):
        assert kid in fired, f"kernel rule {kid} did not fire"
