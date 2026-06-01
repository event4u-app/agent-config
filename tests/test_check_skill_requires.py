"""Tests for scripts/check_skill_requires.py (R1 — co-availability gate).

The gate validates the `requires_skills` skill→skill composition graph:
(1) referential integrity — every target names a real skill; (2)
co-availability — a sub-skill ships wherever its parent ships. `main()`
scans the live suite, so these tests drive the real `main()` logic with
fixtures by monkeypatching its two collectors.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location(
    "check_skill_requires",
    ROOT / "scripts" / "check_skill_requires.py",
)
assert SPEC and SPEC.loader
mod = importlib.util.module_from_spec(SPEC)
sys.modules["check_skill_requires"] = mod
SPEC.loader.exec_module(mod)


def _drive(monkeypatch, skills, closure=None):
    monkeypatch.setattr(mod, "_collect_skills", lambda: skills)
    monkeypatch.setattr(mod, "_load_pack_closure", lambda: closure or {})
    return mod.main()


def _skill(packs=(), requires=(), path="skills/x/SKILL.md"):
    return {"packs": set(packs), "requires_skills": list(requires), "path": path}


# --- accept: all edges resolve and are co-available ------------------------

def test_accepts_resolved_always_on_edges(monkeypatch, capsys):
    skills = {
        "parent": _skill(requires=["child"], path="skills/parent/SKILL.md"),
        "child": _skill(),  # always-on sub-skill — reachable from anywhere
    }
    assert _drive(monkeypatch, skills) == 0
    assert "all sub-skills co-available" in capsys.readouterr().out


def test_accepts_same_pack_edge(monkeypatch):
    skills = {
        "parent": _skill(packs=["pack-x"], requires=["child"], path="skills/parent/SKILL.md"),
        "child": _skill(packs=["pack-x"]),
    }
    assert _drive(monkeypatch, skills, closure={"pack-x": {"pack-x"}}) == 0


# --- reject: a requires_skills target that does not exist ------------------

def test_rejects_missing_skill_and_names_it(monkeypatch, capsys):
    skills = {
        "parent": _skill(requires=["ghost"], path="skills/parent/SKILL.md"),
    }
    rc = _drive(monkeypatch, skills)
    out = capsys.readouterr().out
    assert rc == 1
    assert "ghost" in out
    assert "unknown skill" in out


# --- handle: a skill with no requires_skills is a no-op --------------------

def test_no_requires_skills_is_clean(monkeypatch):
    skills = {
        "lonely": _skill(path="skills/lonely/SKILL.md"),
        "also": _skill(packs=["pack-y"], path="skills/also/SKILL.md"),
    }
    assert _drive(monkeypatch, skills, closure={"pack-y": {"pack-y"}}) == 0


# --- reject: co-availability — always-on parent → pack-gated sub-skill -----

def test_rejects_always_on_parent_requiring_pack_gated_sub(monkeypatch, capsys):
    skills = {
        "parent": _skill(requires=["child"], path="skills/parent/SKILL.md"),  # always-on
        "child": _skill(packs=["pack-z"]),  # pack-gated
    }
    rc = _drive(monkeypatch, skills, closure={"pack-z": {"pack-z"}})
    out = capsys.readouterr().out
    assert rc == 1
    assert "pack-gated" in out
