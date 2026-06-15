"""Tests for scripts/generate_cookbook.py (road-to-competitive-borrow P1.4)."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location(
    "generate_cookbook",
    REPO_ROOT / "src" / "scripts" / "generate_cookbook.py",
)
assert SPEC and SPEC.loader
gc = importlib.util.module_from_spec(SPEC)
sys.modules["generate_cookbook"] = gc
SPEC.loader.exec_module(gc)


def test_repo_baseline_renders_and_check_passes():
    """Every seed + flow ref resolves; the committed cookbook is up to date."""
    content = gc.render()
    assert content.startswith("# Cookbook")
    assert gc.OUT.read_text(encoding="utf-8") == content, (
        "docs/cookbook.md is stale — run `python3 scripts/generate_cookbook.py`"
    )


def test_bad_command_ref_fails_generation():
    """The anti-cargo-cult guard: a recipe naming a missing command must fail."""
    with pytest.raises(gc.BadRecipe):
        gc.validate_refs("bad", ["this-command-does-not-exist"], [])


def test_bad_skill_ref_fails_generation():
    with pytest.raises(gc.BadRecipe):
        gc.validate_refs("bad", [], ["this-skill-does-not-exist"])


def test_every_seed_recipe_has_real_refs():
    for r in gc.load_seed():
        gc.validate_refs(r["title"], r.get("commands", []), r.get("skills", []))
