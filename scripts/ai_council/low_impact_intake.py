"""Intake trigger + dedup for `agents/low-impact-decisions.md` (Phase 12).

User signals "leichte Frage" / "low-impact question" / equivalents
(see :data:`TRIGGER_PHRASES`); the host agent collects the
most-recently-asked question, translates to English, runs the privacy
redactor, and routes the result through this module.

Behaviour (per Phase 12 § Step 2):

- Normalise: lowercase, strip punctuation, collapse whitespace.
- Match against ``## On Probation`` → append today's UTC date to that
  entry's ``seen`` array (idempotent on same-day re-append).
- Match against ``## Validated`` → no-op, returns
  :class:`IntakeOutcome` with ``kind="duplicate_validated"``.
- No match → append a fresh entry under ``## On Probation`` with
  ``first-seen <today>`` and ``seen [<today>]``.

The promotion / pruning step is :mod:`probation_gate`, called by the
caller after intake (or at council startup).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal

#: User trigger phrases (DE + EN) — substring match, lowercase.
TRIGGER_PHRASES: tuple[str, ...] = (
    # German
    "das ist eine leichte frage",
    "eine leichte frage",
    "mach das selber",
    "lös das selber",
    "löse das im council",
    "frag das council",
    # English
    "low-impact question",
    "low impact question",
    "council should answer this",
    "you should know this yourself",
    "ask the council",
)

_PROBATION_HEADER = "## On Probation"
_VALIDATED_HEADER = "## Validated"
_ANTI_HEADER = "## Anti-Examples (Always Ask User)"
_NORMALISE_PUNCT_RE = re.compile(r"[^\w\s]")
_WHITESPACE_RE = re.compile(r"\s+")


@dataclass(frozen=True)
class IntakeOutcome:
    kind: Literal[
        "appended_seen", "new_probation", "duplicate_validated", "noop"
    ]
    question: str
    today: str
    note: str = ""


def matches_trigger(user_text: str) -> bool:
    """True when ``user_text`` carries any intake trigger phrase."""
    lo = user_text.lower()
    return any(p in lo for p in TRIGGER_PHRASES)


def normalise(question: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace."""
    out = question.lower().strip()
    out = _NORMALISE_PUNCT_RE.sub(" ", out)
    out = _WHITESPACE_RE.sub(" ", out)
    return out.strip()


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _split_sections(text: str) -> dict[str, tuple[int, int]]:
    """Return {header: (body_start, body_end)} char offsets."""
    headers = [_PROBATION_HEADER, _VALIDATED_HEADER, _ANTI_HEADER]
    spans: dict[str, tuple[int, int]] = {}
    for h in headers:
        i = text.find(h)
        if i < 0:
            continue
        body_start = text.find("\n", i) + 1
        next_header_i = len(text)
        for other in headers + ["## Security", "## Provenance"]:
            j = text.find("\n" + other, body_start)
            if 0 <= j < next_header_i:
                next_header_i = j
        spans[h] = (body_start, next_header_i)
    return spans


def _parse_entries(body: str) -> list[tuple[str, str]]:
    """Return [(quoted_question, full_line)] for ``- "…" — …`` bullets."""
    out: list[tuple[str, str]] = []
    for line in body.splitlines():
        m = re.match(r'^\s*-\s*"([^"]+)"', line)
        if m:
            out.append((m.group(1), line))
    return out


def record_intake(
    corpus_path: Path,
    question: str,
    *,
    today: str | None = None,
) -> IntakeOutcome:
    """Append intake signal to the corpus. Pure-text, deterministic."""
    today = today or _today()
    text = corpus_path.read_text(encoding="utf-8")
    norm_q = normalise(question)
    spans = _split_sections(text)

    if _VALIDATED_HEADER in spans:
        s, e = spans[_VALIDATED_HEADER]
        for q, _ in _parse_entries(text[s:e]):
            if normalise(q) == norm_q:
                return IntakeOutcome("duplicate_validated", question, today,
                                     "already learned")

    if _PROBATION_HEADER in spans:
        s, e = spans[_PROBATION_HEADER]
        body = text[s:e]
        for q, line in _parse_entries(body):
            if normalise(q) == norm_q:
                if today in line:
                    return IntakeOutcome("noop", question, today,
                                         "already seen today")
                new_line = _append_seen(line, today)
                new_text = text[:s] + body.replace(line, new_line, 1) + text[e:]
                corpus_path.write_text(new_text, encoding="utf-8")
                return IntakeOutcome("appended_seen", question, today)

        new_entry = (
            f'- "{question.strip()}" — first-seen {today} '
            f'· seen [{today}]\n'
        )
        new_text = text[:e].rstrip() + "\n\n" + new_entry + "\n" + text[e:]
        corpus_path.write_text(new_text, encoding="utf-8")
        return IntakeOutcome("new_probation", question, today)

    return IntakeOutcome("noop", question, today, "probation section missing")


def _append_seen(line: str, today: str) -> str:
    """Append ``today`` to the ``seen [...]`` array on a probation line."""
    def _sub(m: re.Match[str]) -> str:
        body = m.group(1).strip()
        if today in body:
            return m.group(0)
        new_body = (body + ", " + today) if body else today
        return f"seen [{new_body}]"
    if "seen [" in line:
        return re.sub(r"seen \[([^\]]*)\]", _sub, line)
    return line.rstrip() + f" · seen [{today}]"
