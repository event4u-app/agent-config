"""Render the ``Why this provider?`` section.

Only emitted when ``trace.provider`` is non-null (the v1 schema bounds
this to ``subject == "video"`` runs where the engine wrote a provider
selection record). All other runs render an empty string so the
orchestrator skips the section without leaving a stray heading.
"""
from __future__ import annotations

from typing import Any


def render(trace: dict[str, Any]) -> str:
    provider = trace.get("provider")
    if not provider:
        return ""
    pid = provider.get("id") or "(unknown)"
    reason = provider.get("selection_reason") or "(no reason recorded)"
    out = [
        "## Why this provider?",
        "",
        f"- **Provider:** `{pid}`",
        f"- **Selection reason:** {reason}",
        "",
    ]
    return "\n".join(out)
