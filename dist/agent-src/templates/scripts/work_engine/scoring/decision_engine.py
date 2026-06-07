"""Decision-engine gates — schema, validation, and per-phase evaluation.

Reads the optional ``decision_engine:`` block from ``.agent-settings.yml``.
Absent block = current behaviour (observe-only, no gates fire).

Schema (all keys optional; the parser rejects unknown keys hard):

- ``surface_traces`` (bool, default ``false``) — opt-in for
  ``DecisionTraceHook``. Predates the gates; lives here so the
  ``decision_engine:`` block has one source-of-truth schema.
- ``min_confidence`` (``low``/``medium``/``high``/``off``, default
  ``off``) — confidence-band floor; Phase=Plan refuses to advance
  when the band is below.
- ``block_on_risk`` (``low``/``medium``/``high``/``off``, default
  ``off``) — risk-class ceiling; Phase=Implement refuses to advance
  when risk exceeds.
- ``require_memory_hits`` (bool, default ``false``) — Phase=Refine
  demands ``memory_hits >= 1``.
- ``on_block`` (``stop``/``ask``/``warn``, default ``stop``) —
  what happens when a gate fires.
- ``ask_timeout_seconds`` (int, default ``30``) — timeout when
  ``on_block=ask`` runs in a non-interactive context (no TTY, or
  ``CI=true``).
- ``on_block_fallback`` (``stop``/``warn``, default ``stop``) —
  resolution after ``ask_timeout`` elapses.

Gate-conflict resolution (first match wins, only one gate fires per
phase):

1. ``block_on_risk``         (highest impact)
2. ``require_memory_hits``
3. ``min_confidence``        (lowest impact)

See ``docs/contracts/decision-engine-gates.md`` for the full
priority matrix.
"""
from __future__ import annotations

import os
from dataclasses import dataclass
from typing import Any, Callable

ALLOWED_KEYS: frozenset[str] = frozenset({
    "surface_traces",
    "min_confidence",
    "block_on_risk",
    "require_memory_hits",
    "on_block",
    "ask_timeout_seconds",
    "on_block_fallback",
})

_LEVEL_VALUES: frozenset[str] = frozenset({"low", "medium", "high", "off"})
_LEVEL_RANK: dict[str, int] = {"low": 1, "medium": 2, "high": 3}
_ON_BLOCK_VALUES: frozenset[str] = frozenset({"stop", "ask", "warn"})
_FALLBACK_VALUES: frozenset[str] = frozenset({"stop", "warn"})

GATE_PRIORITY: tuple[str, ...] = (
    "block_on_risk",
    "require_memory_hits",
    "min_confidence",
)
"""Conflict-resolution order. Highest-impact gate first; the first
firing gate emits its reason and downstream gates are skipped."""

_PHASE_FOR_GATE: dict[str, str] = {
    "block_on_risk": "implement",
    "require_memory_hits": "refine",
    "min_confidence": "plan",
}


class DecisionEngineConfigError(ValueError):
    """Raised when the ``decision_engine:`` block is malformed."""


@dataclass(frozen=True)
class DecisionEngineSettings:
    """Resolved ``decision_engine:`` block. Frozen to keep gate
    evaluations replay-stable."""

    surface_traces: bool = False
    min_confidence: str = "off"
    block_on_risk: str = "off"
    require_memory_hits: bool = False
    on_block: str = "stop"
    ask_timeout_seconds: int = 30
    on_block_fallback: str = "stop"

    @property
    def any_gate_active(self) -> bool:
        """True when at least one gate is enabled."""
        return (
            self.min_confidence != "off"
            or self.block_on_risk != "off"
            or self.require_memory_hits
        )


@dataclass(frozen=True)
class GateDecision:
    """Outcome of one gate evaluation. ``action`` is the resolved
    response after applying ``on_block`` plus the non-TTY fallback."""

    gate_id: str
    phase: str
    reason: str
    action: str  # "stop" | "warn" | "ask" | "ask_timeout"


