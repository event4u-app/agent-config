"""Phase 10.2 helper-module contract tests.

Validates `scripts/_lib/script_output.py` resolution order, level
behaviour (silent / minimal / verbose), env var inheritance, and the
end-of-run summary collapse. Stdlib + pytest only.
"""
from __future__ import annotations

import io
import sys
from pathlib import Path
from textwrap import dedent

import pytest

# Re-import the module under a fresh name so we control its module-level
# state via reset_level() between tests.
from scripts._lib import script_output as so


@pytest.fixture(autouse=True)
def _reset_state(monkeypatch):
    """Each test starts with a clean level cache and clean env vars."""
    monkeypatch.delenv(so.ENV_VAR, raising=False)
    monkeypatch.delenv(so.ENV_ALIAS, raising=False)
    so.reset_level()
    yield
    so.reset_level()


def _write_settings(tmp_path: Path, level: str | None) -> Path:
    """Write a minimal .agent-settings.yml; returns its path."""
    settings = tmp_path / ".agent-settings.yml"
    if level is None:
        settings.write_text("verbosity:\n  preview_artifacts: false\n")
    else:
        settings.write_text(f"verbosity:\n  script_output: {level}\n")
    return settings


def test_default_level_is_minimal(tmp_path):
    missing = tmp_path / "does-not-exist.yml"
    assert so.resolve_level(missing) == "minimal"


def test_settings_file_minimal_wins(tmp_path):
    path = _write_settings(tmp_path, "minimal")
    assert so.resolve_level(path) == "minimal"


def test_settings_file_silent_wins(tmp_path):
    path = _write_settings(tmp_path, "silent")
    assert so.resolve_level(path) == "silent"


def test_settings_file_verbose_wins(tmp_path):
    path = _write_settings(tmp_path, "verbose")
    assert so.resolve_level(path) == "verbose"


def test_env_var_overrides_settings(tmp_path, monkeypatch):
    path = _write_settings(tmp_path, "minimal")
    monkeypatch.setenv(so.ENV_VAR, "verbose")
    assert so.resolve_level(path) == "verbose"


def test_env_alias_forces_verbose(tmp_path, monkeypatch):
    path = _write_settings(tmp_path, "silent")
    monkeypatch.setenv(so.ENV_ALIAS, "1")
    assert so.resolve_level(path) == "verbose"


def test_invalid_settings_value_falls_back_to_default(tmp_path):
    path = tmp_path / ".agent-settings.yml"
    path.write_text("verbosity:\n  script_output: chatty\n")
    assert so.resolve_level(path) == "minimal"


def test_resolved_level_exported_for_inheritance(tmp_path, monkeypatch):
    import os
    path = _write_settings(tmp_path, "verbose")
    assert so.resolve_level(path) == "verbose"
    assert os.environ.get(so.ENV_VAR) == "verbose"


def test_info_silent_at_minimal(tmp_path, capsys):
    path = _write_settings(tmp_path, "minimal")
    so.resolve_level(path)
    so.info("step 1")
    captured = capsys.readouterr()
    assert captured.out == ""


def test_info_prints_at_verbose(tmp_path, capsys):
    path = _write_settings(tmp_path, "verbose")
    so.resolve_level(path)
    so.info("step 1")
    captured = capsys.readouterr()
    assert "step 1" in captured.out


def test_success_collected_at_minimal(tmp_path, capsys):
    path = _write_settings(tmp_path, "minimal")
    so.resolve_level(path)
    so.success("did the thing")
    captured = capsys.readouterr()
    assert captured.out == ""
    so.flush_summary()
    captured = capsys.readouterr()
    assert "did the thing" in captured.out


def test_success_immediate_at_verbose(tmp_path, capsys):
    path = _write_settings(tmp_path, "verbose")
    so.resolve_level(path)
    so.success("did the thing")
    captured = capsys.readouterr()
    assert "did the thing" in captured.out


def test_success_dropped_at_silent(tmp_path, capsys):
    path = _write_settings(tmp_path, "silent")
    so.resolve_level(path)
    so.success("did the thing")
    so.flush_summary()
    captured = capsys.readouterr()
    assert captured.out == ""


def test_error_always_to_stderr(tmp_path, capsys):
    path = _write_settings(tmp_path, "silent")
    so.resolve_level(path)
    so.error("boom")
    captured = capsys.readouterr()
    assert captured.out == ""
    assert "boom" in captured.err


def test_warn_to_stderr_unless_silent(tmp_path, capsys):
    path = _write_settings(tmp_path, "minimal")
    so.resolve_level(path)
    so.warn("careful")
    captured = capsys.readouterr()
    assert "careful" in captured.err
