#!/usr/bin/env python3
"""Shared secret-detection + scrub primitives for the workspace stores.

Leaf module — stdlib ``re`` only, **zero internal imports** — so the
hot-path analytics ``emit()`` and the heavier ``knowledge_ingest`` can both
depend on it cheaply without dragging in PII redaction, chunking, or file
I/O. Every workspace store that persists text or arbitrary payloads at rest
routes through this module before writing (Phase 8 Step 5 secret-hygiene
sweep).

Two confidence tiers:

* **HIGH** — structurally unambiguous credentials (AWS access-key id, GitHub
  PAT, OpenAI key, PEM private-key block). Near-zero false-positive rate, so
  safe to scrub destructively or to refuse a write over.
* **FUZZY** — the generic ``key/secret/token/password = <value>`` assignment.
  Fires on legitimate prose ("password reset token: see attached"), so it is
  warn-only on user-authored content and only scrubbed on disposable,
  machine-generated telemetry (sessions / analytics).

The ``[SECRET]`` placeholder matches the knowledge-ingestion redactor so the
two surfaces stay byte-consistent.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

PLACEHOLDER = "[SECRET]"

# --- HIGH-confidence patterns (gitleaks-equivalent subset) ------------------
_RE_PRIVATE_KEY = re.compile(
    r"-----BEGIN [A-Z ]+PRIVATE KEY-----[\s\S]*?-----END [A-Z ]+PRIVATE KEY-----"
)
_RE_AWS = re.compile(r"AKIA[0-9A-Z]{16}")
_RE_GH = re.compile(r"gh[pousr]_[A-Za-z0-9]{36,}")
_RE_OPENAI = re.compile(r"sk-[A-Za-z0-9]{20,}")

# --- FUZZY pattern (heuristic key/value assignment) -------------------------
_RE_KV_SECRET = re.compile(
    r"(?i)(?:api[_-]?key|secret|token|password|passwd|bearer)\s*[:=]\s*"
    r"['\"]?[A-Za-z0-9_\-+/=]{12,}['\"]?"
)

# Ordered HIGH-confidence first so the private-key block is consumed before
# the narrower key patterns can fragment it.
HIGH_CONFIDENCE: tuple[tuple[str, re.Pattern[str]], ...] = (
    ("private_key", _RE_PRIVATE_KEY),
    ("aws_access_key", _RE_AWS),
    ("github_pat", _RE_GH),
    ("openai_key", _RE_OPENAI),
)
FUZZY: tuple[tuple[str, re.Pattern[str]], ...] = (("kv_secret", _RE_KV_SECRET),)
ALL_PATTERNS: tuple[tuple[str, re.Pattern[str]], ...] = HIGH_CONFIDENCE + FUZZY

# Recursion guard for ``scrub_obj`` — deep / cyclic structures degrade to a
# controlled return instead of a RecursionError on the never-raises hot path.
_MAX_DEPTH = 50


@dataclass(frozen=True)
class Finding:
    """One secret match. Carries the pattern name + tier, never the value."""

    pattern: str  # e.g. "aws_access_key"
    confidence: str  # "high" | "fuzzy"


def scan(text: str, *, include_fuzzy: bool = True) -> list[Finding]:
    """Non-destructive detection: one :class:`Finding` per match.

    Never echoes the matched secret value — only the pattern name and tier,
    so a caller can warn or refuse without re-leaking the secret into a log.
    """
    if not isinstance(text, str) or not text:
        return []
    out: list[Finding] = []
    for name, pat in HIGH_CONFIDENCE:
        out.extend(Finding(name, "high") for _ in pat.finditer(text))
    if include_fuzzy:
        for name, pat in FUZZY:
            out.extend(Finding(name, "fuzzy") for _ in pat.finditer(text))
    return out


def scrub(text: str, *, include_fuzzy: bool = True) -> tuple[str, int]:
    """Replace every secret match with ``[SECRET]``; return ``(clean, count)``."""
    if not isinstance(text, str) or not text:
        return text, 0
    count = 0
    patterns = ALL_PATTERNS if include_fuzzy else HIGH_CONFIDENCE
    for _name, pat in patterns:
        text, n = pat.subn(PLACEHOLDER, text)
        count += n
    return text, count


def scrub_obj(
    obj,
    *,
    include_fuzzy: bool = True,
    _depth: int = 0,
    _seen: set[int] | None = None,
):
    """Recursively scrub string leaves in dict / list / tuple structures.

    Non-string leaves (``int``, ``float``, ``bool``, ``None``) pass through
    untouched. Recursion is bounded by a depth cap and a cycle guard so
    malformed or self-referential payloads degrade to a controlled return,
    never a :class:`RecursionError` — callers on a never-raises hot path
    (``workspace_analytics.emit``) rely on this. Returns ``(clean, count)``.
    """
    if _seen is None:
        _seen = set()
    if _depth > _MAX_DEPTH:
        return obj, 0
    if isinstance(obj, str):
        return scrub(obj, include_fuzzy=include_fuzzy)
    if isinstance(obj, dict):
        oid = id(obj)
        if oid in _seen:
            return obj, 0
        _seen.add(oid)
        total = 0
        clean: dict = {}
        for key, value in obj.items():
            cv, n = scrub_obj(
                value, include_fuzzy=include_fuzzy, _depth=_depth + 1, _seen=_seen
            )
            clean[key] = cv
            total += n
        return clean, total
    if isinstance(obj, (list, tuple)):
        oid = id(obj)
        if oid in _seen:
            return obj, 0
        _seen.add(oid)
        total = 0
        items: list = []
        for value in obj:
            cv, n = scrub_obj(
                value, include_fuzzy=include_fuzzy, _depth=_depth + 1, _seen=_seen
            )
            items.append(cv)
            total += n
        return (tuple(items) if isinstance(obj, tuple) else items), total
    return obj, 0
