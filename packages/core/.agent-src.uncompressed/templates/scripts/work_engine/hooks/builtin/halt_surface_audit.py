"""``HaltSurfaceAuditHook`` — defense-in-depth around halt surfaces.

The dispatcher already calls ``_validate_step_result`` to reject a
``BLOCKED`` / ``PARTIAL`` outcome with no questions. This hook fires on
``on_halt`` and re-asserts the same invariant from the hook side, so a
hand-crafted handler that bypasses the validator (e.g. a future direct
``state.questions`` mutation) still surfaces a clear failure.

Pure observability: emits :class:`HookError` (non-fatal) when the
surface is empty. The runner converts it to a ``warnings.warn`` so the
violation is visible in test logs and CI.
"""
from __future__ import annotations

from ..context import HookContext
from ..events import HookEvent
from ..exceptions import HookError
from ..registry import HookRegistry


class HaltSurfaceAuditHook:
    """Asserts that every halt carries a non-empty user-facing surface."""

    def register(self, registry: HookRegistry) -> None:
        """Register on :data:`HookEvent.ON_HALT` only."""
        registry.register(HookEvent.ON_HALT, self._audit)

    def _audit(self, ctx: HookContext) -> None:
        result = ctx.result
        if result is None:
            # Hook-driven halts go through ``_hook_halt_blocked`` and
            # may not carry a ``StepResult`` — the surface lives on
            # ``state.questions`` instead. Audit that fallback too.
            questions = getattr(ctx.delivery, "questions", None)
            if not questions:
                raise HookError(
                    f"halt at step {ctx.step_name!r} surfaced no questions "
                    "(hook-driven halt with empty state.questions)",
                )
            return

        questions = getattr(result, "questions", None)
        if not questions:
            raise HookError(
                f"halt at step {ctx.step_name!r} surfaced no questions "
                "(StepResult.questions empty); the user has nothing to act on",
            )


__all__ = ["HaltSurfaceAuditHook"]
