"""Tests for the `global-binary` doctor check (scripts/_cli/cmd_doctor.py).

Covers the three verdicts: not-on-PATH (fail), version drift (warn), and
on-PATH-in-parity (ok), plus the project-bridge-marker note.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from scripts._cli import cmd_doctor as d  # noqa: E402


def test_global_binary_fail_when_not_on_path(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(d.shutil, "which", lambda _: None)
    r = d._check_global_binary(tmp_path)
    assert r["id"] == "global-binary"
    assert r["status"] == "fail"
    assert "not on PATH" in r["message"]
    assert "npm install -g" in r["remedy"]


def test_global_binary_warn_on_version_drift(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(d.shutil, "which", lambda _: "/usr/local/bin/agent-config")
    monkeypatch.setattr(d.installed_lock, "read_lockfile",
                        lambda *a, **k: {"agent_config_version": "1.40.0"})
    monkeypatch.setattr(d, "_current_package_version", lambda: "1.42.0")
    r = d._check_global_binary(tmp_path)
    assert r["status"] == "warn"
    assert "1.40.0" in r["message"] and "1.42.0" in r["message"]
    assert "upgrade" in r["remedy"]


def test_global_binary_ok_in_parity_with_bridge(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(d.shutil, "which", lambda _: "/usr/local/bin/agent-config")
    monkeypatch.setattr(d.installed_lock, "read_lockfile",
                        lambda *a, **k: {"agent_config_version": "1.42.0"})
    monkeypatch.setattr(d, "_current_package_version", lambda: "1.42.0")
    (tmp_path / "agents").mkdir()
    (tmp_path / "agents" / ".event4u-bridge.yml").write_text("global_root: ~/x\n")
    r = d._check_global_binary(tmp_path)
    assert r["status"] == "ok"
    assert "no project bridge marker" not in r["message"]


def test_global_binary_ok_but_flags_missing_bridge(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.setattr(d.shutil, "which", lambda _: "/usr/local/bin/agent-config")
    monkeypatch.setattr(d.installed_lock, "read_lockfile",
                        lambda *a, **k: {"agent_config_version": "1.42.0"})
    monkeypatch.setattr(d, "_current_package_version", lambda: "1.42.0")
    r = d._check_global_binary(tmp_path)
    assert r["status"] == "ok"
    assert "no project bridge marker" in r["message"]
    assert "refresh --project" in r["remedy"]
