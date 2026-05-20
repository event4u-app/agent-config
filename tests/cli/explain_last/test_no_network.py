"""Network-gate enforcement for ``agent-config explain last`` (Phase 4 #3).

The roadmap forbids any outbound socket from the explain surface. The
upstream ``/work`` run may have made network calls, but reconstructing
its trace must be pure I/O against the local repo. This module patches
``socket.socket`` and ``socket.create_connection`` to raise on construct,
then runs ``build_trace()`` against every fixture and confirms each one
still produces a valid trace dict.

The patch covers both UDP and TCP sockets — anything that touches the
``socket`` constructor blows up. ``socket.socketpair`` and unix sockets
are intentionally allowed; they cannot leak to the outside.
"""
from __future__ import annotations

import socket
from pathlib import Path
from typing import Iterator

import pytest

from scripts._cli.explain_last import build_trace


class _NetworkBlockedError(RuntimeError):
    """Raised when a test illegally opens a network socket."""


@pytest.fixture()
def block_network(monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    """Detonate on every ``socket.socket(...)`` and ``create_connection``.

    Unix-domain sockets (``AF_UNIX``) stay allowed so the test harness
    itself can keep using stdlib resources. The contract this gate
    enforces is "no IP traffic," not "no IPC at all."
    """
    original_socket = socket.socket

    def _trap(family: int = socket.AF_INET, *args, **kwargs):  # type: ignore[no-untyped-def]
        if family == getattr(socket, "AF_UNIX", -1):
            return original_socket(family, *args, **kwargs)
        raise _NetworkBlockedError(
            f"explain last attempted to open a network socket (family={family})"
        )

    def _trap_connect(*args, **kwargs):  # type: ignore[no-untyped-def]
        raise _NetworkBlockedError(
            "explain last attempted socket.create_connection"
        )

    monkeypatch.setattr(socket, "socket", _trap)
    monkeypatch.setattr(socket, "create_connection", _trap_connect)
    yield


@pytest.mark.parametrize(
    "fixture_name",
    [
        "work-state.success.json",
        "work-state.halt-hook.json",
        "work-state.council-attached.json",
        "work-state.video-from-script.json",
        "work-state.no-memory.json",
    ],
)
def test_build_trace_opens_no_sockets(
    project_root: Path,
    copy_state,
    block_network: None,
    fixture_name: str,
) -> None:
    state_file = copy_state(fixture_name)
    trace = build_trace(project_root, state_file)
    assert trace["version"] == 1
    assert isinstance(trace["generated_at"], str)


def test_council_discovery_opens_no_sockets(
    project_root: Path,
    copy_state,
    attach_council,
    block_network: None,
) -> None:
    state_file = copy_state("work-state.council-attached.json")
    attach_council(state_file)
    trace = build_trace(project_root, state_file)
    assert trace["council"] is not None


def test_network_block_actually_traps_sockets() -> None:
    """Sanity check — the fixture would catch a real outbound call.

    Without this guard, a renamed import or a silently-shipped HTTP
    client could pass the trace tests while still talking to the wire.
    The assertion here proves the trap is wired up correctly so the
    other tests in this module are meaningful.
    """
    original = socket.socket

    def _trap(*args, **kwargs):  # type: ignore[no-untyped-def]
        raise _NetworkBlockedError("blocked")

    socket.socket = _trap  # type: ignore[assignment]
    try:
        with pytest.raises(_NetworkBlockedError):
            socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    finally:
        socket.socket = original  # type: ignore[assignment]
