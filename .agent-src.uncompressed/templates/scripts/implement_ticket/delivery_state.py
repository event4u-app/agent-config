"""``DeliveryState`` — the only object shared between orchestrator steps.

The shape mirrors ``agents/contexts/implement-ticket-flow.md``. No step
may invent fields not declared here; extensions require a roadmap
amendment plus a flow-contract update.

Steps return a ``StepResult`` with one of three ``Outcome`` values:

- ``SUCCESS``  — step populated its slice of ``DeliveryState`` and the
  dispatcher continues to the next step.
- ``BLOCKED``  — step hit an ambiguity it cannot resolve on its own.
  ``questions`` carries pre-formatted numbered options per the
  ``user-interaction`` rule. The dispatcher halts.
- ``PARTIAL``  — step populated its slice *and* produced open
  questions. The dispatcher halts with the same surface as BLOCKED;
  the calling orchestrator (Phase 3) decides whether to prompt the
  user to continue or stop.

``DeliveryState`` is a plain dataclass rather than a typed dict so
step handlers can rely on attribute access, defaults, and mutation
semantics without resorting to dictionary indirection.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Callable


class Outcome(str, Enum):
    """Terminal outcome of a single step.

    Subclassing ``str`` keeps JSON serialisation trivial (Outcome
    values round-trip as their string form) without hand-rolling a
    ``__str__`` override.
    """

    SUCCESS = "success"
    BLOCKED = "blocked"
    PARTIAL = "partial"


@dataclass
class StepResult:
    """Return value of a single ``Step`` invocation.

    ``questions`` is only populated for ``BLOCKED`` / ``PARTIAL``
    outcomes. Each entry is a fully-formatted numbered line so the
    dispatcher can surface them verbatim without reformatting.
    """

    outcome: Outcome
    questions: list[str] = field(default_factory=list)
    message: str = ""


@dataclass
class DeliveryState:
    """Canonical state passed between orchestrator steps.

    Field order matches the table in
    ``agents/contexts/implement-ticket-flow.md``. Mutable defaults use
    ``field(default_factory=...)`` so every instance owns its own
    containers — a single shared list across runs would be a
    cross-run contamination hazard for the metrics pipeline.
    """

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
"""Protocol every step handler must satisfy.

A step reads and writes ``DeliveryState`` in place; its return value
carries only the terminal ``Outcome`` and any surfaced questions.
"""
