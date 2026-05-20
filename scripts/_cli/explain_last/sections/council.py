"""Render the ``Council`` section."""
from __future__ import annotations

from typing import Any


def render(trace: dict[str, Any]) -> str:
    out = ["## Council", ""]
    members = trace.get("council") or []
    if not members:
        out.append("(none recorded for this run)")
        out.append("")
        return "\n".join(out)
    for member in members:
        mid = member.get("member_id") or "(unknown)"
        verdict = member.get("verdict") or "(no verdict)"
        out.append(f"### {mid}")
        out.append("")
        out.append(f"> {verdict}")
        citations = member.get("citations") or []
        if citations:
            out.append("")
            out.append("Citations:")
            for cite in citations:
                out.append(f"- {cite}")
        out.append("")
    return "\n".join(out)
