"""Unit tests for `scripts/first_run_gate_hook.py`.

Phase 2 Step 5 of `road-to-hooks-actually-fire-in-consumers`.

Three fixtures per Council R3:
  A — plugin enabled + no scaffolding → stderr + action-needed file
  B — plugin enabled + setup complete → silent (no file, cleanup if stale)
  C — plugin NOT enabled              → silent (no false positive)
"""
from __future__ import annotations

import importlib.util
import json
import os
import stat
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
SCRIPT_PATH = REPO_ROOT / "scripts" / "first_run_gate_hook.py"


def _load():
    spec = importlib.util.spec_from_file_location(
        "first_run_gate_hook", SCRIPT_PATH
    )
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["first_run_gate_hook"] = mod
    spec.loader.exec_module(mod)
    return mod


@pytest.fixture(scope="module")
def gate():
    return _load()


def _make_settings(tmp_path: Path, plugin_enabled: bool) -> None:
    target = tmp_path / ".claude" / "settings.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    if plugin_enabled:
        target.write_text(json.dumps({
            "enabledPlugins": {"agent-config@event4u-agent-config": True}
        }))
    # If not enabled, don't write the file at all.


def _make_symlink_executable(tmp_path: Path) -> None:
    # Create a minimal executable file at ./agent-config to mimic the
    # symlink-or-script that `hooks:install --claude` provisions.
    target = tmp_path / "agent-config"
    target.write_text("#!/bin/sh\nexit 0\n")
    target.chmod(target.stat().st_mode | stat.S_IXUSR | stat.S_IXGRP | stat.S_IXOTH)


def _make_regenerator(tmp_path: Path) -> None:
    target = tmp_path / ".augment" / "scripts" / "update_roadmap_progress.py"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text("#!/usr/bin/env python3\nprint('regen')\n")


# ── Fixture A — enabled + unscaffolded → action file + stderr ────────


def test_enabled_but_unscaffolded_writes_action_file(gate, tmp_path, capsys):
    _make_settings(tmp_path, plugin_enabled=True)
    # NO ./agent-config, NO regenerator.
    rc = gate.run(tmp_path)
    assert rc == 0
    action_file = tmp_path / ".augment" / ".first-run-action-needed.md"
    assert action_file.exists()
    body = action_file.read_text()
    assert "First-run action needed" in body
    assert "hooks:install --claude --regen" in body
    err = capsys.readouterr().err
    assert "first-run-gate" in err
    assert "scaffolding is missing" in err


def test_enabled_but_partial_scaffolding_still_writes(gate, tmp_path):
    """Symlink present but regenerator absent → still a failure shape."""
    _make_settings(tmp_path, plugin_enabled=True)
    _make_symlink_executable(tmp_path)
    # No regenerator under .augment/scripts/
    rc = gate.run(tmp_path)
    assert rc == 0
    assert (tmp_path / ".augment" / ".first-run-action-needed.md").exists()


# ── Fixture B — enabled + setup complete → silent + cleanup ─────────


def test_enabled_and_setup_complete_is_silent(gate, tmp_path, capsys):
    _make_settings(tmp_path, plugin_enabled=True)
    _make_symlink_executable(tmp_path)
    _make_regenerator(tmp_path)
    rc = gate.run(tmp_path)
    assert rc == 0
    assert not (tmp_path / ".augment" / ".first-run-action-needed.md").exists()
    assert "first-run-gate" not in capsys.readouterr().err


def test_enabled_and_setup_complete_cleans_up_stale_action_file(gate, tmp_path):
    """A stale action-needed file from a prior failed run gets removed
    once setup is complete."""
    _make_settings(tmp_path, plugin_enabled=True)
    _make_symlink_executable(tmp_path)
    _make_regenerator(tmp_path)
    # Stale file from before:
    stale = tmp_path / ".augment" / ".first-run-action-needed.md"
    stale.parent.mkdir(parents=True, exist_ok=True)
    stale.write_text("stale content")
    assert stale.exists()
    gate.run(tmp_path)
    assert not stale.exists()


# ── Fixture C — plugin not enabled → silent ─────────────────────────


def test_plugin_not_enabled_is_silent(gate, tmp_path, capsys):
    # No .claude/settings.json at all.
    rc = gate.run(tmp_path)
    assert rc == 0
    assert not (tmp_path / ".augment" / ".first-run-action-needed.md").exists()
    assert "first-run-gate" not in capsys.readouterr().err


def test_plugin_enabled_false_is_silent(gate, tmp_path):
    settings = tmp_path / ".claude" / "settings.json"
    settings.parent.mkdir(parents=True, exist_ok=True)
    settings.write_text(json.dumps({
        "enabledPlugins": {"agent-config@event4u-agent-config": False}
    }))
    rc = gate.run(tmp_path)
    assert rc == 0
    assert not (tmp_path / ".augment" / ".first-run-action-needed.md").exists()


def test_malformed_settings_treated_as_not_enabled(gate, tmp_path, capsys):
    """A garbled settings.json should not crash the hook."""
    settings = tmp_path / ".claude" / "settings.json"
    settings.parent.mkdir(parents=True, exist_ok=True)
    settings.write_text("not json {")
    rc = gate.run(tmp_path)
    assert rc == 0
    assert not (tmp_path / ".augment" / ".first-run-action-needed.md").exists()
