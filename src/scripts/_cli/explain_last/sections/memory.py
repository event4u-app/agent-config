"""Render the ``Memory hits influencing this run`` section."""
from __future__ import annotations

from typing import Any


def render(trace: dict[str, Any]) -> str:
    out = ["## Memory hits influencing this run", ""]
    entries = trace.get("memory") or []
    if not entries:
        out.append("- (none)")
        out.append("")
        return "\n".join(out)
    for entry in entries:
        entry_id = entry.get("entry_id") or "(unknown)"
        score = entry.get("hit_score")
        used_in = entry.get("used_in") or "unspecified"
        score_str = f"score {score:.2f}" if isinstance(score, (int, float)) else "score n/a"
        out.append(f"- {entry_id} ({score_str}) — used in {used_in}")
    out.append("")
    return "\n".join(out)
