"""Lifecycle-hook registry assembly for the CLI entry point.

Extracted from ``cli.py`` in P2.3 of
``road-to-post-pr29-optimize.md``. Owns nothing but
``_build_hook_registry`` and its chat-history helper. The function
remains re-exported from ``work_engine.cli`` so the existing test
import (``from work_engine.cli import _build_hook_registry``) and
monkeypatch target (``work_engine.cli._build_hook_registry``) keep
working without a breaking change.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from .hooks import HookRegistry
from .hooks.builtin import (
    ChatHistoryAppendHook,
    ChatHistoryHaltAppendHook,
    DecisionTraceHook,
    DirectiveSetGuardHook,
    HaltSurfaceAuditHook,
    MemoryVisibilityHook,
    StateShapeValidationHook,
    TraceHook,
)
from .hooks.settings import HookSettings, load_hook_settings


def _build_hook_registry(args: argparse.Namespace) -> HookRegistry:
    """Build the CLI-side :class:`HookRegistry` for one ``main()`` run.

    Reads ``hooks.*`` from ``.agent-settings.yml`` and registers the
    enabled hooks. The master switch ``hooks.enabled`` defaults to
    ``False`` when the block (or the file) is missing — the registry
    stays empty and golden replay flows are byte-stable.

    ``--no-hooks`` on the CLI forces an empty registry regardless of
    settings, which is the explicit escape hatch golden-replay test
    harnesses can use.
    """
    registry = HookRegistry()
    if getattr(args, "no_hooks", False):
        return registry

    settings_path = getattr(args, "hooks_config", None)
    settings = load_hook_settings(settings_path)
    if not settings.enabled:
        return registry

    if settings.trace:
        TraceHook().register(registry)
    if settings.halt_surface_audit:
        HaltSurfaceAuditHook().register(registry)
    if settings.state_shape_validation:
        StateShapeValidationHook().register(registry)
    if settings.directive_set_guard:
        DirectiveSetGuardHook().register(registry)
    if settings.decision_trace:
        DecisionTraceHook().register(registry)
    if settings.memory_visibility:
        MemoryVisibilityHook(
            cost_profile=settings.cost_profile,
            visibility_off=settings.memory_visibility_off,
        ).register(registry)
    if settings.chat_history_enabled:
        _register_chat_history_hooks(registry, settings)

    return registry


def _register_chat_history_hooks(
    registry: HookRegistry, settings: HookSettings,
) -> None:
    """Register the structural chat-history hooks bound to the configured script.

    Hook-only contract (post road-to-chat-history-hook-only): only the
    append + halt-append hooks remain; cooperative ``turn-check`` /
    ``heartbeat`` hooks were removed when the cooperative always-rules
    were retired.
    """
    script = Path(settings.chat_history_script)
    ChatHistoryAppendHook(script).register(registry)
    ChatHistoryHaltAppendHook(script).register(registry)


__all__ = ["_build_hook_registry", "_register_chat_history_hooks"]
