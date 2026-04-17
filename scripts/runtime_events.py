#!/usr/bin/env python3
"""
Runtime Events — structured event system for runtime execution.

Event types:
- skill_dispatched — a skill was selected for execution
- execution_started — execution began
- execution_completed — execution finished (success or failure)
- tool_accessed — an external tool was accessed
- hook_executed — a before/after hook ran
- error_occurred — a runtime error was raised
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, asdict, field
from enum import Enum
from typing import Any, Callable, Dict, List, Optional


class EventType(str, Enum):
    """Types of runtime events."""
    SKILL_DISPATCHED = "skill_dispatched"
    EXECUTION_STARTED = "execution_started"
    EXECUTION_COMPLETED = "execution_completed"
    TOOL_ACCESSED = "tool_accessed"
    HOOK_EXECUTED = "hook_executed"
    ERROR_OCCURRED = "error_occurred"


@dataclass
class RuntimeEvent:
    """Structured runtime event."""
    event_type: EventType
    skill_name: str
    timestamp: float
    data: Dict[str, Any] = field(default_factory=dict)
    duration_ms: Optional[float] = None

    def to_dict(self) -> dict:
        result = {
            "type": self.event_type.value,
            "skill": self.skill_name,
            "timestamp": self.timestamp,
        }
        if self.data:
            result["data"] = self.data
        if self.duration_ms is not None:
            result["duration_ms"] = self.duration_ms
        return result

    def to_json(self) -> str:
        return json.dumps(self.to_dict())


# Type alias for event listeners
EventListener = Callable[[RuntimeEvent], None]


class EventEmitter:
    """Emits and collects runtime events."""

    def __init__(self) -> None:
        self._events: List[RuntimeEvent] = []
        self._listeners: Dict[EventType, List[EventListener]] = {}

    def on(self, event_type: EventType, listener: EventListener) -> None:
        """Register a listener for an event type."""
        if event_type not in self._listeners:
            self._listeners[event_type] = []
        self._listeners[event_type].append(listener)

    def emit(self, event: RuntimeEvent) -> None:
        """Emit an event — stores it and notifies listeners."""
        self._events.append(event)
        for listener in self._listeners.get(event.event_type, []):
            try:
                listener(event)
            except Exception:
                pass  # Listeners must not break execution

    def get_events(self, event_type: Optional[EventType] = None) -> List[RuntimeEvent]:
        """Get collected events, optionally filtered by type."""
        if event_type is None:
            return list(self._events)
        return [e for e in self._events if e.event_type == event_type]

    def clear(self) -> None:
        """Clear all collected events."""
        self._events.clear()

    @property
    def count(self) -> int:
        return len(self._events)


def create_event(event_type: EventType, skill_name: str,
                 duration_ms: Optional[float] = None, **data: Any) -> RuntimeEvent:
    """Factory function to create events with current timestamp."""
    return RuntimeEvent(
        event_type=event_type,
        skill_name=skill_name,
        timestamp=time.time(),
        data=data,
        duration_ms=duration_ms,
    )
