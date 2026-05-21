"""``StateShapeValidationHook`` — round-trip the v1 envelope on load and save.

Fires on :data:`HookEvent.AFTER_LOAD` and :data:`HookEvent.BEFORE_SAVE`.
For each event, serialises the live :class:`work_engine.state.WorkState`
through ``state.to_dict`` and re-validates via ``state.from_dict``. A
:class:`work_engine.state.SchemaError` from either side is reported as
a :class:`HookError` so the runner warns and continues — observability,
not a gate.

The hook only sees the post-migration v1 shape. ``_load_or_build`` owns
v0 → v1 migration; this hook is the safety net catching any drift the
migration or a hand-edited state file might have produced.
"""
from __future__ import annotations

from ..context import HookContext
from ..events import HookEvent
from ..exceptions import HookError
from ..registry import HookRegistry


class StateShapeValidationHook:
    """Round-trips the loaded ``WorkState`` against the v1 schema."""

    def register(self, registry: HookRegistry) -> None:
        """Register on AFTER_LOAD and BEFORE_SAVE."""
        registry.register(HookEvent.AFTER_LOAD, self._validate)
        registry.register(HookEvent.BEFORE_SAVE, self._validate)

    def _validate(self, ctx: HookContext) -> None:
        work = ctx.work
        if work is None:
            # Should not happen on AFTER_LOAD/BEFORE_SAVE; treat as
            # a hook-side bug rather than swallow silently.
            raise HookError(
                "state-shape validation: HookContext.work is None at "
                f"event for state_file={ctx.state_file}",
            )

        # Local imports keep the hook module import-light and avoid a
        # cycle with ``work_engine.state`` at package import time.
        from ...state import SchemaError, from_dict, to_dict  # noqa: PLC0415

        try:
            from_dict(to_dict(work))
        except SchemaError as exc:
            raise HookError(
                f"state-shape validation failed: {exc}",
            ) from exc


__all__ = ["StateShapeValidationHook"]
