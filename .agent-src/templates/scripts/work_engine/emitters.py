"""Stdout / stderr emitters for the CLI entry point.

Extracted from ``cli.py`` in P2.3 of
``road-to-post-pr29-optimize.md``. Holds the two output helpers that
shape the wire surface of ``main()``: the SUCCESS/halt branch printed
on stdout, and the lifecycle-hook halt surface printed on stderr.
"""
from __future__ import annotations

import sys

from .delivery_state import Outcome
from .hooks import HookHalt
from .state import WorkState


def _emit(work: WorkState, final: Outcome, halting: str | None) -> None:
    if final is Outcome.SUCCESS:
        print(work.report)
        return
    print(f"[halt] outcome={final.value} step={halting or '(none)'}")
    for line in work.questions:
        print(line)


def _emit_halt(halt: HookHalt) -> int:
    """Render a :class:`HookHalt` surface to stderr and return exit 2.

    Per the P3 halt branch table, every CLI-layer halt yields exit code
    ``2`` regardless of which event fired it. State persistence is
    governed by *where* in ``main`` the halt is detected: the call site
    decides whether ``_save`` already ran. This helper is the single
    place that formats the surface so the wire output stays consistent.
    """
    if halt.surface:
        for line in halt.surface:
            print(line, file=sys.stderr)
    else:
        print(f"halt: {halt.reason}", file=sys.stderr)
    return 2


__all__ = ["_emit", "_emit_halt"]
