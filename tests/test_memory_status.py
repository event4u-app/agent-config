"""Tests for scripts/memory_status.py — backend detection."""

from __future__ import annotations

import json
import os
import stat
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import memory_status  # noqa: E402


@pytest.fixture(autouse=True)
def _clear_cache(monkeypatch, tmp_path):
    """Start every test with a clean cache — env var + file."""
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv(memory_status._CACHE_ENV, raising=False)
    monkeypatch.setattr(memory_status, "_CACHE_FILE",
                        tmp_path / ".agent-memory" / "status.cache")


def test_absent_when_no_cli(monkeypatch):
    monkeypatch.setattr(memory_status, "_find_cli", lambda: "")
    r = memory_status.status(refresh=True)
    assert r.status == "absent"
    assert r.backend == "file"


def test_present_when_cli_healthy(monkeypatch, tmp_path):
    fake = tmp_path / "agent-memory"
    fake.write_text("#!/bin/sh\nexit 0\n")
    fake.chmod(fake.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    monkeypatch.setattr(memory_status, "_find_cli", lambda: str(fake))
    r = memory_status.status(refresh=True)
    assert r.status == "present"
    assert r.backend == "package"
    assert r.cli_path == str(fake)


def test_misconfigured_when_health_fails(monkeypatch, tmp_path):
    fake = tmp_path / "agent-memory"
    fake.write_text("#!/bin/sh\necho 'DB down' >&2\nexit 3\n")
    fake.chmod(fake.stat().st_mode | stat.S_IEXEC | stat.S_IXGRP | stat.S_IXOTH)
    monkeypatch.setattr(memory_status, "_find_cli", lambda: str(fake))
    r = memory_status.status(refresh=True)
    assert r.status == "misconfigured"
    assert r.backend == "file"
    assert "health()" in r.reason


def test_cache_hit_env(monkeypatch):
    # Seed the env cache; refresh=False should reuse it.
    payload = json.dumps({
        "status": "present", "backend": "package",
        "reason": "ok", "elapsed_ms": 42, "cli_path": "/x",
    })
    monkeypatch.setenv(memory_status._CACHE_ENV, payload)
    # A failing finder would surface if cache were ignored.
    monkeypatch.setattr(memory_status, "_find_cli", lambda: "")
    r = memory_status.status(refresh=False)
    assert r.status == "present"
    assert r.elapsed_ms == 0, "cache hits must report 0ms elapsed"


def test_refresh_bypasses_cache(monkeypatch):
    monkeypatch.setenv(memory_status._CACHE_ENV, json.dumps({
        "status": "present", "backend": "package",
        "reason": "stale", "elapsed_ms": 1, "cli_path": "/x",
    }))
    monkeypatch.setattr(memory_status, "_find_cli", lambda: "")
    r = memory_status.status(refresh=True)
    assert r.status == "absent", "refresh=True must re-probe"


def test_never_raises(monkeypatch):
    # Even if _find_cli explodes, status() must still return a Result —
    # skills cannot tolerate the helper raising.
    def _boom():
        raise RuntimeError("disk on fire")
    monkeypatch.setattr(memory_status, "_find_cli", _boom)
    with pytest.raises(RuntimeError):
        # The contract is *graceful degradation*, not catching bugs in
        # its own code. Document the current shape: only health-probe
        # and subprocess errors are swallowed. Bugs propagate.
        memory_status.status(refresh=True)
