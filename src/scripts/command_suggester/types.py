"""Type definitions for the command suggestion engine.

Plain dataclasses — no third-party deps. Kept in a sibling module so
match/rank/cooldown/render can import without cycles.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional


@dataclass(frozen=True)
class CommandSpec:
    """Loaded command metadata that drives matching.

    Fields mirror the `suggestion:` frontmatter block plus the
    command's `name` and `description`. Ineligible commands are
    represented with `eligible=False` and are never returned by the
    matcher; the loader keeps them so cross-referencing stays simple.
    """

    name: str
    description: str
    eligible: bool
    trigger_description: str = ""
    trigger_context: str = ""
    rationale: str = ""
    confidence_floor: Optional[float] = None
    cooldown: Optional[str] = None


@dataclass(frozen=True)
class Match:
    """A scored candidate. `score` is 0.0–1.0 inclusive.

    `matched_trigger` is "description" | "context" | "both" and lets
    the renderer surface why a command surfaced. `evidence` is the
    short substring that fired (debugging / golden tests / explain).
    `has_structural_bonus` is True when a heavy-signal pattern (ticket
    key, file path, glob) co-occurred in the message — the ranker
    treats those as specific enough to bypass vague-input suppression.
    """

    command: str
    score: float
    matched_trigger: str
    evidence: str
    has_structural_bonus: bool = False


@dataclass(frozen=True)
class Settings:
    """Runtime knobs read from `.agent-settings.yml`.

    Defaults match the "open decisions" leans in the roadmap.
    Per-command frontmatter values override the global floor /
    cooldown.
    """

    enabled: bool = True
    confidence_floor: float = 0.6
    cooldown_seconds: int = 600  # 10m
    max_options: int = 4
    blocklist: tuple[str, ...] = ()


@dataclass
class CooldownState:
    """Per-conversation cooldown tracker — mutable on purpose."""

    last_shown: dict[tuple[str, str], float] = field(default_factory=dict)
    """Key: (command_name, trigger_evidence). Value: unix timestamp."""

    explicit_invocations: dict[str, float] = field(default_factory=dict)
    """Commands the user explicitly typed; clears their cooldown."""

    disabled_for_conversation: bool = False
    """Set by the `/command-suggestion-off` directive (Phase 5)."""
