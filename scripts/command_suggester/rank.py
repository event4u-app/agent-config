"""Rank scored matches into the final candidate list.

Pipeline:
1. Drop commands whose name is in `settings.blocklist`.
2. Drop matches below the effective `confidence_floor` (per-command
   override if set, else global).
3. Anti-noise:
   - vague-input suppression (short message + many candidates, no structural bonus)
   - lonely-band suppression (single match below `floor + 0.1`, no structural bonus)
   - continuation suppression (message is pure follow-through, no new intent)
4. Sort by score desc; tie-break:
   - structural bonus wins (named entities outrank generic verbs)
   - longer matched evidence wins (more specific trigger)
   - alphabetic command name wins (stable, deterministic)
5. Cap at `settings.max_options`.
"""
from __future__ import annotations

import re
from typing import Iterable, Mapping

from .types import CommandSpec, Match, Settings

_LONELY_BAND = 0.1  # roadmap Phase 4: floor + 0.1 lonely-match threshold

_CONTINUATION_PHRASES: frozenset[str] = frozenset({
    # English
    "ok", "okay", "yes", "no", "sure", "go", "do it", "go on",
    "continue", "next", "proceed", "more", "again",
    # German
    "ja", "nein", "weiter", "mach weiter", "los", "machen",
    "weitermachen", "fortfahren", "nochmal",
})


def _floor_for(name: str, specs_by_name: Mapping[str, CommandSpec], settings: Settings) -> float:
    spec = specs_by_name.get(name)
    if spec and spec.confidence_floor is not None:
        return spec.confidence_floor
    return settings.confidence_floor


def _vague_input_suppression(message: str, matches: list[Match]) -> bool:
    """Short prompts hitting many commands are usually too ambiguous.

    Suppress when:
    - message has < 6 words
    - more than 2 matches survived the floor
    - none of the matches carry a structural bonus (ticket key, path)

    A structural bonus means the prompt was specific even if short
    — `"setze ABC-123 um"` is 3 words but unambiguous.
    """
    word_count = len(message.split())
    if word_count >= 6 or len(matches) <= 2:
        return False
    return not any(m.has_structural_bonus for m in matches)


def _sub_floor_lonely_suppression(matches: list[Match], floor: float) -> bool:
    """Single match whose score sits within `floor + _LONELY_BAND`.

    Roadmap Phase 4 sets this band at 0.1 — a single signal that
    barely clears the floor is too uncertain to interrupt for. A
    structural bonus (ticket key, path) overrides the suppression
    because the match is already grounded in a specific entity.
    """
    if len(matches) != 1:
        return False
    if matches[0].has_structural_bonus:
        return False
    return matches[0].score < floor + _LONELY_BAND


def _continuation_suppression(message: str, matches: list[Match]) -> bool:
    """Pure follow-through messages carry no new intent — suppress.

    Triggers when the message reduces to a known continuation phrase
    (`ok`, `weiter`, `mach weiter`, …) once trailing punctuation is
    stripped. A structural bonus (ticket key, path) overrides — even
    `"weiter mit ABC-123"` is a fresh intent signal.
    """
    stripped = re.sub(r"[\s\W_]+", " ", message or "", flags=re.UNICODE).strip().lower()
    if not stripped:
        return False
    if stripped not in _CONTINUATION_PHRASES:
        return False
    return not any(m.has_structural_bonus for m in matches)


def _tie_break_key(m: Match) -> tuple[float, int, int, str]:
    # Score desc, structural bonus first, longer evidence first, alpha last.
    return (-m.score, 0 if m.has_structural_bonus else 1, -len(m.evidence), m.command)


def rank(
    matches: Iterable[Match],
    settings: Settings,
    specs_by_name: Mapping[str, CommandSpec],
    *,
    raw_message: str = "",
) -> list[Match]:
    if not settings.enabled:
        return []
    blocked = set(settings.blocklist)
    candidates: list[Match] = [m for m in matches if m.command not in blocked]
    above_floor: list[Match] = [
        m for m in candidates
        if m.score >= _floor_for(m.command, specs_by_name, settings)
    ]
    if _continuation_suppression(raw_message, above_floor):
        return []
    if _vague_input_suppression(raw_message, above_floor):
        return []
    if _sub_floor_lonely_suppression(above_floor, settings.confidence_floor):
        return []
    above_floor.sort(key=_tie_break_key)
    if settings.max_options > 0:
        return above_floor[: settings.max_options]
    return above_floor
