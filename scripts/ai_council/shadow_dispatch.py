"""Shadow-mode dispatch for low-impact solo-member decisions (step-9 P10).

When ``low_impact.dispatch: single`` is active, a Bernoulli-sampled subset
of decisions is shadowed through the full council so disagreement between
the solo verdict and the council verdict can be measured. The shadow log
lives at ``agents/council-shadow-log.jsonl`` and is subject to the same
privacy floor as the low-impact corpus: redactor-refused entries are
dropped, not softened.

The flip from ``single`` back to ``full`` is a user decision; this module
emits data and an SLO banner, nothing else.
"""

from __future__ import annotations

import hashlib
import json
import random
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterable

from scripts.ai_council.bundler import redact

SHADOW_LOG_PATH = Path("agents/council-shadow-log.jsonl")

SLO_THRESHOLD_WARN = 0.05
SLO_THRESHOLD_BREACH = 0.08


@dataclass(frozen=True)
class ShadowDecision:
    timestamp: str
    query_hash: str
    solo_verdict: str
    full_verdict: str
    agreed: bool
    #: Step-9 P13 — True when the confidence gate auto-escalated this
    #: decision to the full council. Distinguishes "silent disagreement"
    #: (escalated=False, agreed=False) from "gate-caught" (escalated=True)
    #: in the SLO banner.
    escalated: bool = False
    escalation_reason: str = "ok"


def should_shadow(
    sample_rate: float,
    *,
    rng: random.Random | None = None,
) -> bool:
    rate = max(0.0, min(1.0, sample_rate))
    r = rng if rng is not None else random
    return r.random() < rate


def _hash_query(query: str) -> str:
    redacted = redact(query)
    return hashlib.sha256(redacted.encode("utf-8")).hexdigest()[:16]


def _privacy_dropped(redacted: str) -> bool:
    stripped = redacted.strip()
    if not stripped:
        return True
    return stripped.startswith("[redacted")


def record_shadow_decision(
    log_path: Path,
    *,
    query: str,
    solo_verdict: str,
    full_verdict: str,
    escalated: bool = False,
    escalation_reason: str = "ok",
) -> ShadowDecision | None:
    """Append one JSONL row. Returns ``None`` when redaction would drop
    the entry (privacy floor — do not soften).

    ``escalated`` / ``escalation_reason`` come from the confidence
    gate (step-9 P13). When True, ``solo_verdict`` is the rejected
    solo response and ``full_verdict`` is the council's verdict that
    actually answered the user.
    """
    redacted_q = redact(query)
    if _privacy_dropped(redacted_q):
        return None

    decision = ShadowDecision(
        timestamp=datetime.now(timezone.utc).isoformat(timespec="seconds"),
        query_hash=_hash_query(query),
        solo_verdict=solo_verdict,
        full_verdict=full_verdict,
        agreed=(solo_verdict == full_verdict),
        escalated=escalated,
        escalation_reason=escalation_reason,
    )
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as f:
        f.write(json.dumps({
            "timestamp": decision.timestamp,
            "query_hash": decision.query_hash,
            "solo_verdict": decision.solo_verdict,
            "full_verdict": decision.full_verdict,
            "agreed": decision.agreed,
            "escalated": decision.escalated,
            "escalation_reason": decision.escalation_reason,
        }) + "\n")
    return decision


def _iter_log(log_path: Path) -> Iterable[dict]:
    if not log_path.exists():
        return
    with log_path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                yield json.loads(line)
            except json.JSONDecodeError:
                continue


def compute_disagreement_rate(
    log_path: Path,
    *,
    window_days: int = 7,
    now: datetime | None = None,
) -> tuple[float, int]:
    """``(disagreement_rate, sample_count)`` over the rolling window.

    Counts a row as "disagreed" when ``agreed=False`` regardless of
    the escalation flag — a gate-caught split is still a sign that
    solo mode was wrong on that decision. :func:`compute_escalation_rate`
    breaks the same window down by ``escalated=True`` for the banner.
    """
    cutoff = (now or datetime.now(timezone.utc)) - timedelta(days=window_days)
    total = 0
    disagreed = 0
    for row in _iter_log(log_path):
        raw_ts = row.get("timestamp", "")
        try:
            ts = datetime.fromisoformat(raw_ts.replace("Z", "+00:00"))
        except ValueError:
            continue
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        if ts < cutoff:
            continue
        total += 1
        if not row.get("agreed", True):
            disagreed += 1
    if total == 0:
        return 0.0, 0
    return disagreed / total, total


def compute_escalation_rate(
    log_path: Path,
    *,
    window_days: int = 7,
    now: datetime | None = None,
) -> tuple[float, int]:
    """``(escalation_rate, sample_count)`` — fraction with ``escalated=True``.

    Step-9 P13 — separates gate-caught escalations from silent
    disagreement so the banner can name the dominant failure mode.
    """
    cutoff = (now or datetime.now(timezone.utc)) - timedelta(days=window_days)
    total = 0
    escalated = 0
    for row in _iter_log(log_path):
        raw_ts = row.get("timestamp", "")
        try:
            ts = datetime.fromisoformat(raw_ts.replace("Z", "+00:00"))
        except ValueError:
            continue
        if ts.tzinfo is None:
            ts = ts.replace(tzinfo=timezone.utc)
        if ts < cutoff:
            continue
        total += 1
        if row.get("escalated", False):
            escalated += 1
    if total == 0:
        return 0.0, 0
    return escalated / total, total


def slo_status(rate: float) -> str:
    if rate < SLO_THRESHOLD_WARN:
        return "OK"
    if rate < SLO_THRESHOLD_BREACH:
        return "WARN"
    return "BREACH"


def slo_banner(
    rate: float,
    sample_count: int,
    *,
    escalation_rate: float | None = None,
) -> str:
    """One-line SLO banner. ``escalation_rate`` is appended when given.

    Step-9 P13 — escalation tail surfaces the share of decisions the
    confidence gate caught before they reached the user.
    """
    pct = rate * 100
    status = slo_status(rate)
    if sample_count == 0:
        return "[shadow SLO] no samples yet"
    if status == "OK":
        base = (
            f"[shadow SLO] OK · {pct:.1f}% disagreement over "
            f"{sample_count} samples (<5%)"
        )
    elif status == "WARN":
        base = (
            f"[shadow SLO] WARN · {pct:.1f}% disagreement over "
            f"{sample_count} samples (5–8% — consider reverting to "
            f"low_impact.dispatch: full)"
        )
    else:
        base = (
            f"[shadow SLO] BREACH · {pct:.1f}% disagreement over "
            f"{sample_count} samples (>8% — revert to "
            f"low_impact.dispatch: full)"
        )
    if escalation_rate is not None:
        base += f" · {escalation_rate * 100:.1f}% auto-escalated"
    return base
