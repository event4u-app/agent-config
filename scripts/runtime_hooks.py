#!/usr/bin/env python3
"""
Runtime Hooks — before/after execution hooks with timeout enforcement.

Provides:
- Before-execution hooks (validation, environment check)
- After-execution hooks (verification, cleanup)
- Timeout enforcement wrapper
- Hook registration and execution

No real execution happens in this phase — hooks prepare and validate.
"""

from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional

from runtime_errors import (
    ErrorCategory,
    ErrorReport,
    ErrorSeverity,
    RuntimeError,
)


@dataclass
class HookResult:
    """Result of a single hook execution."""
    hook_name: str
    phase: str  # "before" or "after"
    success: bool
    duration_ms: float
    message: Optional[str] = None
    error: Optional[RuntimeError] = None


@dataclass
class HookChainResult:
    """Result of executing all hooks in a chain."""
    results: List[HookResult] = field(default_factory=list)
    total_duration_ms: float = 0.0

    @property
    def all_passed(self) -> bool:
        return all(r.success for r in self.results)

    @property
    def errors(self) -> List[RuntimeError]:
        return [r.error for r in self.results if r.error is not None]

    def to_error_report(self, skill_name: str) -> ErrorReport:
        return ErrorReport(errors=self.errors)


# Type alias for hook functions
HookFn = Callable[..., HookResult]


class RuntimeHookRegistry:
    """Registry for before/after execution hooks."""

    def __init__(self) -> None:
        self._before_hooks: List[HookFn] = []
        self._after_hooks: List[HookFn] = []

    def register_before(self, hook: HookFn) -> None:
        self._before_hooks.append(hook)

    def register_after(self, hook: HookFn) -> None:
        self._after_hooks.append(hook)

    def run_before(self, skill_name: str, **context: Any) -> HookChainResult:
        return self._run_chain(self._before_hooks, "before", skill_name, **context)

    def run_after(self, skill_name: str, **context: Any) -> HookChainResult:
        return self._run_chain(self._after_hooks, "after", skill_name, **context)

    def _run_chain(self, hooks: List[HookFn], phase: str,
                   skill_name: str, **context: Any) -> HookChainResult:
        results: List[HookResult] = []
        total_start = time.monotonic()

        for hook in hooks:
            start = time.monotonic()
            try:
                result = hook(skill_name=skill_name, **context)
                result.duration_ms = (time.monotonic() - start) * 1000
                results.append(result)
                # Stop chain on failure for before hooks
                if phase == "before" and not result.success:
                    break
            except Exception as e:
                duration = (time.monotonic() - start) * 1000
                error = RuntimeError(
                    category=ErrorCategory.UNKNOWN,
                    severity=ErrorSeverity.ERROR,
                    code="hook_exception",
                    message=f"Hook raised exception: {e}",
                    skill_name=skill_name,
                )
                results.append(HookResult(
                    hook_name=hook.__name__,
                    phase=phase,
                    success=False,
                    duration_ms=duration,
                    message=str(e),
                    error=error,
                ))
                if phase == "before":
                    break

        total_duration = (time.monotonic() - total_start) * 1000
        return HookChainResult(results=results, total_duration_ms=total_duration)


def enforce_timeout(timeout_seconds: int, skill_name: str) -> Optional[RuntimeError]:
    """Create a timeout error if timeout is exceeded.

    Note: In this phase, this is a helper for checking elapsed time.
    Real timeout enforcement (e.g., signal-based) comes in a future phase.
    """
    if timeout_seconds <= 0:
        return RuntimeError(
            category=ErrorCategory.CONFIGURATION,
            severity=ErrorSeverity.WARNING,
            code="invalid_timeout",
            message=f"Invalid timeout value: {timeout_seconds}s",
            skill_name=skill_name,
        )
    return None


# --- Built-in hooks ---

def hook_check_handler(skill_name: str, handler: str = "none", **_: Any) -> HookResult:
    """Before hook: verify handler is supported."""
    from runtime_registry import VALID_EXECUTION_HANDLERS
    valid = handler in VALID_EXECUTION_HANDLERS
    return HookResult(
        hook_name="check_handler",
        phase="before",
        success=valid,
        duration_ms=0,
        message=None if valid else f"Unsupported handler: {handler}",
        error=None if valid else RuntimeError(
            category=ErrorCategory.CONFIGURATION,
            severity=ErrorSeverity.FATAL,
            code="unsupported_handler",
            message=f"Handler '{handler}' is not supported",
            skill_name=skill_name,
        ),
    )
