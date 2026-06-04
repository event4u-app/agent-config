"""Score eligible commands against a user message + recent context.

Deterministic, no ML, no third-party deps. Two signals combine into
a 0.0–1.0 score:

* **Description match** — strongest single signal.
  - Long phrase substring (≥ 10 chars) → 0.65.
  - Short phrase substring (6–9 chars) → 0.4.
  - Otherwise content-word overlap (≥ 4-char tokens, stop-words
    stripped) scaled to 0.4.
* **Context match** — supporting evidence.
  - Structural pattern (ticket key, file path, glob) co-occurring
    in the message → 0.5.
  - Otherwise content-word overlap scaled to 0.3.

Total `score = min(1.0, description_score + context_score)`. A long
phrase hit alone clears the default 0.6 floor; structural patterns
alone do not (anti-noise) — they need a description signal too.
A `Match.has_structural_bonus` flag lets the ranker know when a
short, otherwise-ambiguous prompt is actually specific (ticket
keys, paths) so it can override vague-input suppression.
"""
from __future__ import annotations

import re
from typing import Iterable

from .sanitize import sanitize_context, sanitize_message
from .types import CommandSpec, Match

_TICKET_RE = re.compile(r"[A-Z][A-Z0-9]+-\d+")
_WORD_RE = re.compile(r"[A-Za-z][A-Za-z0-9_-]{3,}")
_PATH_RE = re.compile(r"[A-Za-z0-9_./-]+/[A-Za-z0-9_.*-]+")
_STOPWORDS: frozenset[str] = frozenset({
    "this", "that", "with", "from", "have", "what", "when", "they",
    "them", "into", "would", "could", "should", "about", "there",
    "these", "those", "their", "your", "mine", "ours", "yours",
    "show", "tell", "make", "want", "need", "like", "just", "some",
    "many", "more", "most", "less", "than", "then", "also", "very",
})


def _tokens(text: str) -> set[str]:
    return {
        w.lower() for w in _WORD_RE.findall(text or "")
        if w.lower() not in _STOPWORDS
    }


def _phrases(trigger_description: str) -> list[str]:
    return [
        p.strip().lower() for p in (trigger_description or "").split(",")
        if p.strip()
    ]


def _phrase_substring_hit(phrases: list[str], hay: str) -> str | None:
    """Return the longest phrase that occurs as a substring, else None.

    Falls back to a hyphen-normalized hay so e.g. `"create pr"` still
    matches `"create-pr"` in a path or branch reference.
    """
    best: str | None = None
    hay_norm = hay.replace("-", " ")
    for p in sorted(phrases, key=len, reverse=True):
        if len(p) < 6:
            continue
        if p in hay or p in hay_norm:
            return p
    return best


def _structural_bonus(spec: CommandSpec, message: str) -> str | None:
    """Heavy-signal patterns that score context fully (0.5).

    Ticket keys (`ABC-123`) and file paths in the spec's
    `trigger_context` only count when they actually appear in the
    message — `trigger_context` advertises *which* signals matter,
    the message provides them.
    """
    ctx_lower = (spec.trigger_context or "").lower()
    msg_lower = message.lower()
    if "ticket" in ctx_lower or "proj-" in ctx_lower or "[a-z]+-[0-9]+" in ctx_lower:
        m = _TICKET_RE.search(message)
        if m:
            return m.group(0)
    for path in _PATH_RE.findall(spec.trigger_context or ""):
        if path.lower() in msg_lower:
            return path
    return None


def _description_score(spec: CommandSpec, message: str, ctx_text: str) -> tuple[float, str]:
    phrases = _phrases(spec.trigger_description)
    hay = (message + " \n " + ctx_text).lower()
    hit = _phrase_substring_hit(phrases, hay)
    if hit:
        # Long phrase substring is the strongest signal — clears the
        # default 0.6 floor on its own. Short phrases need context.
        return (0.65 if len(hit) >= 10 else 0.4), hit
    spec_tokens = _tokens(spec.trigger_description)
    if not spec_tokens:
        return 0.0, ""
    msg_tokens = _tokens(message) | _tokens(ctx_text)
    common = spec_tokens & msg_tokens
    if not common:
        return 0.0, ""
    score = 0.4 * (len(common) / len(spec_tokens))
    return score, sorted(common)[0]


def _context_score(
    spec: CommandSpec, message: str, ctx_text: str
) -> tuple[float, str, bool]:
    """Returns (score, evidence, has_structural_bonus)."""
    bonus = _structural_bonus(spec, message)
    if bonus:
        return 0.5, bonus, True
    spec_tokens = _tokens(spec.trigger_context)
    if not spec_tokens:
        return 0.0, "", False
    msg_tokens = _tokens(message) | _tokens(ctx_text)
    common = spec_tokens & msg_tokens
    if not common:
        return 0.0, "", False
    score = 0.3 * (len(common) / len(spec_tokens))
    return score, sorted(common)[0], False


def match(
    message: str,
    context: Iterable[str] = (),
    commands: Iterable[CommandSpec] = (),
    *,
    sanitize: bool = True,
) -> list[Match]:
    """Return scored matches sorted by descending score (ties stable).

    Eligible commands only; ineligible ones are silently skipped. The
    caller is responsible for ranking, cooldown, and rendering.

    ``sanitize`` (default ``True``) strips fenced/inline code and
    previous suggestion-block echoes from both the message and the
    last 2 turns of context. The flag is exposed for tests that
    exercise the raw scoring path; runtime callers should leave it
    on.
    """
    if sanitize:
        message = sanitize_message(message)
        cleaned_ctx = sanitize_context(context)
    else:
        cleaned_ctx = list(context)
    ctx_text = "\n".join(cleaned_ctx[-2:])  # last 2 turns max
    matches: list[Match] = []
    for spec in commands:
        if not spec.eligible:
            continue
        d_score, d_evidence = _description_score(spec, message, ctx_text)
        c_score, c_evidence, structural = _context_score(spec, message, ctx_text)
        score = round(min(1.0, d_score + c_score), 4)
        if score <= 0:
            continue
        if d_score > 0 and c_score > 0:
            kind = "both"
            evidence = d_evidence if len(d_evidence) >= len(c_evidence) else c_evidence
        elif d_score > 0:
            kind = "description"
            evidence = d_evidence
        else:
            kind = "context"
            evidence = c_evidence
        matches.append(Match(
            command=spec.name,
            score=score,
            matched_trigger=kind,
            evidence=evidence,
            has_structural_bonus=structural,
        ))
    matches.sort(key=lambda m: (-m.score, m.command))
    return matches
