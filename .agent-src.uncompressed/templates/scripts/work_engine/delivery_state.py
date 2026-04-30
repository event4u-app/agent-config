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
    ui_audit: dict[str, Any] | None = None


Step = Callable[[DeliveryState], StepResult]
"""Protocol every step handler must satisfy.

A step reads and writes ``DeliveryState`` in place; its return value
carries only the terminal ``Outcome`` and any surfaced questions.
"""


AGENT_DIRECTIVE_PREFIX = "@agent-directive:"
"""Marker that flags a ``questions[0]`` entry as agent-addressed, not user-addressed.

When a step cannot run deterministically from pure Python (edits,
subprocess calls, anything that needs tools the dispatcher doesn't
own), it returns ``BLOCKED`` with this prefix as the first entry of
``questions``. The orchestrator reads it and drives the matching
skill; the user-facing numbered options follow on subsequent lines.

The prefix is public contract: changing it breaks every agent that
has learned to recognise it. See
``agents/contexts/implement-ticket-flow.md#agent-directives``.
"""


def agent_directive(name: str, **payload: Any) -> str:
    """Format a canonical ``@agent-directive:`` line.

    ``name`` is the directive verb the agent dispatches on (for
    example ``"implement-plan"`` or ``"run-tests"``). ``payload``
    entries are rendered as ``key=value`` pairs on the same line, so
    the whole directive stays a single greppable string. Values are
    coerced with ``str`` — richer payloads belong on the
    ``DeliveryState`` itself, not in the directive line.
    """
    suffix = " ".join(f"{key}={value}" for key, value in payload.items())
    return (
        f"{AGENT_DIRECTIVE_PREFIX} {name} {suffix}".strip()
        if suffix
        else f"{AGENT_DIRECTIVE_PREFIX} {name}"
    )


def is_agent_directive(question: str) -> bool:
    """True when ``question`` is an agent-addressed directive line.

    Used by the orchestrator to split ``state.questions`` into the
    agent-facing directive (at most one, always at index 0) and the
    user-facing numbered options (everything else).
    """
    return isinstance(question, str) and question.lstrip().startswith(
        AGENT_DIRECTIVE_PREFIX,
    )
