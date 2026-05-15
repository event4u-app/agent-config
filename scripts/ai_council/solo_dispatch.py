"""Solo-member dispatch — step-9 P9 (U2).

Picks the first enabled, auth-valid member from
``routing.solo_member_fallback_chain`` so low-impact decisions can
optionally route to a single member instead of the full council. The
selection is intentionally side-effect-free: callers own logging,
dispatch, and the all-invalid → full-council fallback.

Iron Law: a None selection from :func:`select_solo_member` is the
caller's signal to fall back to the full council with a WARN log —
NEVER to fail the decision. The dispatcher must never break a
user's flow because a CLI was offline.
"""

from __future__ import annotations

import os
import time
from dataclasses import dataclass, field
from typing import Callable, Mapping

from scripts.ai_council.config import MemberConfig, RoutingConfig
from scripts.ai_council.confidence_gate import (
    EscalationDecision,
    should_escalate,
)

#: TTL for cached auth-probe results. Lazy probe per session; bumped
#: forward whenever a probe is re-run.
_AUTH_CACHE_TTL_SECONDS = 15 * 60

#: Env var that forces every solo-dispatch path back to full council
#: for the current invocation. Honored by :func:`select_solo_member`
#: and surfaced through :func:`force_full_council`.
FORCE_FULL_ENV = "AGENT_CONFIG_FORCE_FULL_COUNCIL"


@dataclass
class AuthCacheEntry:
    """One auth-probe result with the expiry it was cached against."""

    valid: bool
    expires_at: float


@dataclass
class AuthCache:
    """In-memory cache for auth-probe verdicts (per-process)."""

    entries: dict[str, AuthCacheEntry] = field(default_factory=dict)

    def get(self, name: str, *, now: float) -> bool | None:
        entry = self.entries.get(name)
        if entry is None or entry.expires_at <= now:
            return None
        return entry.valid

    def set(self, name: str, *, valid: bool, now: float) -> None:
        self.entries[name] = AuthCacheEntry(
            valid=valid, expires_at=now + _AUTH_CACHE_TTL_SECONDS,
        )


def force_full_council(env: Mapping[str, str] | None = None) -> bool:
    """Return True iff the env-var override is set to ``1``.

    Truthy values other than ``1`` are intentionally rejected — the
    override is a hard one-bit switch, not a free-form bool.
    """
    src = env if env is not None else os.environ
    return src.get(FORCE_FULL_ENV, "") == "1"


def select_solo_member(
    routing: RoutingConfig,
    members: Mapping[str, MemberConfig],
    *,
    auth_cache: AuthCache,
    probe: Callable[[str, float], bool],
    now: float | None = None,
    env: Mapping[str, str] | None = None,
) -> str | None:
    """Return the first chain entry whose member is enabled + auth-valid.

    Walks ``routing.solo_member_fallback_chain`` in order. For each
    entry: skip when the member is missing or disabled; consult the
    auth cache; on miss probe lazily with the configured timeout and
    cache the result. Returns the provider name of the first valid
    member, or ``None`` when every chain entry is unavailable.

    ``probe(name, timeout_s) -> bool`` is the caller-supplied auth
    check. It MUST honor ``timeout_s`` and return False on timeout
    so the dispatcher cannot stall on a wedged CLI.

    Env-var override (``AGENT_CONFIG_FORCE_FULL_COUNCIL=1``) short-
    circuits to None, treating the whole chain as unavailable. The
    caller still owns the WARN log + full-council escalation.
    """
    if force_full_council(env):
        return None
    if now is None:
        now = time.monotonic()
    timeout_s = routing.auth_check_timeout_seconds
    for name in routing.solo_member_fallback_chain:
        member = members.get(name)
        if member is None or not member.enabled:
            continue
        cached = auth_cache.get(name, now=now)
        if cached is False:
            continue
        if cached is True:
            return name
        try:
            valid = bool(probe(name, timeout_s))
        except Exception:
            # Probe blew up — treat as auth-invalid so the chain
            # walks to the next entry. Don't swallow silently in
            # production: callers should log probe failures.
            valid = False
        auth_cache.set(name, valid=valid, now=now)
        if valid:
            return name
    return None


@dataclass(frozen=True)
class SoloDispatchResult:
    """Outcome of :func:`dispatch_with_escalation`.

    ``verdict`` is the final answer text returned to the caller.
    ``escalated`` is True when the solo response was rejected by the
    confidence gate and the full council ran. ``solo_member`` /
    ``solo_response`` are populated even on escalation so the shadow
    log can record both sides without re-running the solo step.
    """

    verdict: str
    escalated: bool
    escalation_reason: str  # 'low_confidence' | 'split' | 'refusal' | 'short_response' | 'ok' | 'no_solo_member'
    solo_member: str | None
    solo_response: str | None
    solo_confidence: float | None


def dispatch_with_escalation(
    routing: RoutingConfig,
    members: Mapping[str, MemberConfig],
    *,
    auth_cache: AuthCache,
    probe: Callable[[str, float], bool],
    run_solo: Callable[[str], str],
    run_full: Callable[[], str],
    confidence_floor: float,
    now: float | None = None,
    env: Mapping[str, str] | None = None,
) -> SoloDispatchResult:
    """Solo-dispatch with auto-escalation on low-confidence / split / refusal.

    Step-9 P13 — defense-in-depth on top of shadow-mode SLO.

    Flow:

    1. ``select_solo_member`` picks the chain entry.
    2. None → escalate immediately (``no_solo_member``).
    3. ``run_solo`` is invoked; response is scored via
       :func:`scripts.ai_council.confidence_gate.should_escalate`.
    4. Verdict ``escalate=True`` → ``run_full`` is invoked and that
       verdict is returned; the solo response stays on the result
       for shadow logging.
    5. ``escalate=False`` → solo verdict is returned as-is.

    ``run_solo(name) -> str`` and ``run_full() -> str`` are caller-
    supplied; this module owns no LLM transport. Callers MUST raise
    on transport errors — escalation is for *content* low-confidence,
    not infrastructure failures (those bubble up to the orchestrator's
    own retry / fallback policy).
    """
    name = select_solo_member(
        routing,
        members,
        auth_cache=auth_cache,
        probe=probe,
        now=now,
        env=env,
    )
    if name is None:
        return SoloDispatchResult(
            verdict=run_full(),
            escalated=True,
            escalation_reason="no_solo_member",
            solo_member=None,
            solo_response=None,
            solo_confidence=None,
        )
    solo = run_solo(name)
    decision: EscalationDecision = should_escalate(solo, floor=confidence_floor)
    if decision.escalate:
        return SoloDispatchResult(
            verdict=run_full(),
            escalated=True,
            escalation_reason=decision.reason,
            solo_member=name,
            solo_response=solo,
            solo_confidence=decision.confidence,
        )
    return SoloDispatchResult(
        verdict=solo,
        escalated=False,
        escalation_reason="ok",
        solo_member=name,
        solo_response=solo,
        solo_confidence=decision.confidence,
    )


__all__ = [
    "AUTH_CACHE_TTL_SECONDS",
    "AuthCache",
    "AuthCacheEntry",
    "FORCE_FULL_ENV",
    "SoloDispatchResult",
    "dispatch_with_escalation",
    "force_full_council",
    "select_solo_member",
]
AUTH_CACHE_TTL_SECONDS = _AUTH_CACHE_TTL_SECONDS
