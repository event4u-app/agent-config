"""Suppress recently-shown suggestions per conversation.

Cooldown key is `(command_name, evidence)` so two distinct triggers
for the same command (e.g. `/commit` from "git status shows changes"
vs. from "save this to git") track separately. The user explicitly
invoking a command via `/command` clears that command's cooldown so
the next genuine match surfaces immediately.

The store is in-memory; persistence is the agent's job (conversation
state). Phase 5 wires the per-conversation `disabled_for_conversation`
flag into the same store.
"""
from __future__ import annotations

import re
import time
from typing import Mapping

from .types import CommandSpec, CooldownState, Match, Settings


_DURATION_RE = re.compile(r"^\s*(\d+)\s*([smhd])\s*$", re.IGNORECASE)
_DISABLE_DIRECTIVE_RE = re.compile(
    r"(?:^|\s)/command-suggestion-(off|on)\b", re.IGNORECASE
)
_EXPLICIT_SLASH_RE = re.compile(r"^\s*/[A-Za-z][A-Za-z0-9_-]*\b")


def is_explicit_slash_invocation(message: str) -> bool:
    """Return True when the message starts with an explicit ``/command``.

    Per the `command-suggestion` rule, explicit slash invocations
    bypass the suggestion layer entirely \u2014 they're handled by
    `slash-command-routing-policy` directly. The engine should not score in that
    case. Helper exposed for the runtime caller and the GT-CS4
    golden.
    """
    if not message:
        return False
    return bool(_EXPLICIT_SLASH_RE.match(message))


def detect_disable_directive(message: str) -> bool | None:
    """Detect a `/command-suggestion-off` / `-on` directive in the user message.

    Returns ``True`` to disable for the rest of the conversation,
    ``False`` to re-enable, ``None`` when no directive is present.
    The latest occurrence in the message wins (order-stable on tie).
    Mutating the `CooldownStore` is the caller's responsibility — this
    helper stays pure so tests don't have to fake time.
    """
    if not message:
        return None
    last: bool | None = None
    for m in _DISABLE_DIRECTIVE_RE.finditer(message):
        last = m.group(1).lower() == "off"
    return last


def parse_cooldown(value: str | None, default_seconds: int) -> int:
    """Convert `'10m'` / `'30s'` / `'1h'` / `'2d'` to seconds.

    Returns ``default_seconds`` for any malformed or missing input —
    keeping the runtime fail-soft. The schema validator caps the
    string length, so we never see absurd inputs in practice.
    """
    if not value:
        return default_seconds
    m = _DURATION_RE.match(str(value))
    if not m:
        return default_seconds
    n, unit = int(m.group(1)), m.group(2).lower()
    factor = {"s": 1, "m": 60, "h": 3600, "d": 86400}[unit]
    return n * factor


class CooldownStore:
    """Thin wrapper around `CooldownState` with time-aware helpers.

    Tests inject a fixed `now` to make decay deterministic; runtime
    leaves it as `time.time`.
    """

    def __init__(self, state: CooldownState | None = None, *, now=time.time):
        self.state = state or CooldownState()
        self._now = now

    def is_cooled_down(
        self, command: str, evidence: str, *, window_seconds: int
    ) -> bool:
        last = self.state.last_shown.get((command, evidence))
        if last is None:
            return False
        return (self._now() - last) < window_seconds

    def record_shown(self, matches: list[Match]) -> None:
        ts = self._now()
        for m in matches:
            self.state.last_shown[(m.command, m.evidence)] = ts

    def record_explicit_invocation(self, command: str) -> None:
        """Clear the cooldown when the user explicitly types `/command`.

        We drop every entry for that command (across all evidences)
        so a deliberate invocation always produces a clean slate.
        """
        ts = self._now()
        self.state.explicit_invocations[command] = ts
        keys_to_drop = [
            k for k in self.state.last_shown if k[0] == command
        ]
        for k in keys_to_drop:
            del self.state.last_shown[k]


def apply_cooldown(
    matches: list[Match],
    store: CooldownStore,
    settings: Settings,
    specs_by_name: Mapping[str, CommandSpec],
) -> list[Match]:
    if store.state.disabled_for_conversation:
        return []
    out: list[Match] = []
    for m in matches:
        spec = specs_by_name.get(m.command)
        per_cmd = spec.cooldown if spec else None
        window = parse_cooldown(per_cmd, settings.cooldown_seconds)
        if store.is_cooled_down(m.command, m.evidence, window_seconds=window):
            continue
        out.append(m)
    return out
