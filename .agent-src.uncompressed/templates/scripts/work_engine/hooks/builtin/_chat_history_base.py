"""Shared plumbing for chat-history hooks.

Subprocess-driven so the work-engine package stays decoupled from
``scripts/chat_history.py``'s internals. The ``runner`` injection
point is the test seam — production passes ``subprocess.run``,
tests pass a fake.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from typing import Callable, Sequence

ProcessRunner = Callable[[Sequence[str]], "subprocess.CompletedProcess[str]"]
"""Callable that runs a subprocess. Production default: ``_default_runner``."""

EXIT_OK = 0
EXIT_MISSING = 10
EXIT_FOREIGN = 11
EXIT_RETURNING = 12


def _default_runner(cmd: Sequence[str]) -> "subprocess.CompletedProcess[str]":
    return subprocess.run(list(cmd), capture_output=True, text=True, check=False)


class _ChatHistoryHookBase:
    """Shared plumbing — script path and runner.

    Schema v4 derives session attribution from the platform ``session_id``
    (passed by the platform-hook dispatcher), not from a derived
    first-user-msg. work-engine internal hooks have no platform session
    in scope, so they omit ``--session-id`` and entries land in the
    ``<unknown>`` session bucket.
    """

    def __init__(
        self,
        script_path: Path,
        *,
        runner: ProcessRunner | None = None,
    ) -> None:
        self.script_path = Path(script_path)
        self._runner = runner or _default_runner

    def _invoke(self, *args: str) -> "subprocess.CompletedProcess[str]":
        cmd = [sys.executable, str(self.script_path), *args]
        return self._runner(cmd)


__all__ = [
    "EXIT_FOREIGN",
    "EXIT_MISSING",
    "EXIT_OK",
    "EXIT_RETURNING",
    "ProcessRunner",
    "_ChatHistoryHookBase",
]
