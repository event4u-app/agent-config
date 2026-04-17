#!/usr/bin/env python3
"""
Event Schema — mandatory schema validation for all pipeline events.

Every event emitted by the pipeline MUST conform to this schema.
Invalid events are rejected at write time.
"""

from __future__ import annotations

from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional


class EventStatus(str, Enum):
    """Possible event outcomes."""
    SUCCESS = "success"
    FAILURE = "failure"
    TIMEOUT = "timeout"
    BLOCKED = "blocked"


class MandatoryEventType(str, Enum):
    """All recognized event types in the pipeline."""
    SKILL_DISPATCHED = "skill_dispatched"
    EXECUTION_COMPLETED = "execution_completed"
    TOOL_ACCESSED = "tool_accessed"
    ERROR_OCCURRED = "error_occurred"


@dataclass
class PipelineEvent:
    """Mandatory event schema. All pipeline events conform to this shape."""
    timestamp: str
    event_type: str
    skill_name: str
    execution_type: str  # manual, assisted, automated
    outcome: str  # success, failure, timeout, blocked
    duration_ms: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to serializable dict."""
        return {k: v for k, v in asdict(self).items() if v is not None}


def create_pipeline_event(
    event_type: str,
    skill_name: str,
    execution_type: str = "unknown",
    outcome: str = "success",
    duration_ms: Optional[float] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> PipelineEvent:
    """Create a validated pipeline event."""
    return PipelineEvent(
        timestamp=datetime.now(timezone.utc).isoformat(),
        event_type=event_type,
        skill_name=skill_name,
        execution_type=execution_type,
        outcome=outcome,
        duration_ms=duration_ms,
        metadata=metadata or {},
    )


class ValidationError(Exception):
    """Raised when an event fails schema validation."""
    pass


REQUIRED_FIELDS = {"timestamp", "event_type", "skill_name", "execution_type", "outcome"}


def validate_event(event: Dict[str, Any]) -> List[str]:
    """Validate an event dict against the mandatory schema.

    Returns a list of error messages (empty = valid).
    """
    errors = []
    for field_name in REQUIRED_FIELDS:
        if field_name not in event or event[field_name] is None:
            errors.append(f"Missing required field: {field_name}")
        elif not isinstance(event[field_name], str):
            errors.append(f"Field {field_name} must be a string, got {type(event[field_name]).__name__}")

    if "duration_ms" in event and event["duration_ms"] is not None:
        if not isinstance(event["duration_ms"], (int, float)):
            errors.append(f"duration_ms must be a number, got {type(event['duration_ms']).__name__}")

    if "metadata" in event and event["metadata"] is not None:
        if not isinstance(event["metadata"], dict):
            errors.append(f"metadata must be a dict, got {type(event['metadata']).__name__}")

    return errors


def validate_or_raise(event: Dict[str, Any]) -> None:
    """Validate an event dict, raising ValidationError on failure."""
    errors = validate_event(event)
    if errors:
        raise ValidationError(f"Event validation failed: {'; '.join(errors)}")
