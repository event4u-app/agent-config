"""/implement-ticket orchestrator — linear step dispatcher.

Shipped to consumer projects via the installer. Consumer code imports
``DeliveryState``, ``dispatch``, and the ``Outcome`` enum from this
package; step implementations land in Phase 2 under
``.agent-src.uncompressed/skills/implement-ticket/`` and plug into the
``Step`` protocol exposed here.

Architectural constraints (from
``agents/contexts/adr-implement-ticket-runtime.md`` and
``agents/contexts/implement-ticket-flow.md``):

- Runtime is Python 3.10+.
- The dispatcher is linear, not a DAG. Eight fixed steps, fixed order.
- ``DeliveryState`` is the only object shared between steps — no
  hidden state, no side channels.
- Every step terminates in ``success | blocked | partial``. ``blocked``
  and ``partial`` halt the flow and surface numbered questions.
- The dispatcher never calls git, writes commits, or opens PRs.
"""
from __future__ import annotations

from .delivery_state import (
    AGENT_DIRECTIVE_PREFIX,
    DeliveryState,
    Outcome,
    Step,
    StepResult,
    agent_directive,
    is_agent_directive,
)
from .dispatcher import STEP_ORDER, dispatch

__all__ = [
    "AGENT_DIRECTIVE_PREFIX",
    "DeliveryState",
    "Outcome",
    "STEP_ORDER",
    "Step",
    "StepResult",
    "agent_directive",
    "dispatch",
    "is_agent_directive",
]
