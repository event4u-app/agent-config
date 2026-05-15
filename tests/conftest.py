"""Repo-wide pytest fixtures.

The agent-config test suite must never touch the developer's real
``agents/council-events.log`` (step-8 D3). The CLI gate, the quota
guard, and the necessity gate all call :func:`append_event` with the
default log path — that default resolves to ``agents/council-events.log``
inside the repo, which would leak test prompts into the audit trail.

Two safeguards are applied automatically:

1. ``AGENT_CONFIG_NO_EVENTS_LOG=1`` is set for the whole test session
   so every ``append_event`` call short-circuits before opening the
   file. Tests that explicitly exercise the writer override the env
   var via ``monkeypatch`` and pass an explicit ``log_path=tmp_path``.

2. A best-effort cleanup at session end removes the file if it was
   ever created (e.g. by a subprocess that did not inherit the env
   var), so the working tree stays clean.
"""
from __future__ import annotations

import os
from pathlib import Path

import pytest


@pytest.fixture(autouse=True, scope="session")
def _disable_events_log_writes() -> None:
    """Block ``append_event`` writes for every test by default.

    Tests that want to inspect a real file use ``monkeypatch.delenv``
    plus an explicit ``log_path`` argument; see
    ``tests/test_events_log_schema.py`` for the canonical pattern.
    """
    os.environ.setdefault("AGENT_CONFIG_NO_EVENTS_LOG", "1")


@pytest.fixture(autouse=True)
def _restore_events_log_kill_switch(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    """Re-apply the kill-switch at the start of every test.

    A previous test may have ``monkeypatch.delenv`` ed the variable;
    ``monkeypatch`` restores it after that test, but only to the value
    it had when the fixture acquired it. Force the safe default here
    so the *next* test starts from a known-clean state.
    """
    monkeypatch.setenv("AGENT_CONFIG_NO_EVENTS_LOG", "1")


def pytest_sessionfinish(session, exitstatus) -> None:  # noqa: ARG001
    """Best-effort cleanup of a stray events log file."""
    log = Path(__file__).resolve().parent.parent / "agents" / "council-events.log"
    if log.exists():
        try:
            log.unlink()
        except OSError:
            pass
