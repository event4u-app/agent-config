"""Render the ``Active pack`` section (Phase 4-discovery aware)."""
from __future__ import annotations

from typing import Any


def render(trace: dict[str, Any]) -> str:
    pack = trace.get("pack")
    if not pack:
        return ""
    pack_id = pack.get("id") or "(unknown)"
    reason = pack.get("reason") or ""
    out = ["## Active pack", ""]
    out.append(f"- {pack_id} — {reason}" if reason else f"- {pack_id}")
    out.append("")
    return "\n".join(out)
