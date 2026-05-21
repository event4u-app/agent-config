"""``DirectiveSetGuardHook`` — catch CLI / state directive-set drift.

Fires on :data:`HookEvent.BEFORE_DISPATCH`. Compares the resolved
``set_name`` (the directive bundle the CLI just loaded) against the
``directive_set`` field on the persisted ``WorkState``. Mismatch →
:class:`HookError` (non-fatal: the runner warns), so a flow that
silently re-dispatches under a different set surfaces the drift before
any step runs.

The guard is read-only. It does not rewrite ``state.directive_set``;
fixing the drift is the user's call (typically a ``/mode`` switch or a
fresh state file).
"""
from __future__ import annotations

from ..context import HookContext
from ..events import HookEvent
from ..exceptions import HookError
from ..registry import HookRegistry


class DirectiveSetGuardHook:
    """Asserts ``set_name`` matches ``state.directive_set`` on dispatch."""

    def register(self, registry: HookRegistry) -> None:
        """Register on :data:`HookEvent.BEFORE_DISPATCH`."""
        registry.register(HookEvent.BEFORE_DISPATCH, self._guard)

    def _guard(self, ctx: HookContext) -> None:
        set_name = ctx.set_name
        work = ctx.work
        if set_name is None or work is None:
            # ``before_dispatch`` always carries both refs per the
            # context surface; missing means a hook-bug, not drift.
            raise HookError(
                "directive-set guard: missing set_name or work on "
                f"before_dispatch (set_name={set_name!r}, work={work!r})",
            )

        persisted = getattr(work, "directive_set", None)
        if persisted is None:
            # Legacy v0 envelopes have no ``directive_set`` field;
            # the guard is a no-op for those — nothing to compare.
            return

        if persisted != set_name:
            raise HookError(
                "directive-set drift: CLI resolved "
                f"{set_name!r} but state carries {persisted!r}",
            )


__all__ = ["DirectiveSetGuardHook"]
