"""Tests for scripts/check_test_coverage_diff.py (R3 — warn-only nudge)."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SPEC = importlib.util.spec_from_file_location(
    "check_test_coverage_diff",
    ROOT / "scripts" / "check_test_coverage_diff.py",
)
assert SPEC and SPEC.loader
mod = importlib.util.module_from_spec(SPEC)
sys.modules["check_test_coverage_diff"] = mod
SPEC.loader.exec_module(mod)

NO_PRAGMA = lambda _path: None  # noqa: E731


# --- passing fixture: source + matching test added together ----------------

def test_new_gate_with_matching_test_is_clean():
    changed = [
        ("A", "scripts/check_foo.py"),
        ("A", "tests/test_check_foo.py"),
    ]
    warnings, suppressed = mod.evaluate(changed, NO_PRAGMA)
    assert warnings == []
    assert suppressed == []


def test_naming_variance_still_matches():
    """`tests/sub/foo_test.py` covers `scripts/check_foo.py`."""
    changed = [("A", "scripts/check_foo.py"), ("A", "tests/sub/foo_test.py")]
    warnings, _ = mod.evaluate(changed, NO_PRAGMA)
    assert warnings == []


# --- warn fixture: new gate, no test, no pragma ----------------------------

def test_new_gate_without_test_warns():
    changed = [("A", "scripts/lint_bar.py")]
    warnings, suppressed = mod.evaluate(changed, NO_PRAGMA)
    assert warnings == ["scripts/lint_bar.py"]
    assert suppressed == []


# --- opt-out fixture: pragma present → suppressed, not warned --------------

def test_pragma_suppresses_warning():
    changed = [("A", "scripts/check_baz.py")]
    reason_for = lambda p: "no behaviour — thin re-export" if p == "scripts/check_baz.py" else None  # noqa: E731
    warnings, suppressed = mod.evaluate(changed, reason_for)
    assert warnings == []
    assert suppressed == [("scripts/check_baz.py", "no behaviour — thin re-export")]


# --- excluded surfaces never trigger (calibration) -------------------------

def test_modified_existing_gate_does_not_trigger():
    """Edits ('M') to existing gates are out of scope — only new ('A') files."""
    changed = [("M", "scripts/check_foo.py")]
    warnings, suppressed = mod.evaluate(changed, NO_PRAGMA)
    assert warnings == [] and suppressed == []


def test_non_gate_additions_ignored():
    changed = [
        ("A", "scripts/helper_thing.py"),  # not check_/lint_
        ("A", "Taskfile.yml"),
        ("A", "docs/guide.md"),
        ("M", "config/discovery/packs.yml"),
    ]
    warnings, suppressed = mod.evaluate(changed, NO_PRAGMA)
    assert warnings == [] and suppressed == []


# --- pragma reader: reads the in-file opt-out from the tree ----------------

def test_pragma_reason_from_tree(tmp_path, monkeypatch):
    gate = tmp_path / "scripts" / "check_demo.py"
    gate.parent.mkdir(parents=True)
    gate.write_text("#!/usr/bin/env python3\n# coverage-diff-ignore: trivial wrapper\nx = 1\n", encoding="utf-8")
    monkeypatch.setattr(mod, "REPO_ROOT", tmp_path)
    assert mod._pragma_reason_from_tree("scripts/check_demo.py") == "trivial wrapper"
    other = tmp_path / "scripts" / "check_none.py"
    other.write_text("x = 1\n", encoding="utf-8")
    assert mod._pragma_reason_from_tree("scripts/check_none.py") is None


# --- main(): always exit 0 (warn-only) + emits the metric line -------------

def test_main_is_warn_only_exit_zero(monkeypatch, capsys):
    monkeypatch.setattr(mod, "_git_name_status", lambda base: [("A", "scripts/check_untested.py")])
    monkeypatch.setattr(mod, "_pragma_reason_from_tree", lambda p: None)
    rc = mod.main(["--base-ref", "main"])
    out = capsys.readouterr().out
    assert rc == 0  # warn-only must never block
    assert "check_untested.py" in out
    assert "warned=1 suppressed=0" in out
