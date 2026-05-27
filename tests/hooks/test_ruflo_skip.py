"""ruflo coexistence skip-gate for the hook dispatcher.

road-to-ruflo-bridge Phase 3: when `integrations.ruflo.mode: skip` is set in
the project's `.agent-settings.yml`, `dispatch_hook._ruflo_skip_active()`
returns True and the dispatcher no-ops (fail-open). Absent settings or
`coexist` → hooks run.
"""
from __future__ import annotations

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts" / "hooks"))

import dispatch_hook  # noqa: E402


def test_skip_inactive_without_settings(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    assert dispatch_hook._ruflo_skip_active() is False


def test_skip_active_when_mode_skip(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    (tmp_path / ".agent-settings.yml").write_text(
        "integrations:\n  ruflo:\n    mode: skip\n", encoding="utf-8")
    assert dispatch_hook._ruflo_skip_active() is True


def test_skip_inactive_when_mode_coexist(tmp_path, monkeypatch):
    monkeypatch.chdir(tmp_path)
    (tmp_path / ".agent-settings.yml").write_text(
        "integrations:\n  ruflo:\n    mode: coexist\n", encoding="utf-8")
    assert dispatch_hook._ruflo_skip_active() is False
