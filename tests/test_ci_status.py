"""Unit tests for ``scripts/ci_status.py`` — Phase A Step 6 of
``road-to-adoption-proof-and-ci-green.md``.

Covers the JSON-parser path (no live ``gh`` invocations): green
required set, missing check, red check, phantom 0-job filter, and
the per-shape required-check selection.
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
MODULE_PATH = REPO_ROOT / "src" / "scripts" / "ci_status.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("ci_status", MODULE_PATH)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["ci_status"] = mod
    spec.loader.exec_module(mod)
    return mod


def _run(mod, name: str, conclusion: str, jobs: int = -1):
    return mod.Run(name=name, conclusion=conclusion, status="completed", jobs=jobs)


def test_all_required_green_returns_zero_reds() -> None:
    mod = _load_module()
    required = {"Consistency", "Smoke Contracts"}
    runs = [
        _run(mod, "Consistency", "success", jobs=4),
        _run(mod, "Smoke Contracts", "success", jobs=4),
    ]
    greens, missing, reds = mod.compute_status(runs, required, resolve_jobs=False)
    assert {n for n, _ in greens} == required
    assert missing == []
    assert reds == []


def test_phantom_zero_job_failure_is_filtered() -> None:
    """A run with conclusion=failure and jobs=0 must drop out of the red set."""
    mod = _load_module()
    required = {"sync-visibility.yml"}
    runs = [_run(mod, "sync-visibility.yml", "failure", jobs=0)]
    greens, missing, reds = mod.compute_status(runs, required, resolve_jobs=False)
    assert {n for n, _ in greens} == required
    assert reds == []


def test_genuine_failure_lands_in_reds() -> None:
    mod = _load_module()
    required = {"Consistency"}
    runs = [_run(mod, "Consistency", "failure", jobs=12)]
    greens, missing, reds = mod.compute_status(runs, required, resolve_jobs=False)
    assert greens == []
    assert {n for n, _ in reds} == required


def test_missing_required_check_is_surfaced() -> None:
    """A required check with no run in the window lands in `missing`."""
    mod = _load_module()
    required = {"Consistency", "Skill Lint"}
    runs = [_run(mod, "Consistency", "success", jobs=4)]
    greens, missing, reds = mod.compute_status(runs, required, resolve_jobs=False)
    assert {n for n, _ in greens} == {"Consistency"}
    assert missing == ["Skill Lint"]
    assert reds == []


def test_latest_run_per_workflow_wins() -> None:
    """When two runs of the same workflow appear, only the latest counts."""
    mod = _load_module()
    required = {"Consistency"}
    # First entry in the list is the most-recent (gh run list is mtime-desc).
    runs = [
        _run(mod, "Consistency", "success", jobs=4),
        _run(mod, "Consistency", "failure", jobs=4),
    ]
    greens, missing, reds = mod.compute_status(runs, required, resolve_jobs=False)
    assert {n for n, _ in greens} == required
    assert reds == []


def test_in_progress_status_is_treated_as_no_completed_run() -> None:
    """A queued / in_progress entry doesn't count as the latest completed run."""
    mod = _load_module()
    required = {"Consistency"}
    runs = [
        mod.Run(name="Consistency", conclusion="", status="in_progress", jobs=-1),
        _run(mod, "Consistency", "success", jobs=4),
    ]
    greens, missing, reds = mod.compute_status(runs, required, resolve_jobs=False)
    assert {n for n, _ in greens} == required
    assert reds == []


def test_required_set_by_shape_matches_contract() -> None:
    """The per-shape required-check vocabulary mirrors the contract surface."""
    mod = _load_module()
    feature = mod.REQUIRED_CHECKS_BY_SHAPE["feature"]
    release = mod.REQUIRED_CHECKS_BY_SHAPE["release"]
    docs = mod.REQUIRED_CHECKS_BY_SHAPE["docs"]
    # Every shape includes the universal floor.
    universal = {"Consistency", "Smoke Contracts"}
    assert universal <= feature
    assert universal <= release
    assert universal <= docs
    # Feature is the superset; release is the heavy-test-free subset.
    assert "Tests" in feature
    assert "Tests" not in release
    assert "Tests" not in docs
    # Release adds release-shape validation.
    assert "Release Validation" in release
    assert "Release Validation" not in feature


def test_is_phantom_only_for_failure_with_zero_jobs() -> None:
    mod = _load_module()
    assert mod.is_phantom(_run(mod, "x", "failure", jobs=0)) is True
    assert mod.is_phantom(_run(mod, "x", "failure", jobs=1)) is False
    assert mod.is_phantom(_run(mod, "x", "success", jobs=0)) is False
    assert mod.is_phantom(_run(mod, "x", "cancelled", jobs=0)) is False
