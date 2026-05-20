"""Render the ``Why this profile / preset?`` knob table."""
from __future__ import annotations

from typing import Any


def render(trace: dict[str, Any]) -> str:
    out = ["## Why this profile / preset?", ""]
    inputs = trace.get("inputs")
    if not inputs:
        out.append("- (none) — settings could not be resolved")
        out.append("")
        return "\n".join(out)
    sources = inputs.get("source_per_knob") or {}
    rows = [
        ("profile.id", inputs.get("profile"), sources.get("profile")),
        ("preset.id", inputs.get("preset"), sources.get("preset")),
        ("cost_profile", inputs.get("cost_profile"), sources.get("cost_profile")),
    ]
    out.append("| knob | value | source |")
    out.append("|---|---|---|")
    for knob, value, source in rows:
        value_str = "(none)" if value is None else str(value)
        source_str = source or "default"
        out.append(f"| {knob} | {value_str} | {source_str} |")
    out.append("")
    return "\n".join(out)
