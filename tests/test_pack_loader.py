"""Pack loader resolver — 6.0.0-B Phase 3 Step 7.

Synthetic vocab/manifest so the unit is deterministic and independent of the
live discovery manifest.
"""
from __future__ import annotations

from pathlib import Path

from scripts.config import packs

VOCAB = {
    "engineering-base": {"always_on": False},
    "meta": {"always_on": True},
    "php": {"requires": ["engineering-base"]},
    "laravel": {"requires": ["php", "engineering-base"]},
    "finance-basic": {},
    "finance-advanced": {"requires": ["finance-basic"]},
    "soft": {"suggests": ["finance-basic"]},
}

MANIFEST = [
    {"category": "command", "path": "c/eng.md", "pack": "engineering-base", "packs": ["meta"]},
    {"category": "command", "path": "c/meta.md", "pack": "meta", "packs": ["meta"]},
    {"category": "command", "path": "c/fin.md", "pack": "finance-basic", "packs": ["meta"]},
    {"category": "skill", "path": "s/eng.md", "packs": ["engineering-base"]},
    {"category": "skill", "path": "s/fin.md", "packs": ["finance-basic", "meta"]},
    {"category": "rule", "path": "r/router.md", "packs": ["meta"]},
]


# --- resolve_active_packs (pure) -------------------------------------------

def test_always_on_seeded_even_when_not_selected():
    assert "meta" in packs.resolve_active_packs(VOCAB, [])


def test_requires_closure_expands_transitively():
    got = set(packs.resolve_active_packs(VOCAB, ["laravel"]))
    assert got == {"laravel", "php", "engineering-base", "meta"}


def test_suggests_is_not_expanded():
    # `soft` suggests finance-basic; suggests must not pull it in.
    got = set(packs.resolve_active_packs(VOCAB, ["soft"]))
    assert "finance-basic" not in got
    assert {"soft", "meta"} <= got


def test_legacy_all_returns_entire_vocabulary():
    assert set(packs.resolve_active_packs(VOCAB, [], legacy_all=True)) == set(VOCAB)


def test_unknown_pack_dropped_defensively():
    # A typo'd pack must not crash; only always-on survives.
    assert packs.resolve_active_packs(VOCAB, ["nonexistent"]) == sorted(packs.always_on_packs(VOCAB))


# --- resolve_active_set (manifest-backed, monkeypatched) -------------------

def _patch(monkeypatch):
    monkeypatch.setattr(packs, "load_packs_vocab", lambda r: VOCAB)
    monkeypatch.setattr(packs, "load_manifest", lambda r: MANIFEST)


def test_scoped_includes_active_owner_and_always_on(monkeypatch):
    _patch(monkeypatch)
    s = packs.resolve_active_set(Path("."), ["finance-basic"])
    assert set(s.packs) == {"finance-basic", "meta"}
    assert "c/meta.md" in s.commands       # meta owner — always-on
    assert "c/fin.md" in s.commands        # finance-basic owner — active
    assert "c/eng.md" not in s.commands    # engineering-base owner — inactive
    assert "s/fin.md" in s.skills          # packs ∩ active
    assert "s/eng.md" not in s.skills      # only inactive pack


def test_rules_never_projected(monkeypatch):
    _patch(monkeypatch)
    s = packs.resolve_active_set(Path("."), ["finance-basic"], legacy_all=False)
    everything = s.commands + s.skills
    assert all(not p.startswith("r/") for p in everything)


def test_legacy_all_projects_all_commands_and_skills(monkeypatch):
    _patch(monkeypatch)
    s = packs.resolve_active_set(Path("."), [], legacy_all=True)
    assert len(s.commands) == 3
    assert len(s.skills) == 2
    assert all(not p.startswith("r/") for p in s.commands + s.skills)


def test_command_membership_is_owner_based_not_discovery(monkeypatch):
    _patch(monkeypatch)
    # c/eng.md has discovery packs=[meta] (always-on) but owner=engineering-base.
    # Under a scope without engineering-base it MUST be absent — proving the
    # resolver keys commands on the owner, not the discovery tag.
    s = packs.resolve_active_set(Path("."), [])  # only meta
    assert "c/eng.md" not in s.commands
    assert "c/meta.md" in s.commands
