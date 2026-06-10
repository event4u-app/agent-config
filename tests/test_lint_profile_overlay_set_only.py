"""Goldens for the set-only overlay guard (Phase 3,
road-to-session-profile-observability).

The lint freezes two clauses: aliases resolve only to pack-id sets, and no
static profile/pack definition injects a scalar audience hint or a precedence
key into the overlay. These pin the live tree passing today plus the negative
detectors (the regression the guard exists to catch).
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

_SPEC = importlib.util.spec_from_file_location(
    "lint_profile_overlay_set_only",
    Path(__file__).resolve().parent.parent / "src/scripts/lint_profile_overlay_set_only.py",
)
m = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(m)


def test_live_tree_passes():
    # The shipped session-profiles + profile/pack defs honour the invariant.
    assert m.lint(quiet=True) == 0


def test_scalar_active_packs_detected():
    assert m._find_scalar_active_packs({"runtime": {"active_packs": "developer"}}) is True
    assert m._find_scalar_active_packs({"runtime": {"active_packs": {"id": "x"}}}) is True


def test_list_active_packs_is_fine():
    assert m._find_scalar_active_packs({"runtime": {"active_packs": ["a", "b"]}}) is False
    assert m._find_scalar_active_packs({"profile": {"packs": ["a"]}}) is False


def test_precedence_key_detected():
    keys = set(m._walk_keys({"profile": {"packs": ["a"], "priority": 1}}))
    assert keys & m.PRECEDENCE_KEYS == {"priority"}
    for k in ("precedence", "order", "rank", "weight"):
        assert k in m.PRECEDENCE_KEYS


def test_no_precedence_key_clean():
    keys = set(m._walk_keys({"profile": {"packs": ["a"], "audience": {"label": "x"}}}))
    assert not (keys & m.PRECEDENCE_KEYS)


def test_pack_universe_nonempty():
    # The pack vocab must load — otherwise alias→pack cross-refs silently skip.
    assert len(m._pack_universe()) > 0
