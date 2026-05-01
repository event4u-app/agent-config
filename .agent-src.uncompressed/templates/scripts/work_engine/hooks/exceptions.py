"""Hook control-flow signals.

Three-tier error contract (locked by roadmap P1):

- ``HookError`` — non-fatal. Hook implementation failed; the runner
  catches it, warns via ``warnings.warn``, and continues with the next
  callback for the same event. Work proceeds.
- ``HookHalt`` — fatal-controlled. Hook demands a clean stop (canonical
  example: chat-history ``turn-check`` foreign session). The runner
  catches it and **returns** it to the caller, who decides how to
  surface it (engine halt, CLI exit code 2 + readable surface). Not
  re-raised through the dispatch loop.
- any other ``Exception`` — fatal-uncontrolled. Treated as a bug in the
  hook. The runner lets it propagate verbatim; dispatch unwinds.

Both signals share a private ``_HookSignal`` base so the runner can
distinguish hook-originated control flow from genuine bugs without
catching ``BaseException``.
"""
from __future__ import annotations


class _HookSignal(Exception):
    """Internal marker for hook-originated control flow.

    Not part of the public API. The runner uses ``isinstance`` checks
    against the concrete subclasses below; the base exists only so a
    single ``except _HookSignal`` would cover both signals if a future
    refactor needs it.
    """


class HookError(_HookSignal):
    """Non-fatal hook failure.

    Raised (or ``warn``-equivalent — both forms work) when a hook
    callback fails in a way the *engine* should ignore. The runner
    catches it, emits a ``warnings.warn`` with the message, and moves
    on to the next callback registered for the event.

    Example:
        ``raise HookError("trace sink unavailable: connection refused")``

    Use this for transient or non-critical hook failures (telemetry
    sinks, optional reporters). Do **not** use it to signal "stop the
    engine" — that is what :class:`HookHalt` is for.
    """


class HookHalt(_HookSignal):
    """Fatal-controlled stop requested by a hook.

    Hooks raise this when execution must not continue (e.g. chat-history
    ``turn-check`` returns ``foreign``: a different session owns the
    log, work cannot safely proceed). The runner catches it and returns
    it to the caller; the caller turns it into the appropriate halt
    surface:

    - Dispatcher layer → ``Outcome.BLOCKED`` with ``state.questions``
      populated from ``surface``.
    - CLI layer → exit code 2, ``surface`` printed to stderr, no state
      saved unless the halt fires after ``_save()``.

    ``surface`` is a list of pre-formatted numbered options per the
    ``user-interaction`` rule (one entry per line). Callers must not
    reformat — surface is rendered verbatim.

    ``reason`` is a short machine-readable code (e.g. ``"foreign"``,
    ``"missing"``, ``"validation_failed"``) for logging and tests; it
    is not shown to the user.
    """

    def __init__(self, reason: str, surface: list[str] | None = None) -> None:
        super().__init__(reason)
        self.reason = reason
        self.surface: list[str] = list(surface or [])


__all__ = ["HookError", "HookHalt"]
