"""Tests for ``scripts/_lib/pin_resolver``.

Phase 3 of road-to-portable-runtime-and-update-check (P3.4). Covers:

- ``read_pin`` returns the pin from the cascaded settings, ``None`` for
  empty / missing values.
- ``should_reexec`` honours the ``NO_PIN_REEXEC`` and
  ``REEXEC_DEPTH`` env vars (escape hatch + recursion guard).
- ``should_reexec`` only fires on a mismatch (normalises ``v``-prefix).
- ``maybe_reexec`` builds the correct ``npx`` argv and sets the depth
  guard on the child env.
- ``maybe_reexec`` returns ``None`` when no pin / pin matches /
  override-active.
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts._lib import pin_resolver as pr  # noqa: E402


def _loader(pin_value):
    """Return a stub settings loader yielding ``{agent_config_version: pin_value}``."""

    def _load(*, cwd):  # noqa: ARG001 — signature matches load_agent_settings
        if pin_value is _UNSET:
            return {}
        return {"agent_config_version": pin_value}

    return _load


_UNSET = object()


def test_read_pin_returns_value(tmp_path):
    pin = pr.read_pin(tmp_path, settings_loader=_loader("1.42.0"))
    assert pin == "1.42.0"


def test_read_pin_empty_string_yields_none(tmp_path):
    assert pr.read_pin(tmp_path, settings_loader=_loader("")) is None


def test_read_pin_missing_key_yields_none(tmp_path):
    assert pr.read_pin(tmp_path, settings_loader=_loader(_UNSET)) is None


def test_read_pin_non_string_yields_none(tmp_path):
    assert pr.read_pin(tmp_path, settings_loader=_loader(123)) is None


def test_read_pin_strips_whitespace(tmp_path):
    assert pr.read_pin(tmp_path, settings_loader=_loader("  1.42.0  ")) == "1.42.0"


def test_should_reexec_no_pin():
    assert pr.should_reexec(None, "1.41.0", env={}) is False


def test_should_reexec_no_installed():
    assert pr.should_reexec("1.42.0", "", env={}) is False


def test_should_reexec_match():
    assert pr.should_reexec("1.42.0", "1.42.0", env={}) is False


def test_should_reexec_match_with_v_prefix():
    assert pr.should_reexec("v1.42.0", "1.42.0", env={}) is False
    assert pr.should_reexec("1.42.0", "v1.42.0", env={}) is False


def test_should_reexec_mismatch_triggers():
    assert pr.should_reexec("1.42.0", "1.41.0", env={}) is True


def test_should_reexec_blocked_by_no_reexec_env():
    env = {pr.NO_REEXEC_ENV: "1"}
    assert pr.should_reexec("1.42.0", "1.41.0", env=env) is False


def test_should_reexec_blocked_by_depth_guard():
    env = {pr.REEXEC_DEPTH_ENV: "1"}
    assert pr.should_reexec("1.42.0", "1.41.0", env=env) is False


def test_build_reexec_argv():
    argv = pr.build_reexec_argv("1.42.0", ["update", "--check"])
    assert argv == ["npx", "--yes", "@event4u/agent-config@1.42.0", "update", "--check"]


def test_build_reexec_argv_normalises_v_prefix():
    argv = pr.build_reexec_argv("v2.0.0", [])
    assert argv == ["npx", "--yes", "@event4u/agent-config@2.0.0"]


def test_maybe_reexec_returns_none_when_match(tmp_path, monkeypatch):
    monkeypatch.setattr(pr, "read_pin", lambda cwd, **_: "1.41.0")
    result = pr.maybe_reexec("1.41.0", cwd=tmp_path, argv=["agent-config"], env={})
    assert result is None


def test_maybe_reexec_returns_none_when_no_pin(tmp_path, monkeypatch):
    monkeypatch.setattr(pr, "read_pin", lambda cwd, **_: None)
    result = pr.maybe_reexec("1.41.0", cwd=tmp_path, argv=["agent-config"], env={})
    assert result is None


def test_maybe_reexec_invokes_runner_with_child_env(tmp_path, monkeypatch):
    monkeypatch.setattr(pr, "read_pin", lambda cwd, **_: "1.42.0")
    monkeypatch.setattr(pr.shutil, "which", lambda _name: "/usr/bin/npx")

    captured = {}

    def fake_runner(npx, argv, env):
        captured["npx"] = npx
        captured["argv"] = argv
        captured["env"] = env
        return 0

    rc = pr.maybe_reexec(
        "1.41.0",
        cwd=tmp_path,
        argv=["agent-config", "update", "--check"],
        env={"PATH": "/usr/bin"},
        runner=fake_runner,
    )
    assert rc == 0
    assert captured["npx"] == "/usr/bin/npx"
    assert captured["argv"] == ["npx", "--yes", "@event4u/agent-config@1.42.0", "update", "--check"]
    assert captured["env"][pr.REEXEC_DEPTH_ENV] == "1"


def test_maybe_reexec_returns_none_when_npx_missing(tmp_path, monkeypatch):
    monkeypatch.setattr(pr, "read_pin", lambda cwd, **_: "1.42.0")
    monkeypatch.setattr(pr.shutil, "which", lambda _name: None)
    result = pr.maybe_reexec("1.41.0", cwd=tmp_path, argv=["agent-config"], env={})
    assert result is None


def test_maybe_reexec_respects_no_reexec_env(tmp_path, monkeypatch):
    monkeypatch.setattr(pr, "read_pin", lambda cwd, **_: "1.42.0")
    result = pr.maybe_reexec(
        "1.41.0",
        cwd=tmp_path,
        argv=["agent-config"],
        env={pr.NO_REEXEC_ENV: "1"},
    )
    assert result is None