def parse(data: Any) -> DecisionEngineSettings:
    """Parse a ``decision_engine`` block into validated settings.

    Returns defaults when ``data`` is ``None`` (block absent) or an
    empty mapping. Raises :class:`DecisionEngineConfigError` on
    unknown keys or invalid values.
    """
    if data is None:
        return DecisionEngineSettings()
    if not isinstance(data, dict):
        raise DecisionEngineConfigError(
            "decision_engine: must be a mapping, got "
            f"{type(data).__name__}"
        )
    unknown = set(data.keys()) - ALLOWED_KEYS
    if unknown:
        raise DecisionEngineConfigError(
            "decision_engine: unknown key(s): "
            + ", ".join(sorted(unknown))
            + ". Allowed: " + ", ".join(sorted(ALLOWED_KEYS))
        )
    return DecisionEngineSettings(
        surface_traces=_coerce_bool(data.get("surface_traces"), False),
        min_confidence=_coerce_level(
            data.get("min_confidence", "off"), "min_confidence",
        ),
        block_on_risk=_coerce_level(
            data.get("block_on_risk", "off"), "block_on_risk",
        ),
        require_memory_hits=_coerce_bool(
            data.get("require_memory_hits"), False,
        ),
        on_block=_coerce_choice(
            data.get("on_block", "stop"), "on_block", _ON_BLOCK_VALUES,
        ),
        ask_timeout_seconds=_coerce_int(
            data.get("ask_timeout_seconds", 30), "ask_timeout_seconds",
        ),
        on_block_fallback=_coerce_choice(
            data.get("on_block_fallback", "stop"),
            "on_block_fallback", _FALLBACK_VALUES,
        ),
    )



