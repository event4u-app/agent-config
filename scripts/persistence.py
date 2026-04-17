#!/usr/bin/env python3
"""
Persistence — file-based storage for metrics, feedback, and audit data.

Data is stored as JSON in agents/reports/. Each file appends entries,
never overwrites. The agent_settings cost_profile controls what persists.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from event_schema import validate_or_raise, PipelineEvent


REPORTS_DIR = "agents/reports"


def _ensure_dir(root: Path) -> Path:
    """Ensure the reports directory exists."""
    reports = root / REPORTS_DIR
    reports.mkdir(parents=True, exist_ok=True)
    return reports


def _load_json(filepath: Path) -> List[Dict[str, Any]]:
    """Load a JSON array from file. Returns empty list if file doesn't exist."""
    if not filepath.exists():
        return []
    try:
        with open(filepath, "r") as f:
            data = json.load(f)
            return data if isinstance(data, list) else [data]
    except (json.JSONDecodeError, OSError):
        return []


def _save_json(filepath: Path, data: List[Dict[str, Any]]) -> None:
    """Save a JSON array to file."""
    with open(filepath, "w") as f:
        json.dump(data, f, indent=2, default=str)


def save_events(events: List[PipelineEvent], root: Path) -> int:
    """Persist pipeline events to agents/reports/metrics.json.

    Each event is validated before writing. Returns count of saved events.
    """
    reports = _ensure_dir(root)
    filepath = reports / "metrics.json"

    existing = _load_json(filepath)
    saved = 0
    for event in events:
        event_dict = event.to_dict()
        validate_or_raise(event_dict)
        existing.append(event_dict)
        saved += 1

    _save_json(filepath, existing)
    return saved


def save_feedback(outcomes: List[Dict[str, Any]], root: Path) -> int:
    """Persist feedback outcomes to agents/reports/feedback.json.

    Returns count of saved outcomes.
    """
    reports = _ensure_dir(root)
    filepath = reports / "feedback.json"

    existing = _load_json(filepath)
    for outcome in outcomes:
        outcome["persisted_at"] = datetime.now(timezone.utc).isoformat()
        existing.append(outcome)

    _save_json(filepath, existing)
    return len(outcomes)


def save_tool_audit(entries: List[Dict[str, Any]], root: Path) -> int:
    """Persist tool audit entries to agents/reports/tool-audit.json.

    Returns count of saved entries.
    """
    reports = _ensure_dir(root)
    filepath = reports / "tool-audit.json"

    existing = _load_json(filepath)
    for entry in entries:
        entry["persisted_at"] = datetime.now(timezone.utc).isoformat()
        existing.append(entry)

    _save_json(filepath, existing)
    return len(entries)


def load_metrics(root: Path) -> List[Dict[str, Any]]:
    """Load persisted metrics events."""
    return _load_json(root / REPORTS_DIR / "metrics.json")


def load_feedback(root: Path) -> List[Dict[str, Any]]:
    """Load persisted feedback outcomes."""
    return _load_json(root / REPORTS_DIR / "feedback.json")


def load_tool_audit(root: Path) -> List[Dict[str, Any]]:
    """Load persisted tool audit entries."""
    return _load_json(root / REPORTS_DIR / "tool-audit.json")


def clear_reports(root: Path) -> None:
    """Remove all report files (for testing)."""
    reports = root / REPORTS_DIR
    for name in ("metrics.json", "feedback.json", "tool-audit.json"):
        filepath = reports / name
        if filepath.exists():
            filepath.unlink()
