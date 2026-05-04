"""``DecisionTraceHook`` — emit a decision-trace JSON per phase.

Implements the v1 envelope from ``docs/contracts/decision-trace-v1.md``.
Default-off; opt-in via ``.agent-settings.yml``
``decision_engine.surface_traces: true`` (mirrored into
``hooks.decision_trace.enabled`` by :mod:`work_engine.hooks.settings`).

The hook is purely observational — it never mutates ``DeliveryState``,
never raises terminal errors. Stream / disk failures surface as
:class:`HookError` (non-fatal per the three-tier contract).

Trace layout (matches the contract):

* ``schema_version: 1``
* ``work_id`` — derived from the state-file directory name when the
  caller follows the ``agents/state/work/<id>/state.json`` convention,
  else from the state-file stem.
* ``phase`` — engine ``step_name`` (refine/memory/.../report).
* ``started_at`` / ``ended_at`` — ISO-8601 UTC timestamps captured on
  ``BEFORE_STEP`` and ``AFTER_STEP``.
* ``confidence_band`` / ``risk_class`` — heuristics defined in
  :mod:`work_engine.scoring.decision_trace`.
* ``rules`` — empty by default; the engine layer populates rule
  applications when concerns wire into the trace bus (later phase).
* ``memory`` — counts and ids snapshotted from ``state.memory``.
* ``verify`` — claims/first-try-passes derived from ``state.verify``.
"""
from __future__ import annotations

import json
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from ...scoring.decision_trace import (
    derive_confidence_band,
    derive_risk_class,
    summarise_memory,
    summarise_verify,
)
from ..context import HookContext
from ..events import HookEvent
from ..exceptions import HookError
from ..registry import HookRegistry

SCHEMA_VERSION = 1
_MAX_MEMORY_IDS = 32


class DecisionTraceHook:
    """Emit one decision-trace JSON file per dispatcher step.

    Parameters
    ----------
    output_dir:
        Optional override for the trace destination. When ``None`` the
        hook writes alongside the WorkState file: if the state file
        sits under ``agents/state/work/<id>/state.json`` the trace
        lands at ``agents/state/work/<id>/decision-trace-<phase>.json``;
        otherwise the trace lands next to the state file as
        ``<stem>.decision-trace-<phase>.json``.
    """

    def __init__(self, output_dir: Path | None = None) -> None:
        self._output_dir = output_dir
        self._state_file: Path | None = None
        self._step_started: dict[str, float] = {}

    def register(self, registry: HookRegistry) -> None:
        """Register the trace callbacks on the lifecycle events used."""
        registry.register(HookEvent.BEFORE_LOAD, self._capture_state_file)
        registry.register(HookEvent.AFTER_LOAD, self._capture_state_file)
        registry.register(HookEvent.BEFORE_STEP, self._mark_step_start)
        registry.register(HookEvent.AFTER_STEP, self._emit_trace)

    # -- lifecycle callbacks ------------------------------------------

    def _capture_state_file(self, ctx: HookContext) -> None:
        if ctx.state_file is not None:
            self._state_file = Path(ctx.state_file)

    def _mark_step_start(self, ctx: HookContext) -> None:
        if ctx.step_name:
            self._step_started[ctx.step_name] = time.time()

    def _emit_trace(self, ctx: HookContext) -> None:
        if not ctx.step_name:
            return
        started = self._step_started.pop(ctx.step_name, time.time())
        envelope = self._build_envelope(ctx, started)
        target = self._target_path(ctx.step_name)
        try:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(
                json.dumps(envelope, indent=2, sort_keys=False) + "\n",
                encoding="utf-8",
            )
        except OSError as exc:
            raise HookError(f"decision-trace write failed: {exc}") from exc

    # -- envelope construction ----------------------------------------

    def _build_envelope(
        self, ctx: HookContext, started: float,
    ) -> dict[str, Any]:
        delivery = ctx.delivery
        memory = summarise_memory(
            getattr(delivery, "memory", None),
            limit=_MAX_MEMORY_IDS,
        )
        verify = summarise_verify(getattr(delivery, "verify", None))
        ambiguity = bool(getattr(delivery, "questions", None))
        return {
            "schema_version": SCHEMA_VERSION,
            "work_id": self._work_id(),
            "phase": ctx.step_name,
            "started_at": _iso_utc(started),
            "ended_at": _iso_utc(time.time()),
            "confidence_band": derive_confidence_band(
                memory_hits=memory["hits"],
                verify_claims=verify["claims"],
                verify_first_try_passes=verify["first_try_passes"],
                ambiguity_flag=ambiguity,
            ),
            "risk_class": derive_risk_class(
                getattr(delivery, "changes", None),
            ),
            "rules": [],
            "memory": memory,
            "verify": verify,
        }

    # -- path helpers --------------------------------------------------

    def _work_id(self) -> str:
        if self._state_file is None:
            return "unknown"
        parent = self._state_file.parent
        if parent.name and parent.parent.name == "work":
            return parent.name
        return self._state_file.stem

    def _target_path(self, phase: str) -> Path:
        filename = f"decision-trace-{phase}.json"
        if self._output_dir is not None:
            return self._output_dir / filename
        if self._state_file is None:
            return Path(filename)
        parent = self._state_file.parent
        if parent.name and parent.parent.name == "work":
            return parent / filename
        return parent / f"{self._state_file.stem}.{filename}"


def _iso_utc(epoch: float) -> str:
    return (
        datetime.fromtimestamp(epoch, tz=timezone.utc)
        .strftime("%Y-%m-%dT%H:%M:%SZ")
    )


__all__ = ["DecisionTraceHook", "SCHEMA_VERSION"]
