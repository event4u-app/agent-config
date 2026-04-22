"""Phase 0 spike — Python DeliveryState + Step protocol.

Throwaway prototype. Lives only on the spike branch. Not shipped.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable


class Outcome(str, Enum):
    SUCCESS = "success"
    BLOCKED = "blocked"
    PARTIAL = "partial"


@dataclass
class StepResult:
    """Return value of a step. `outcome` drives the dispatcher."""
    outcome: Outcome
    questions: list[str] = field(default_factory=list)
    message: str = ""


@dataclass
class DeliveryState:
    """The only object shared between steps. No hidden state."""
    ticket: dict[str, Any]
    persona: str = "senior-engineer"
    memory: list[dict[str, Any]] = field(default_factory=list)
    plan: Any = None
    changes: list[dict[str, Any]] = field(default_factory=list)
    tests: Any = None
    verify: Any = None
    outcomes: dict[str, str] = field(default_factory=dict)
    questions: list[str] = field(default_factory=list)
    report: str = ""


Step = Callable[[DeliveryState], StepResult]
