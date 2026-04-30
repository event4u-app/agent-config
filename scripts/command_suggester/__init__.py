"""Context-aware command suggestion engine.

Public API exposed for the always-on `command-suggestion` rule and for
tests. The engine is **deterministic** and **read-only**: it scores
candidate commands against a user message + recent context, applies
ranking, suppresses cooled-down suggestions, and renders a numbered
options block. It never executes a command — the user pick is what
triggers the standard slash flow.

See `agents/contexts/command-suggestion-eligibility.md` for the
locked eligibility table and `road-to-context-aware-command-suggestion`
for the full design.
"""
from .types import CommandSpec, Match, Settings, CooldownState
from .loader import load_commands
from .match import match
from .rank import rank
from .cooldown import (
    apply_cooldown,
    CooldownStore,
    detect_disable_directive,
    is_explicit_slash_invocation,
)
from .render import render
from .sanitize import (
    sanitize_context,
    sanitize_message,
    strip_code_blocks,
    strip_suggestion_echo,
)
from .settings import load_settings

__all__ = [
    "CommandSpec",
    "Match",
    "Settings",
    "CooldownState",
    "CooldownStore",
    "load_commands",
    "load_settings",
    "match",
    "rank",
    "apply_cooldown",
    "detect_disable_directive",
    "is_explicit_slash_invocation",
    "render",
    "sanitize_context",
    "sanitize_message",
    "strip_code_blocks",
    "strip_suggestion_echo",
]