def _coerce_bool(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    if isinstance(value, str):
        s = value.strip().lower()
        if s in ("true", "yes", "on", "1"):
            return True
        if s in ("false", "no", "off", "0"):
            return False
    raise DecisionEngineConfigError(
        f"decision_engine.{value!r}: expected bool"
    )


def _coerce_level(value: Any, key: str) -> str:
    if value is None:
        return "off"
    # YAML 1.1 parses unquoted ``off`` as boolean False; accept it as
    # the off sentinel so writers don't have to quote. Boolean True
    # stays rejected — there is no defensible level it maps to.
    if isinstance(value, bool):
        if value is False:
            return "off"
        raise DecisionEngineConfigError(
            f"decision_engine.{key}: boolean True is not a valid level "
            "(quote a string: low/medium/high/off)"
        )
    if not isinstance(value, str):
        raise DecisionEngineConfigError(
            f"decision_engine.{key}: expected string, got "
            f"{type(value).__name__}"
        )
    s = value.strip().lower()
    if s not in _LEVEL_VALUES:
        raise DecisionEngineConfigError(
            f"decision_engine.{key}: invalid value {value!r}. "
            "Allowed: " + ", ".join(sorted(_LEVEL_VALUES))
        )
    return s


def _coerce_choice(value: Any, key: str, allowed: frozenset[str]) -> str:
    if not isinstance(value, str):
        raise DecisionEngineConfigError(
            f"decision_engine.{key}: expected string, got "
            f"{type(value).__name__}"
        )
    s = value.strip().lower()
    if s not in allowed:
        raise DecisionEngineConfigError(
            f"decision_engine.{key}: invalid value {value!r}. "
            "Allowed: " + ", ".join(sorted(allowed))
        )
    return s


def _coerce_int(value: Any, key: str) -> int:
    if isinstance(value, bool):
        raise DecisionEngineConfigError(
            f"decision_engine.{key}: expected int, got bool"
        )
    if isinstance(value, int):
        if value < 0:
            raise DecisionEngineConfigError(
                f"decision_engine.{key}: must be >= 0"
            )
        return value
    raise DecisionEngineConfigError(
        f"decision_engine.{key}: expected int, got "
        f"{type(value).__name__}"
    )


def evaluate_gates(
    settings: DecisionEngineSettings,
    *,
    phase: str,
    confidence_band: str | None,
    risk_class: str | None,
    memory_hits: int,
    is_interactive: Callable[[], bool] | None = None,
) -> GateDecision | None:
    """Evaluate gates for ``phase``. Returns the first firing gate, or
    ``None`` when no gate fires.

    Conflict resolution follows :data:`GATE_PRIORITY` — only the first
    matching gate's phase is considered. Each gate maps to exactly one
    phase via :data:`_PHASE_FOR_GATE`.
    """
    if not settings.any_gate_active:
        return None
    for gate_id in GATE_PRIORITY:
        if _PHASE_FOR_GATE.get(gate_id) != phase:
            continue
        decision = _evaluate_single(
            gate_id, settings,
            confidence_band=confidence_band,
            risk_class=risk_class,
            memory_hits=memory_hits,
        )
        if decision is not None:
            action = _resolve_action(settings, is_interactive)
            return GateDecision(
                gate_id=decision.gate_id,
                phase=decision.phase,
                reason=decision.reason,
                action=action,
            )
    return None


def _evaluate_single(
    gate_id: str,
    settings: DecisionEngineSettings,
    *,
    confidence_band: str | None,
    risk_class: str | None,
    memory_hits: int,
) -> GateDecision | None:
    if gate_id == "min_confidence" and settings.min_confidence != "off":
        floor = _LEVEL_RANK[settings.min_confidence]
        actual = _LEVEL_RANK.get((confidence_band or "").lower(), 0)
        if actual < floor:
            return GateDecision(
                gate_id=gate_id, phase="plan", action="stop",
                reason=(
                    f"confidence_band={confidence_band!r} below floor "
                    f"min_confidence={settings.min_confidence!r}"
                ),
            )
    elif gate_id == "block_on_risk" and settings.block_on_risk != "off":
        ceiling = _LEVEL_RANK[settings.block_on_risk]
        actual = _LEVEL_RANK.get((risk_class or "").lower(), 0)
        if actual >= ceiling:
            return GateDecision(
                gate_id=gate_id, phase="implement", action="stop",
                reason=(
                    f"risk_class={risk_class!r} at/above ceiling "
                    f"block_on_risk={settings.block_on_risk!r}"
                ),
            )
    elif gate_id == "require_memory_hits" and settings.require_memory_hits:
        if memory_hits < 1:
            return GateDecision(
                gate_id=gate_id, phase="refine", action="stop",
                reason=(
                    f"memory_hits={memory_hits} but "
                    "require_memory_hits=true (need >= 1)"
                ),
            )
    return None


def _resolve_action(
    settings: DecisionEngineSettings,
    is_interactive: Callable[[], bool] | None,
) -> str:
    """Map ``on_block`` to an action, applying the non-TTY fallback.

    Non-interactive context = either ``is_interactive()`` returns
    False, or the ``CI`` env var is truthy. ``on_block=ask`` collapses
    to ``ask_timeout`` (consumer applies ``on_block_fallback``).
    """
    if settings.on_block in ("stop", "warn"):
        return settings.on_block
    interactive = (
        is_interactive() if is_interactive is not None
        else _default_is_interactive()
    )
    if interactive:
        return "ask"
    return "ask_timeout"


def _default_is_interactive() -> bool:
    if os.environ.get("CI", "").strip().lower() in ("1", "true", "yes"):
        return False
    try:
        import sys
        return sys.stdin.isatty() and sys.stdout.isatty()
    except (AttributeError, ValueError):
        return False


__all__ = [
    "ALLOWED_KEYS",
    "GATE_PRIORITY",
    "DecisionEngineConfigError",
    "DecisionEngineSettings",
    "GateDecision",
    "evaluate_gates",
    "parse",
]
