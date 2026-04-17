#!/usr/bin/env python3
"""
Runtime Metrics — counters and timers for runtime execution tracking.

Provides:
- Counters for skill dispatches, executions, errors
- Timers for execution duration
- Aggregation and reporting
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class MetricPoint:
    """Single metric measurement."""
    name: str
    value: float
    timestamp: float
    labels: Dict[str, str] = field(default_factory=dict)


class Counter:
    """Monotonically increasing counter."""

    def __init__(self, name: str) -> None:
        self.name = name
        self._counts: Dict[str, int] = {}

    def increment(self, label: str = "default", amount: int = 1) -> None:
        self._counts[label] = self._counts.get(label, 0) + amount

    def get(self, label: str = "default") -> int:
        return self._counts.get(label, 0)

    def total(self) -> int:
        return sum(self._counts.values())

    def to_dict(self) -> dict:
        return {"name": self.name, "counts": dict(self._counts), "total": self.total()}


class Timer:
    """Duration tracker."""

    def __init__(self, name: str) -> None:
        self.name = name
        self._durations: Dict[str, List[float]] = {}

    def record(self, duration_ms: float, label: str = "default") -> None:
        if label not in self._durations:
            self._durations[label] = []
        self._durations[label].append(duration_ms)

    def avg(self, label: str = "default") -> float:
        durations = self._durations.get(label, [])
        return sum(durations) / len(durations) if durations else 0.0

    def max(self, label: str = "default") -> float:
        durations = self._durations.get(label, [])
        return max(durations) if durations else 0.0

    def min(self, label: str = "default") -> float:
        durations = self._durations.get(label, [])
        return min(durations) if durations else 0.0

    def count(self, label: str = "default") -> int:
        return len(self._durations.get(label, []))

    def to_dict(self) -> dict:
        result: Dict[str, dict] = {}
        for label, durations in self._durations.items():
            result[label] = {
                "count": len(durations),
                "avg_ms": round(sum(durations) / len(durations), 2) if durations else 0,
                "min_ms": round(min(durations), 2) if durations else 0,
                "max_ms": round(max(durations), 2) if durations else 0,
            }
        return {"name": self.name, "timers": result}


class MetricsCollector:
    """Collects and reports runtime metrics."""

    def __init__(self) -> None:
        self.dispatches = Counter("skill_dispatches")
        self.executions = Counter("skill_executions")
        self.errors = Counter("runtime_errors")
        self.blocked = Counter("blocked_executions")
        self.execution_time = Timer("execution_duration")
        self.hook_time = Timer("hook_duration")

    def report(self) -> dict:
        return {
            "dispatches": self.dispatches.to_dict(),
            "executions": self.executions.to_dict(),
            "errors": self.errors.to_dict(),
            "blocked": self.blocked.to_dict(),
            "execution_time": self.execution_time.to_dict(),
            "hook_time": self.hook_time.to_dict(),
        }

    def report_json(self) -> str:
        return json.dumps(self.report(), indent=2)

    def summary(self) -> str:
        return (
            f"Dispatches: {self.dispatches.total()} | "
            f"Executions: {self.executions.total()} | "
            f"Errors: {self.errors.total()} | "
            f"Blocked: {self.blocked.total()}"
        )
