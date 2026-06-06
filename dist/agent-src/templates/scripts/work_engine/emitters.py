"""Stdout / stderr emitters for the CLI entry point.

Extracted from ``cli.py`` in P2.3 of
``road-to-post-pr29-optimize.md``. Holds the two output helpers that
shape the wire surface of ``main()``: the SUCCESS/halt branch printed
on stdout, and the lifecycle-hook halt surface printed on stderr.
"""
from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

from .delivery_state import Outcome
from .hooks import HookHalt
from .state import WorkState, dump


def _emit(work: WorkState, final: Outcome, halting: str | None) -> None:
    if final is Outcome.SUCCESS:
        print(work.report)
        return
    print(f"[halt] outcome={final.value} step={halting or '(none)'}")
    for line in work.questions:
        print(line)


def _emit_halt(
    halt: HookHalt,
    *,
    work: WorkState | None = None,
    state_file: Path | None = None,
    event: str | None = None,
) -> int:
    """Render a :class:`HookHalt` surface to stderr and return exit 2.

    Per the P3 halt branch table, every CLI-layer halt yields exit code
    ``2`` regardless of which event fired it. State persistence is
    governed by *where* in ``main`` the halt is detected: the call site
    decides whether ``_save`` already ran.

    When ``work`` + ``state_file`` are provided AND the state file
    already exists on disk, the halt is appended to ``work.halts[]``
    and the state is re-saved. This lets ``agent-config explain last``
    surface the halt reason later. Fresh-run halts before the first
    ``_save`` (state file absent) still leave no state on disk — the
    pre-explain-v2 contract is preserved.
    """
    if halt.surface:
        for line in halt.surface:
            print(line, file=sys.stderr)
    else:
        print(f"halt: {halt.reason}", file=sys.stderr)
    if work is not None and state_file is not None and state_file.exists():
        work.halts.append({
            "reason": halt.reason,
            "step": event or "",
            "surface": list(halt.surface),
            "timestamp": datetime.now(tz=timezone.utc).isoformat(),
        })
        try:
            dump(work, state_file)
        except Exception:  # never let halt persistence mask the halt
            pass
    return 2


__all__ = ["_emit", "_emit_halt"]
