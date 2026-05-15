"""Confidence gate for solo-member dispatch (step-9 P13).

Defense-in-depth on top of shadow-mode SLO: when a single member's
response signals uncertainty, presents unresolved alternatives, or
refuses, the dispatcher escalates to the full council on the current
invocation — independent of shadow sampling. The shadow log records
the escalation so the SLO can distinguish "silent disagreement" from
"auto-escalation".

Heuristics are intentionally stdlib-only (regex + length). No second
LLM judge pass; no external dependency. False positives escalate
(cheap, safe); false negatives are caught downstream by shadow-mode
disagreement.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

#: Below this character count a response is treated as too thin to
#: trust on its own — escalates as `short_response`.
_SHORT_RESPONSE_CHARS = 40

#: Hedge-word density (matches per 100 chars) above which the
#: response is treated as low-confidence. Calibrated against the
#: shadow-log fixtures; can be tuned without breaking the API.
_HEDGE_DENSITY_THRESHOLD = 0.04

_HEDGE_WORDS = (
    "maybe", "perhaps", "possibly", "probably", "not sure",
    "unsure", "i think", "i guess", "i'd say", "tend to",
    "vielleicht", "eventuell", "möglicherweise", "wahrscheinlich",
    "nicht sicher", "denke ich", "vermutlich",
)

_REFUSAL_PATTERNS = (
    r"\bi (?:can(?:'?| no)t|cannot|won'?t|am unable)\b",
    r"\bi don'?t know\b",
    r"\bunclear\b",
    r"\binsufficient (?:context|information|data)\b",
    r"\bneed more (?:context|information|details)\b",
    r"\bkann (?:ich )?nicht (?:entscheiden|sagen|beantworten)\b",
    r"\bweiß ich nicht\b",
    r"\bzu wenig (?:kontext|information)\b",
)

_SPLIT_PATTERNS = (
    r"\boption a\b.*?\boption b\b",
    r"\bvariante 1\b.*?\bvariante 2\b",
    r"\beither\b.*?\bor\b.*?\b(?:would|could|might)\b",
    r"\bentweder\b.*?\boder\b.*?\b(?:wäre|könnte|würde)\b",
    r"^\s*verdict:.*?^\s*verdict:",  # two Verdict: blocks
)

_CONFIDENCE_MARKER_RE = re.compile(
    r"confidence\s*[:=]\s*([01](?:\.\d+)?|\d{1,3}\s*%)",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class EscalationDecision:
    """Verdict from :func:`should_escalate`."""

    escalate: bool
    reason: str  # 'low_confidence' | 'split' | 'refusal' | 'short_response' | 'ok'
    confidence: float | None


def extract_confidence(response: str) -> float | None:
    """Best-effort confidence score from a member response.

    Returns the explicit ``Confidence: 0.X`` marker when present
    (percent values normalised to 0–1). Otherwise derives a score
    from hedge-word density: ``1.0 - clamp(density / threshold, 0, 1)``.
    Returns ``None`` for empty input — caller treats as escalate.
    """
    if not response or not response.strip():
        return None
    m = _CONFIDENCE_MARKER_RE.search(response)
    if m:
        raw = m.group(1).strip()
        if raw.endswith("%"):
            try:
                return max(0.0, min(1.0, float(raw[:-1].strip()) / 100.0))
            except ValueError:
                pass
        else:
            try:
                return max(0.0, min(1.0, float(raw)))
            except ValueError:
                pass
    low = response.lower()
    hits = sum(low.count(w) for w in _HEDGE_WORDS)
    if hits == 0:
        return 1.0
    density = hits / max(1, len(response) / 100.0)
    ratio = min(1.0, density / _HEDGE_DENSITY_THRESHOLD)
    return max(0.0, 1.0 - ratio)


def is_split_response(response: str) -> bool:
    """True when the response presents unresolved alternatives.

    Picks up `option A … option B`, two `Verdict:` blocks, `either … or
    would/could`, and German equivalents. Conservative — escalating on
    a split is cheap, missing one is caught by shadow disagreement.
    """
    if not response:
        return False
    low = response.lower()
    for pattern in _SPLIT_PATTERNS:
        if re.search(pattern, low, re.DOTALL | re.MULTILINE):
            return True
    return False


def is_refusal(response: str) -> bool:
    """True when the response signals 'I can't / don't know / unclear'."""
    if not response:
        return True
    low = response.lower()
    return any(re.search(p, low) for p in _REFUSAL_PATTERNS)


def should_escalate(
    response: str,
    *,
    floor: float,
) -> EscalationDecision:
    """Compose the gate. Order: refusal → split → short → low-conf → ok.

    ``floor`` is :class:`LowImpactConfig.solo_confidence_floor`.
    """
    if response is None or not response.strip():
        return EscalationDecision(True, "refusal", None)
    if is_refusal(response):
        return EscalationDecision(True, "refusal", None)
    if is_split_response(response):
        return EscalationDecision(True, "split", None)
    if len(response.strip()) < _SHORT_RESPONSE_CHARS:
        return EscalationDecision(True, "short_response", None)
    conf = extract_confidence(response)
    if conf is None or conf < floor:
        return EscalationDecision(True, "low_confidence", conf)
    return EscalationDecision(False, "ok", conf)


__all__ = [
    "EscalationDecision",
    "extract_confidence",
    "is_split_response",
    "is_refusal",
    "should_escalate",
]
