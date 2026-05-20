"""Render the ``Why this route?`` section."""
from __future__ import annotations

from typing import Any


def render(trace: dict[str, Any]) -> str:
    out = ["## Why this route?", ""]
    route = trace.get("route")
    if not route:
        out.append("- (none) — router.json missing or unreadable")
        out.append("")
        return "\n".join(out)
    matched = route.get("matched_rules") or []
    kernel = route.get("kernel_rules") or []
    persona = route.get("persona") or "(none)"
    matched_str = ", ".join(matched) if matched else "(none)"
    out.append(f"- Active rules: {matched_str}")
    out.append(f"- Kernel rules: {len(kernel)}")
    out.append(f"- Persona: {persona}")
    out.append("")
    return "\n".join(out)
