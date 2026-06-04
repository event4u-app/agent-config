"""Render the ``Why halted?`` section.

Surfaces ``trace.halt`` per the v1 explain-trace schema. Null halt →
emits the *(clean run — no halt recorded)* placeholder so renders stay
byte-deterministic even when the engine succeeded.
"""
from __future__ import annotations

from typing import Any


def render(trace: dict[str, Any]) -> str:
    out = ["## Why halted?", ""]
    halt = trace.get("halt")
    if not halt:
        out.append("(clean run — no halt recorded)")
        out.append("")
        return "\n".join(out)
    reason = halt.get("reason") or "(unknown)"
    step = halt.get("step") or "(unspecified)"
    out.append(f"- **Reason:** `{reason}`")
    out.append(f"- **Hook event:** `{step}`")
    surface = halt.get("surface") or []
    if surface:
        out.append("")
        out.append("Surface emitted to the user:")
        out.append("")
        for line in surface:
            out.append(f"  {line}")
    out.append("")
    return "\n".join(out)
