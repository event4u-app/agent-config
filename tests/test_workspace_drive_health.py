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


def test_auto_trip_success_closes_circuit(dh, root):
    # ADR-073 v1: a successful drive closes an AUTO-tripped circuit (un-kills).
    for _ in range(5):
        dh.record(root, "codex", ok=False, error_kind="timeout")
    assert dh.is_killed(root, "codex") is True
    dh.record(root, "codex", ok=True)                       # probe / drive succeeds
    s = dh.status(root, "codex")
    assert s["consecutive_failures"] == 0
    assert s["killed"] is False                             # auto-recovered
    assert s["kill_reason"] is None and s["killed_at"] is None


def _trip_auto(dh, root, host, at):
    """Auto-trip a host at epoch `at` (5 consecutive failures)."""
    for _ in range(5):
        dh.record(root, host, ok=False, error_kind="timeout", now=at)


def test_gate_closed_when_healthy(dh, root):
    assert dh.gate(root, "codex", now=1000.0) == "closed"


def test_gate_open_during_cooldown(dh, root):
    _trip_auto(dh, root, "codex", at=1000.0)
    # default cooldown 600s → still open at +599
    assert dh.gate(root, "codex", now=1599.0) == "open"


def test_gate_half_open_after_cooldown_and_marks_probe(dh, root):
    _trip_auto(dh, root, "codex", at=1000.0)
    assert dh.gate(root, "codex", now=1601.0) == "half_open"
    # probe lease now stamped → a concurrent gate sees open
    assert dh.gate(root, "codex", now=1601.0) == "open"
    assert dh.status(root, "codex")["probe_started_at"] is not None


def test_probe_success_recovers(dh, root):
    _trip_auto(dh, root, "codex", at=1000.0)
    assert dh.gate(root, "codex", now=1601.0) == "half_open"
    dh.record(root, "codex", ok=True, is_probe=True, now=1602.0)
    assert dh.is_killed(root, "codex") is False
    assert dh.gate(root, "codex", now=1603.0) == "closed"


def test_probe_failure_reopens_and_counts_trip(dh, root):
    _trip_auto(dh, root, "codex", at=1000.0)          # trip_count 1
    dh.gate(root, "codex", now=1601.0)                # half-open, lease set
    dh.record(root, "codex", ok=False, error_kind="timeout", is_probe=True, now=1602.0)
    s = dh.status(root, "codex")
    assert s["killed"] is True and s["trip_count"] == 2
    assert s["killed_at"] == 1602.0                   # cooldown restarted
    assert dh.gate(root, "codex", now=1700.0) == "open"   # cooling again


def test_flapping_guard_goes_sticky_after_max_trips(dh, root):
    # trip 1 (auto) + two failed probes (trips 2, 3) → trip_count == MAX_AUTO_TRIPS
    _trip_auto(dh, root, "codex", at=1000.0)
    t = 1601.0
    for _ in range(2):
        dh.gate(root, "codex", now=t)
        dh.record(root, "codex", ok=False, error_kind="timeout", is_probe=True, now=t + 1)
        t += 700
    assert dh.status(root, "codex")["trip_count"] >= dh.MAX_AUTO_TRIPS
    # now sticky: even far past cooldown, stays open (manual reset only)
    assert dh.gate(root, "codex", now=t + 10_000) == "open"


def test_manual_kill_is_sticky(dh, root):
    dh.kill(root, "gemini", now=1000.0)
    assert dh.status(root, "gemini")["kill_reason"] == "manual"
    # never half-opens, even long past any cooldown
    assert dh.gate(root, "gemini", now=1_000_000.0) == "open"
    # a success does NOT auto-clear a manual kill
    dh.record(root, "gemini", ok=True, now=1_000_001.0)
    assert dh.is_killed(root, "gemini") is True


def test_auto_recovery_flag_off_keeps_open(dh, root, monkeypatch):
    monkeypatch.setenv("AGENT_CONFIG_DRIVE_AUTO_RECOVERY", "off")
    _trip_auto(dh, root, "codex", at=1000.0)
    assert dh.gate(root, "codex", now=10_000.0) == "open"   # no half-open when disabled


def test_cooldown_env_override(dh, root, monkeypatch):
    monkeypatch.setenv("AGENT_CONFIG_DRIVE_COOLDOWN_SEC", "60")
    _trip_auto(dh, root, "codex", at=1000.0)
    assert dh.gate(root, "codex", now=1059.0) == "open"
    assert dh.gate(root, "codex", now=1061.0) == "half_open"


def test_reset_clears_v1_fields(dh, root):
    _trip_auto(dh, root, "codex", at=1000.0)
    dh.reset(root, "codex")
    s = dh.status(root, "codex")
    assert s["killed"] is False and s["trip_count"] == 0
    assert s["killed_at"] is None and s["kill_reason"] is None


def test_gate_cli(dh, root, capsys):
    dh.main(["gate", "--host", "codex", "--root", str(root)])
    assert capsys.readouterr().out.strip() == "closed"


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
