"""Unit tests for the dispatch-issues observability log.

Phase 1 Step 4 of `road-to-hooks-actually-fire-in-consumers`.

Two surfaces under test:
  - scripts/hooks/dispatch_issues.py — the append helper + reader.
  - scripts/hooks/dispatch_hook.py    — wires script-not-found and
    execution-failed cases into the log.
"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
HOOKS_DIR = REPO_ROOT / "src" / "scripts" / "hooks"
DISPATCH_ISSUES = HOOKS_DIR / "dispatch_issues.py"


def _load(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules[name] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def issues_mod():
    return _load("dispatch_issues", DISPATCH_ISSUES)


# ── Helper round-trip ────────────────────────────────────────────────


def test_log_and_read_round_trip(issues_mod, tmp_path):
    issues_mod.log_dispatch_issue(
        workspace_root=tmp_path,
        hook="roadmap-progress",
        issue="prerequisite_missing",
        detail="update_roadmap_progress.py not found",
        resolution="./agent-config hooks:install --regen",
    )
    out = issues_mod.read_dispatch_issues(tmp_path)
    assert len(out) == 1
    entry = out[0]
    assert entry["hook"] == "roadmap-progress"
    assert entry["issue"] == "prerequisite_missing"
    assert "update_roadmap_progress.py" in entry["detail"]
    assert entry["resolution"].startswith("./agent-config")
    assert entry["timestamp"].endswith("Z")


def test_invalid_issue_rejected_but_no_crash(issues_mod, tmp_path, capsys):
    issues_mod.log_dispatch_issue(
        workspace_root=tmp_path,
        hook="x",
        issue="not_a_valid_enum",
        detail="nope",
        resolution="nope",
    )
    # No file created — invalid issue skipped.
    assert issues_mod.read_dispatch_issues(tmp_path) == []
    err = capsys.readouterr().err
    assert "invalid issue" in err


def test_rotation_caps_at_200(issues_mod, tmp_path):
    for i in range(250):
        issues_mod.log_dispatch_issue(
            workspace_root=tmp_path,
            hook="rotation-test",
            issue="prerequisite_missing",
            detail=f"entry {i}",
            resolution="./agent-config init",
        )
    out = issues_mod.read_dispatch_issues(tmp_path)
    assert len(out) == 200
    # Oldest entries dropped — should start at entry 50.
    assert out[0]["detail"] == "entry 50"
    assert out[-1]["detail"] == "entry 249"


def test_read_returns_empty_when_log_absent(issues_mod, tmp_path):
    assert issues_mod.read_dispatch_issues(tmp_path) == []


def test_log_creates_state_dir(issues_mod, tmp_path):
    state_dir = tmp_path / "agents" / "runtime" / "state"
    assert not state_dir.exists()
    issues_mod.log_dispatch_issue(
        workspace_root=tmp_path,
        hook="x",
        issue="script_not_found",
        detail="d",
        resolution="r",
    )
    assert (state_dir / "dispatch-issues.jsonl").exists()


def test_log_file_is_valid_jsonl(issues_mod, tmp_path):
    for i in range(3):
        issues_mod.log_dispatch_issue(
            workspace_root=tmp_path,
            hook=f"hook-{i}",
            issue="prerequisite_missing",
            detail=f"d-{i}",
            resolution="r",
        )
    log = tmp_path / "agents" / "runtime" / "state" / "dispatch-issues.jsonl"
    lines = [ln for ln in log.read_text().splitlines() if ln.strip()]
    assert len(lines) == 3
    for ln in lines:
        # Each line is parseable JSON
        decoded = json.loads(ln)
        assert set(decoded.keys()) >= {"timestamp", "hook", "issue", "detail", "resolution"}


def test_resolution_field_is_freeform(issues_mod, tmp_path):
    """resolution can be a command or a doc URL."""
    issues_mod.log_dispatch_issue(
        workspace_root=tmp_path,
        hook="x",
        issue="execution_failed",
        detail="timeout",
        resolution="see docs/contracts/hook-architecture-v1.md",
    )
    out = issues_mod.read_dispatch_issues(tmp_path)
    assert out[0]["resolution"].startswith("see docs/")
