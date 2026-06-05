"""Hook event surface for ``work_engine``.

Ten events split across two layers per
``agents/roadmaps/road-to-work-engine-hooks.md`` (locked).

Dispatcher-layer events fire from inside ``dispatcher.dispatch()`` and
operate on ``DeliveryState`` (legacy, internal). CLI-layer events fire
from ``cli.main()`` and operate on ``WorkState`` (v1 envelope) plus
auxiliary refs (``state_file``, ``fmt``, ``args``). The split is
deliberate — see the ``Hook event surface (locked)`` section of the
roadmap for the per-event context payloads.

Adding events is a roadmap-level decision: hook consumers depend on
the surface staying stable, and an enum makes accidental string typos
fail at import time.
"""
from __future__ import annotations

from enum import Enum


class HookEvent(str, Enum):
    """Lifecycle events emitted by the work engine.

    Subclassing ``str`` keeps round-trips trivial for telemetry and
    JSON tracing — the value is the event name verbatim.
    """

    # Dispatcher layer (DeliveryState).
    BEFORE_STEP = "before_step"
    AFTER_STEP = "after_step"
    ON_HALT = "on_halt"
    ON_ERROR = "on_error"

    # CLI layer (WorkState).
    BEFORE_LOAD = "before_load"
    AFTER_LOAD = "after_load"
    BEFORE_DISPATCH = "before_dispatch"
    AFTER_DISPATCH = "after_dispatch"
    BEFORE_SAVE = "before_save"
    AFTER_SAVE = "after_save"


__all__ = ["HookEvent"]
