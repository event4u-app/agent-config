"""``work_engine`` — universal execution engine (R1).

Phase 2 lands the state schema and the v0→v1 migration. The full
engine code (dispatcher, steps, CLI) moves over from
``implement_ticket`` in Phase 3 once the schema layer is locked.

The package intentionally has no runtime dependency on
``implement_ticket``: the Phase 1 freeze-guard treats that module as
immutable, and ``work_engine`` must be free to evolve without
disturbing the locked baseline.
"""
from __future__ import annotations
