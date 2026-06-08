"""Tests for ``src/cli/python/workspace_drive_health.py`` (ADR-073).

Per-host drive health cache + kill-switch. Auto-trips at KILL_STREAK=5
consecutive failures; manual kill / reset; fails open on a missing cache.
"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[1]
MODULE_PATH = REPO_ROOT / "src" / "cli" / "python" / "workspace_drive_health.py"


def _load():
    spec = importlib.util.spec_from_file_location("workspace_drive_health", MODULE_PATH)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    sys.modules["workspace_drive_health"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture
def dh():
    return _load()


@pytest.fixture
def root(tmp_path):
    r = tmp_path / "workspace" / "health"
    r.mkdir(parents=True)
    return r


def test_missing_cache_fails_open(dh, root):
    assert dh.is_killed(root, "claude-code") is False
    s = dh.status(root, "claude-code")
    assert s["killed"] is False and s["consecutive_failures"] == 0


def test_success_keeps_healthy_and_resets_streak(dh, root):
    dh.record(root, "codex", ok=False, error_kind="timeout")
    dh.record(root, "codex", ok=False, error_kind="timeout")
    assert dh.status(root, "codex")["consecutive_failures"] == 2
    dh.record(root, "codex", ok=True)
    s = dh.status(root, "codex")
    assert s["consecutive_failures"] == 0
    assert s["total_success"] == 1 and s["total_failure"] == 2
    assert dh.is_killed(root, "codex") is False


def test_auto_trip_at_five_consecutive_failures(dh, root):
    for i in range(4):
        dh.record(root, "gemini", ok=False, error_kind="nonzero-exit")
        assert dh.is_killed(root, "gemini") is False, f"tripped early at {i + 1}"
    state = dh.record(root, "gemini", ok=False, error_kind="nonzero-exit")  # 5th
    assert state["killed"] is True
    assert dh.is_killed(root, "gemini") is True
    assert state["last_error_kind"] == "nonzero-exit"


def test_kill_streak_constant_is_five(dh):
    assert dh.KILL_STREAK == 5


def test_manual_kill_and_reset(dh, root):
    dh.kill(root, "claude-code")
    assert dh.is_killed(root, "claude-code") is True
    dh.reset(root, "claude-code")
    assert dh.is_killed(root, "claude-code") is False
    assert dh.status(root, "claude-code")["consecutive_failures"] == 0


def test_success_does_not_clear_a_trip(dh, root):
    # A success resets the streak but a tripped host stays killed until reset
    # (manual-reset-only, v0). The streak counter starts fresh, killed holds.
    for _ in range(5):
        dh.record(root, "codex", ok=False, error_kind="timeout")
    assert dh.is_killed(root, "codex") is True
    dh.record(root, "codex", ok=True)
    assert dh.status(root, "codex")["consecutive_failures"] == 0
    assert dh.is_killed(root, "codex") is True              # still killed → manual reset only


def test_status_all_hosts(dh, root):
    dh.record(root, "codex", ok=True)
    dh.kill(root, "gemini")
    alls = dh.status(root)
    assert set(alls) == {"codex", "gemini"}
    assert alls["gemini"]["killed"] is True


def test_invalid_host_fails_open_on_read(dh, root):
    assert dh.is_killed(root, "Bad Host!") is False         # invalid id → default


def test_atomic_write_leaves_no_tmp(dh, root):
    dh.record(root, "codex", ok=True)
    assert list(root.glob("*.tmp")) == []
    assert (root / "codex.json").is_file()


# --- CLI -------------------------------------------------------------------

def test_cli_root_must_be_health_dir(dh, tmp_path):
    bad = tmp_path / "nope"
    bad.mkdir()
    with pytest.raises(SystemExit, match="health"):
        dh.main(["status", "--root", str(bad)])


def test_cli_record_then_status(dh, root, capsys):
    rc = dh.main(["record", "--host", "codex", "--outcome", "fail",
                  "--error-kind", "timeout", "--root", str(root)])
    assert rc == 0
    out = json.loads(capsys.readouterr().out)
    assert out["consecutive_failures"] == 1 and out["last_error_kind"] == "timeout"
    rc = dh.main(["status", "--host", "codex", "--json", "--root", str(root)])
    assert rc == 0
    assert json.loads(capsys.readouterr().out)["total_failure"] == 1


def test_cli_kill_reset(dh, root, capsys):
    dh.main(["kill", "--host", "gemini", "--root", str(root)])
    capsys.readouterr()
    rc = dh.main(["status", "--host", "gemini", "--json", "--root", str(root)])
    assert json.loads(capsys.readouterr().out)["killed"] is True
    dh.main(["reset", "--host", "gemini", "--root", str(root)])
    capsys.readouterr()
    dh.main(["status", "--host", "gemini", "--json", "--root", str(root)])
    assert json.loads(capsys.readouterr().out)["killed"] is False
