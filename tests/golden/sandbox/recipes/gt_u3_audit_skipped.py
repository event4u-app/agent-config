"""GT-U3 — audit-skipped rejection: gate refuses to advance on empty findings.

The companion to GT-U1's happy path. Where GT-U1 writes a populated
``state.ui_audit`` on the first audit halt and rolls forward, GT-U3
writes a *plausible-looking but structurally invalid* audit envelope
(``audit_path`` set, ``components_found`` and ``greenfield`` both
absent) and locks what the engine does in response: it keeps halting
on ``existing-ui-audit`` until the cycle cap trips.

Iron-law contract this capture pins:

- ``audit._is_populated`` validates *shape*, not just presence — a
  dict that carries ``audit_path`` but no ``components_found``,
  ``components``, or ``greenfield`` key is treated as "skill has not
  run". The recipe cannot bypass the audit gate by setting
  ``audit_path = "high_confidence"`` and walking past it.
- The audit handler is fully idempotent: every cycle that re-enters
  with the same garbage state re-emits the same ``existing-ui-audit``
  directive halt, byte-stable across the run.
- The engine never advances to ``analyze`` (design) or ``implement``
  (apply) until the audit step returns ``SUCCESS``. There is no
  side door — the dispatcher walks the slot order strictly.
- Final outcome is ``cycle_cap_reached`` with the last cycle's
  exit code surfacing the BLOCKED halt (1). Three cycles is plenty
  to demonstrate the loop without inflating transcript size.

The capture complements GT-P4 (which leaves the directive
*unhandled* — runner stops with ``halt_unhandled``) by exercising
the case where the orchestrator *does* handle the directive but
hands back a malformed envelope. Both fail closed; this one
fails closed with the recipe in the loop.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

META = {
    "gt_id": "GT-U3",
    "prompt_relpath": "prompts/gt-u3-audit-skipped.txt",
    "persona": None,
    "cycle_cap": 3,
}


def build_recipe(workspace: Path) -> dict[str, Any]:
    """Return the directive→step mapping with ``workspace`` bound in.

    Only ``existing-ui-audit`` is wired. Every other halt would mean
    the engine somehow advanced past the audit gate; the test fails
    by design if that happens (no handler → ``halt_unhandled``).
    """

    def on_existing_ui_audit(state: dict[str, Any], record) -> dict[str, Any]:
        # Plausible-looking envelope that pretends the audit ran but
        # carries none of the keys ``_is_populated`` checks for. The
        # gate must reject this on every cycle.
        state["ui_audit"] = {
            "audit_path": "high_confidence",
            "skipped_by_user": True,
        }
        record.recipe_notes.append(
            "ui_audit set with audit_path but no components_found / "
            "components / greenfield — gate must re-halt",
        )
        return state

    return {
        "existing-ui-audit": on_existing_ui_audit,
    }


__all__ = ["META", "build_recipe"]
