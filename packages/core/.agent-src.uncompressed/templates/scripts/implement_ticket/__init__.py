"""``implement_ticket`` — deprecated shim, retained for one release.

The engine moved to :mod:`work_engine` in R1 Phase 3. This module
re-exports the public surface so existing imports keep working, but
emits :class:`DeprecationWarning` on import. The Golden-Transcript
freeze-guard pins ``./agent-config implement-ticket`` against the
locked baseline; the shim keeps that path byte-stable while internal
callers migrate to ``work_engine``.

Remove after the next public release of this package.
"""
from __future__ import annotations

import sys as _sys
import warnings as _warnings

_warnings.warn(
    "implement_ticket has moved to work_engine; importing implement_ticket "
    "is deprecated and will be removed in a future release. Update imports "
    "to `from work_engine import …`.",
    DeprecationWarning,
    stacklevel=2,
)

# Register submodule aliases so `from implement_ticket.steps.plan import …`
# and friends keep resolving to the work_engine implementation. The legacy
# package no longer ships these submodules on disk; sys.modules entries
# keep dotted-path imports working until the shim is removed.
import work_engine as _we_pkg  # noqa: E402
import work_engine.cli as _we_cli  # noqa: E402
import work_engine.delivery_state as _we_delivery_state  # noqa: E402
import work_engine.dispatcher as _we_dispatcher  # noqa: E402
import work_engine.persona_policy as _we_persona_policy  # noqa: E402
import work_engine.directives.backend as _we_steps  # noqa: E402
from work_engine.directives.backend import (  # noqa: E402
    analyze as _we_step_analyze,
    implement as _we_step_implement,
    memory as _we_step_memory,
    plan as _we_step_plan,
    refine as _we_step_refine,
    report as _we_step_report,
    test as _we_step_test,
    verify as _we_step_verify,
)

_sys.modules.setdefault("implement_ticket.cli", _we_cli)
_sys.modules.setdefault("implement_ticket.delivery_state", _we_delivery_state)
_sys.modules.setdefault("implement_ticket.dispatcher", _we_dispatcher)
_sys.modules.setdefault("implement_ticket.persona_policy", _we_persona_policy)
_sys.modules.setdefault("implement_ticket.steps", _we_steps)
_sys.modules.setdefault("implement_ticket.steps.analyze", _we_step_analyze)
_sys.modules.setdefault("implement_ticket.steps.implement", _we_step_implement)
_sys.modules.setdefault("implement_ticket.steps.memory", _we_step_memory)
_sys.modules.setdefault("implement_ticket.steps.plan", _we_step_plan)
_sys.modules.setdefault("implement_ticket.steps.refine", _we_step_refine)
_sys.modules.setdefault("implement_ticket.steps.report", _we_step_report)
_sys.modules.setdefault("implement_ticket.steps.test", _we_step_test)
_sys.modules.setdefault("implement_ticket.steps.verify", _we_step_verify)

from work_engine import (  # noqa: E402,F401  — re-export for backwards compat
    AGENT_DIRECTIVE_PREFIX,
    DEFAULT_PERSONA,
    DEFAULT_STATE_FILE,
    DeliveryState,
    Outcome,
    PersonaPolicy,
    STEP_ORDER,
    Step,
    StepResult,
    agent_directive,
    dispatch,
    is_agent_directive,
    known_personas,
    main,
    resolve_policy,
)

__all__ = [
    "AGENT_DIRECTIVE_PREFIX",
    "DEFAULT_PERSONA",
    "DEFAULT_STATE_FILE",
    "DeliveryState",
    "Outcome",
    "PersonaPolicy",
    "STEP_ORDER",
    "Step",
    "StepResult",
    "agent_directive",
    "dispatch",
    "is_agent_directive",
    "known_personas",
    "main",
    "resolve_policy",
]
