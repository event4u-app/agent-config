"""``work_engine.hooks`` — cross-cutting lifecycle hooks for the engine.

Phase 1 of ``agents/roadmaps/road-to-work-engine-hooks.md`` ships the
primitives only. The dispatcher and CLI are not yet instrumented;
golden tests must remain byte-identical until Phase 2 / Phase 3 land.

Public surface:

- :class:`HookEvent` — ten lifecycle events, two layers.
- :class:`HookContext` — per-event payload.
- :class:`HookError` / :class:`HookHalt` — three-tier error contract.
- :class:`HookRegistry` — insertion-ordered event \u2192 callbacks map.
- :class:`HookRunner` — single emit point, owns the error contract.

The principle is documented in
``agents/roadmaps/road-to-work-engine-hooks.md`` § Underlying
principle: agent hooks are emulated by moving lifecycle ownership
from the agent into the work engine. The engine owns boundaries.
"""
from __future__ import annotations

from .builtin import (
    ChatHistoryAppendHook,
    ChatHistoryHaltAppendHook,
    ChatHistoryHeartbeatHook,
    ChatHistoryTurnCheckHook,
    DirectiveSetGuardHook,
    HaltSurfaceAuditHook,
    StateShapeValidationHook,
    TraceHook,
)
from .context import HookContext
from .events import HookEvent
from .exceptions import HookError, HookHalt
from .registry import HookCallback, HookRegistry
from .runner import HookRunner

__all__ = [
    "ChatHistoryAppendHook",
    "ChatHistoryHaltAppendHook",
    "ChatHistoryHeartbeatHook",
    "ChatHistoryTurnCheckHook",
    "DirectiveSetGuardHook",
    "HaltSurfaceAuditHook",
    "HookCallback",
    "HookContext",
    "HookError",
    "HookEvent",
    "HookHalt",
    "HookRegistry",
    "HookRunner",
    "StateShapeValidationHook",
    "TraceHook",
]
