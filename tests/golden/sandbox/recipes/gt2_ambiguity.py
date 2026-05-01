"""GT-2 — ambiguity halt at the refine step.

Ticket ``GT-2-DIV`` has acceptance criterion #2 set to ``"tbd"``
(3 chars), which the refine gate rejects (its floor is 10 chars).
The engine therefore returns ``BLOCKED`` from the very first step
with a user-facing numbered question — there is no agent directive
at this halt, so the recipe never resolves it. The capture stops
after one cycle and locks the refine ambiguity surface.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

META = {
    "gt_id": "GT-2",
    "ticket_relpath": "tickets/gt-2-ambiguity.json",
    "persona": None,
    "cycle_cap": 1,
}


def build_recipe(workspace: Path) -> dict[str, Any]:
    """Refine-ambiguity halts emit no directive — recipe stays empty.

    The runner detects ``directive is None`` and routes to the
    ``"_no_directive"`` key. Returning a recipe without that key
    triggers the ``halt_unhandled`` early-stop branch, which is
    exactly what we want for GT-2: the cycle records the ambiguity
    surface and the capture ends.
    """
    return {}


__all__ = ["META", "build_recipe"]
