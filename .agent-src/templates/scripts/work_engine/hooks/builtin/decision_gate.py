"""``DecisionGateHook`` — refuse to advance when an opt-in gate fires.

Bridges :mod:`work_engine.scoring.decision_engine` into the dispatcher
hook bus. Reads the gate config from
:class:`work_engine.hooks.settings.HookSettings.decision_engine` and
fires on ``AFTER_STEP`` only for the phase each gate owns.

Gate-conflict resolution and the non-TTY timeout protocol live in
``docs/contracts/decision-engine-gates.md``. The hook only consumes
them; it never re-implements gate logic.

Three actions, mapped 1:1 from :func:`evaluate_gates`:

- ``stop``        → raise :class:`HookHalt` with a numbered-option
                    surface. Dispatcher returns ``BLOCKED``.
- ``warn``        → raise :class:`HookError` so the runner logs the
                    reason and the step proceeds.
- ``ask_timeout`` → non-interactive context; apply
                    ``on_block_fallback`` and re-resolve to ``stop``
                    or ``warn``. ``block_reason=ask_timeout`` is
                    surfaced verbatim so the trace records it.
- ``ask``         → interactive context; for the CLI integration this
                    collapses to ``stop`` with the prompt surface,
                    matching how every other ``HookHalt`` is rendered.
                    The interactive resumption path is owned by the
                    CLI, not by the hook.

Default-off: when ``settings.decision_engine`` is ``None`` or every
gate is ``off`` the hook short-circuits without examining state.
"""
from __future__ import annotations

from typing import Any

from ...scoring.decision_engine import (
    DecisionEngineSettings,
    GateDecision,
    evaluate_gates,
)
from ...scoring.decision_trace import (
    derive_confidence_band,
    derive_risk_class,
    summarise_memory,
    summarise_verify,
)
from ..context import HookContext
from ..events import HookEvent
from ..exceptions import HookError, HookHalt
from ..registry import HookRegistry

_BLOCK_REASON_PREFIX = "decision_gate"


class DecisionGateHook:
    """Evaluate decision-engine gates on every ``AFTER_STEP``.

    Parameters
    ----------
    settings:
        Resolved :class:`DecisionEngineSettings`. The hook stores it as
        a frozen reference; tests pass a fresh instance per scenario.
    """

    def __init__(self, settings: DecisionEngineSettings) -> None:
        self._settings = settings

    def register(self, registry: HookRegistry) -> None:
        """Register the gate callback on ``AFTER_STEP``."""
        registry.register(HookEvent.AFTER_STEP, self._evaluate)

    # -- lifecycle callback ------------------------------------------

    def _evaluate(self, ctx: HookContext) -> None:
        if not self._settings.any_gate_active:
            return
        phase = ctx.step_name
        if not phase:
            return
        delivery = ctx.delivery
        memory = summarise_memory(getattr(delivery, "memory", None))
        verify = summarise_verify(getattr(delivery, "verify", None))
        ambiguity = bool(getattr(delivery, "questions", None))
        decision = evaluate_gates(
            self._settings,
            phase=phase,
            confidence_band=derive_confidence_band(
                memory_hits=memory["hits"],
                verify_claims=verify["claims"],
                verify_first_try_passes=verify["first_try_passes"],
                ambiguity_flag=ambiguity,
            ),
            risk_class=derive_risk_class(
                getattr(delivery, "changes", None),
            ),
            memory_hits=memory["hits"],
        )
        if decision is None:
            return
        self._apply(decision)

    # -- action dispatch ----------------------------------------------

    def _apply(self, decision: GateDecision) -> None:
        action = decision.action
        if action == "warn":
            raise HookError(self._format_reason(decision))
        if action == "ask_timeout":
            fallback = self._settings.on_block_fallback
            if fallback == "warn":
                raise HookError(self._format_reason(decision, suffix="ask_timeout"))
            raise HookHalt(
                f"{_BLOCK_REASON_PREFIX}:{decision.gate_id}:ask_timeout",
                surface=self._surface(decision, suffix="ask_timeout"),
            )
        raise HookHalt(
            f"{_BLOCK_REASON_PREFIX}:{decision.gate_id}",
            surface=self._surface(decision),
        )

    # -- formatting helpers -------------------------------------------

    @staticmethod
    def _format_reason(decision: GateDecision, *, suffix: str = "") -> str:
        tag = f"{_BLOCK_REASON_PREFIX}:{decision.gate_id}"
        if suffix:
            tag = f"{tag}:{suffix}"
        return f"{tag} — {decision.reason}"

    @staticmethod
    def _surface(
        decision: GateDecision, *, suffix: str = "",
    ) -> list[str]:
        header = f"Decision-engine gate fired: {decision.gate_id} (phase={decision.phase})"
        if suffix:
            header = f"{header} [{suffix}]"
        return [
            header,
            f"Reason: {decision.reason}",
            "1) Address the gate condition and resume.",
            "2) Lower the gate in `.agent-settings.yml` "
            "(`decision_engine` block) and resume.",
            "3) Abort the run.",
        ]


def build_decision_gate_hook(
    settings: Any,
) -> DecisionGateHook | None:
    """Construct the hook from a :class:`DecisionEngineSettings`-like
    object. Returns ``None`` when the config is absent or every gate is
    ``off``; the bootstrap layer then skips registration entirely.
    """
    if settings is None:
        return None
    if not isinstance(settings, DecisionEngineSettings):
        return None
    if not settings.any_gate_active:
        return None
    return DecisionGateHook(settings)


__all__ = ["DecisionGateHook", "build_decision_gate_hook"]
