"""Render the ``Assumptions`` section."""
from __future__ import annotations

from typing import Any


def render(trace: dict[str, Any]) -> str:
    out = ["## Assumptions", ""]
    items = trace.get("assumptions") or []
    if not items:
        out.append("- (none captured)")
        out.append("")
        return "\n".join(out)
    for item in items:
        ident = item.get("id") or "(unknown)"
        accepted = item.get("accepted", True)
        source = item.get("source") or "unspecified"
        marker = "[x]" if accepted else "[ ]"
        out.append(f"- {marker} {ident}  — recorded in step `{source}`")
    out.append("")
    return "\n".join(out)
