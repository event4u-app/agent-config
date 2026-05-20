"""Builder for the ``trace.halt`` slot.

Reads ``state.halts[]`` (the append-only halt log persisted by
:mod:`work_engine.emitters._emit_halt`) and projects the most recent
entry into the v1 explain-trace shape: ``{reason, step, surface}``.

Returns ``None`` when the engine never halted (clean run) or when the
state file predates the halts-bearing schema (forward-compatible read:
older state files just omit the key). Free-form strings pass through
:func:`scripts._cli.explain_last.scrubber.scrub_string` so PII or
cost-metadata leakage from halt surfaces never escapes the trace.
"""
from __future__ import annotations

from typing import Any

from scripts._cli.explain_last.scrubber import scrub_string


def build(state: dict[str, Any]) -> dict[str, Any] | None:
    halts = state.get("halts") or []
    if not isinstance(halts, list) or not halts:
        return None
    last = halts[-1]
    if not isinstance(last, dict):
        return None
    reason = last.get("reason")
    if not isinstance(reason, str) or not reason:
        return None
    step = last.get("step")
    surface = last.get("surface") or []
    scrubbed_surface: list[str] = []
    if isinstance(surface, list):
        for line in surface:
            if isinstance(line, str):
                scrubbed_surface.append(scrub_string(line))
    return {
        "reason": scrub_string(reason),
        "step": scrub_string(step) if isinstance(step, str) and step else "",
        "surface": scrubbed_surface,
    }


__all__ = ["build"]
