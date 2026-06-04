"""Render the trace header (title + subject + started-at)."""
from __future__ import annotations

from typing import Any

_SUBJECT_LABELS = {
    "work": "/work",
    "implement-ticket": "/implement-ticket",
    "council": "/council",
    "video": "/video",
    "unknown": "(unknown)",
}


def render(trace: dict[str, Any]) -> str:
    run_id = trace.get("run_id") or "(unknown)"
    subject = trace.get("subject") or "unknown"
    label = _SUBJECT_LABELS.get(subject, subject)
    started = trace.get("generated_at") or ""
    return (
        f"# explain last — run {run_id}\n"
        f"\n"
        f"**Subject:** {label} · **Started:** {started}\n"
    )
