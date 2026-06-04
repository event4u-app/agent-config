"""Tests for scripts/check_gate_paths.py (R2 — gate path-integrity)."""
from __future__ import annotations

import importlib.util
import sys
import types
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location(
    "check_gate_paths",
    ROOT / "src" / "scripts" / "check_gate_paths.py",
)
assert SPEC and SPEC.loader
mod = importlib.util.module_from_spec(SPEC)
sys.modules["check_gate_paths"] = mod
SPEC.loader.exec_module(mod)

CORE = mod.PACKAGE_CORE


# --- check_paths: the I/O-free assertion core ------------------------------

def test_passing_fixture_all_resolve():
    """Every target under packages/core/ that exists → no failures."""
    named = {"gate_ok": [CORE / ".agent-src.uncondensed"]}
    assert mod.check_paths(named) == []


def test_failing_fixture_outside_core(tmp_path):
    """A target outside packages/core/ → failure flagged 'not under'."""
    outside = tmp_path / "elsewhere" / "AGENTS.md"
    outside.parent.mkdir(parents=True)
    outside.write_text("x", encoding="utf-8")
    failures = mod.check_paths({"gate_drift": [outside]})
    assert len(failures) == 1
    gate, reason, path = failures[0]
    assert gate == "gate_drift"
    assert "not under packages/core/" in reason
    assert path == outside


def test_failing_fixture_missing_under_core():
    """A target under packages/core/ that does not exist → 'does not exist'."""
    missing = CORE / ".agent-src.uncondensed" / "does-not-exist-xyz"
    failures = mod.check_paths({"gate_gone": [missing]})
    assert len(failures) == 1
    gate, reason, _ = failures[0]
    assert gate == "gate_gone"
    assert "does not exist" in reason


def test_is_under_core_true_false(tmp_path):
    assert mod._is_under_core(CORE / "x") is True
    assert mod._is_under_core(tmp_path / "x") is False


# --- collect_gate_paths: introspection of real gates -----------------------

def test_collect_reads_real_gate_attributes():
    """The live gates expose non-empty GATE_CORE_PATHS and all resolve."""
    named = mod.collect_gate_paths(mod.GATES)
    assert set(named) == set(mod.GATES)
    assert all(named.values())  # every gate has at least one path
    assert mod.check_paths(named) == []  # live tree passes


def test_collect_raises_without_attribute():
    """A gate module lacking GATE_CORE_PATHS is a hard error, not a skip."""
    dummy = types.ModuleType("dummy_gate_no_paths")
    sys.modules["dummy_gate_no_paths"] = dummy
    try:
        with pytest.raises(AttributeError):
            mod.collect_gate_paths(("dummy_gate_no_paths",))
    finally:
        del sys.modules["dummy_gate_no_paths"]


def test_collect_raises_on_unimportable_gate():
    with pytest.raises(ImportError):
        mod.collect_gate_paths(("nonexistent_gate_module_xyz",))


# --- main(): exit codes -----------------------------------------------------

def test_main_green_on_live_tree(capsys):
    assert mod.main() == 0
    out = capsys.readouterr().out
    assert "resolve under packages/core/" in out
