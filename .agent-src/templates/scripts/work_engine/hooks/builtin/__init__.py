"""Concrete observability hooks shipped with the engine.

Phase 4 hooks: low-risk, default-off, observe-only. They are registered
by ``cli._build_hook_registry`` only when explicitly enabled in
``.agent-settings.yml`` (Phase 6 wires the settings → registry path).

Each hook is a small class exposing a ``register(registry)`` method so
the registry stays the single source of truth for event → callback
wiring. None of these hooks mutate engine state; failures surface as
:class:`HookError` (non-fatal, the runner warns and continues).
"""
from __future__ import annotations

from .chat_history_append import ChatHistoryAppendHook
from .chat_history_halt_append import ChatHistoryHaltAppendHook
from .chat_history_heartbeat import ChatHistoryHeartbeatHook
from .chat_history_turn_check import ChatHistoryTurnCheckHook
from .decision_trace import DecisionTraceHook
from .directive_set_guard import DirectiveSetGuardHook
from .halt_surface_audit import HaltSurfaceAuditHook
from .memory_visibility import MemoryVisibilityHook
from .state_shape_validation import StateShapeValidationHook
from .trace import TraceHook

__all__ = [
    "ChatHistoryAppendHook",
    "ChatHistoryHaltAppendHook",
    "ChatHistoryHeartbeatHook",
    "ChatHistoryTurnCheckHook",
    "DecisionTraceHook",
    "DirectiveSetGuardHook",
    "HaltSurfaceAuditHook",
    "MemoryVisibilityHook",
    "StateShapeValidationHook",
    "TraceHook",
]
