"""Tests for the ``scripts/_lib/update_check`` module.

Phase 2 of road-to-portable-runtime-and-update-check (P2.5). Covers:

- 24 h cadence gate (mocked ``now``).
- All six suppression branches: CI, GITHUB_ACTIONS, non-TTY,
  ``AGENT_CONFIG_NO_UPDATE_CHECK=1``, ``settings_enabled=False``,
  registry-error tolerance.
- State-file shape (``last_check_utc``, ``last_seen_version``,
  ``installed_version``) and ``0600`` mode.
- Atomic write + JSON shape round-trip.
"""
from __future__ import annotations

import json
import os
import stat
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts._lib import update_check as uc  # noqa: E402


NOW = datetime(2026, 5, 12, 9, 31, 14, tzinfo=timezone.utc)


@pytest.fixture
def state_path(tmp_path: Path) -> Path:
    return tmp_path / "config" / "update-check.json"


def _fetcher(version: str | None):
    def _f() -> str | None:
        return version
    return _f


# --- suppression branches ---------------------------------------------------


def test_suppress_when_no_update_check_env(state_path: Path) -> None:
    result = uc.check_for_update(
        "1.0.0",
        now=NOW,
        state_path=state_path,
        env={"AGENT_CONFIG_NO_UPDATE_CHECK": "1"},
        is_tty=True,
        fetcher=_fetcher("2.0.0"),
    )
    assert result is None
    assert not state_path.exists()


def test_suppress_in_ci(state_path: Path) -> None:
    result = uc.check_for_update(
        "1.0.0", now=NOW, state_path=state_path,
        env={"CI": "true"}, is_tty=True, fetcher=_fetcher("2.0.0"),
    )
    assert result is None


def test_suppress_in_github_actions(state_path: Path) -> None:
    result = uc.check_for_update(
        "1.0.0", now=NOW, state_path=state_path,
        env={"GITHUB_ACTIONS": "true"}, is_tty=True, fetcher=_fetcher("2.0.0"),
    )
    assert result is None


def test_suppress_when_not_tty(state_path: Path) -> None:
    result = uc.check_for_update(
        "1.0.0", now=NOW, state_path=state_path,
        env={}, is_tty=False, fetcher=_fetcher("2.0.0"),
    )
    assert result is None


def test_suppress_when_settings_disabled(state_path: Path) -> None:
    result = uc.check_for_update(
        "1.0.0", now=NOW, state_path=state_path,
        env={}, is_tty=True, settings_enabled=False, fetcher=_fetcher("2.0.0"),
    )
    assert result is None


def test_suppress_when_registry_returns_none(state_path: Path) -> None:
    result = uc.check_for_update(
        "1.0.0", now=NOW, state_path=state_path,
        env={}, is_tty=True, fetcher=_fetcher(None),
    )
    assert result is None
    # State file is still written so we don't hammer the registry.
    assert state_path.exists()


# --- 24 h cadence gate ------------------------------------------------------


def test_first_run_fetches_and_returns_banner(state_path: Path) -> None:
    banner = uc.check_for_update(
        "1.0.0", now=NOW, state_path=state_path,
        env={}, is_tty=True, fetcher=_fetcher("2.0.0"),
    )
    assert banner is not None
    assert "1.0.0" in banner and "2.0.0" in banner
    data = json.loads(state_path.read_text(encoding="utf-8"))
    assert data["installed_version"] == "1.0.0"
    assert data["last_seen_version"] == "2.0.0"
    assert data["last_check_utc"].endswith("Z")


def test_within_24h_does_not_fetch(state_path: Path) -> None:
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps({
        "last_check_utc": (NOW - timedelta(hours=12)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "last_seen_version": "2.0.0",
        "installed_version": "1.0.0",
    }), encoding="utf-8")

    calls = {"n": 0}

    def _spy() -> str | None:
        calls["n"] += 1
        return "9.9.9"

    banner = uc.check_for_update(
        "1.0.0", now=NOW, state_path=state_path,
        env={}, is_tty=True, fetcher=_spy,
    )
    assert calls["n"] == 0
    assert banner is not None  # cached "2.0.0" is newer than installed
    assert "2.0.0" in banner


def test_after_24h_refetches(state_path: Path) -> None:
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text(json.dumps({
        "last_check_utc": (NOW - timedelta(hours=25)).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "last_seen_version": "1.0.0",
        "installed_version": "1.0.0",
    }), encoding="utf-8")

    banner = uc.check_for_update(
        "1.0.0", now=NOW, state_path=state_path,
        env={}, is_tty=True, fetcher=_fetcher("2.1.0"),
    )
    assert banner is not None and "2.1.0" in banner
    data = json.loads(state_path.read_text(encoding="utf-8"))
    assert data["last_seen_version"] == "2.1.0"


def test_no_update_when_same_version(state_path: Path) -> None:
    banner = uc.check_for_update(
        "2.0.0", now=NOW, state_path=state_path,
        env={}, is_tty=True, fetcher=_fetcher("2.0.0"),
    )
    assert banner is None


def test_no_update_when_installed_newer(state_path: Path) -> None:
    banner = uc.check_for_update(
        "3.0.0", now=NOW, state_path=state_path,
        env={}, is_tty=True, fetcher=_fetcher("2.0.0"),
    )
    assert banner is None


# --- state-file mode + atomic write ----------------------------------------


def test_state_file_mode_is_0600(state_path: Path) -> None:
    uc.check_for_update(
        "1.0.0", now=NOW, state_path=state_path,
        env={}, is_tty=True, fetcher=_fetcher("2.0.0"),
    )
    mode = stat.S_IMODE(state_path.stat().st_mode)
    assert mode == 0o600, f"expected 0o600, got {oct(mode)}"


def test_corrupt_state_falls_back_to_fetch(state_path: Path) -> None:
    state_path.parent.mkdir(parents=True, exist_ok=True)
    state_path.write_text("{not json", encoding="utf-8")

    banner = uc.check_for_update(
        "1.0.0", now=NOW, state_path=state_path,
        env={}, is_tty=True, fetcher=_fetcher("2.0.0"),
    )
    assert banner is not None
    data = json.loads(state_path.read_text(encoding="utf-8"))
    assert data["last_seen_version"] == "2.0.0"


# --- semver comparator ------------------------------------------------------


@pytest.mark.parametrize("latest,installed,expected", [
    ("2.0.0", "1.9.9", True),
    ("1.10.0", "1.9.0", True),
    ("1.0.0", "1.0.0", False),
    ("1.0.0", "1.0.1", False),
    ("v2.0.0", "1.0.0", True),
    ("2.0.0-beta.1", "1.9.9", True),
])
def test_is_newer(latest: str, installed: str, expected: bool) -> None:
    assert uc._is_newer(latest, installed) is expected
