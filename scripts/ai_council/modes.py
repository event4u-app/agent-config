"""Mode resolution for council members (Phase 2b).

Each council member runs in exactly one transport mode per invocation:

- ``api``      — direct SDK call against the provider's API (billable).
- ``manual``   — copy-paste loop with the user as transport (free).
- ``playwright`` — browser automation (Phase 2c, not yet wired).

Resolution precedence — first non-empty wins:

    1. Invocation flag      e.g. ``/council mode:manual``
    2. Per-member setting   ``ai_council.members.<name>.mode``
    3. Global setting       ``ai_council.mode``
    4. Built-in default     ``manual``

This mirrors how ``cost_profile`` resolves in
``.augment/guidelines/agent-infra/layered-settings.md``.

The resolver is pure — it never touches the filesystem or environment.
Callers pass in already-loaded values from ``.agent-settings.yml``.
"""

from __future__ import annotations

from typing import Mapping

VALID_MODES: frozenset[str] = frozenset({"api", "manual", "playwright"})

DEFAULT_MODE: str = "manual"


class InvalidModeError(ValueError):
    """Raised when a configured / invoked mode is not in ``VALID_MODES``."""


def _normalise(value: object) -> str | None:
    if value is None:
        return None
    if not isinstance(value, str):
        return None
    s = value.strip().lower()
    return s or None


def _validate(mode: str | None, source: str) -> str | None:
    if mode is None:
        return None
    if mode not in VALID_MODES:
        raise InvalidModeError(
            f"{source} requested mode={mode!r}; "
            f"expected one of: {sorted(VALID_MODES)}"
        )
    return mode


def resolve_mode(
    member_name: str,
    *,
    invocation_mode: str | None = None,
    member_settings: Mapping[str, object] | None = None,
    global_mode: str | None = None,
) -> str:
    """Resolve the effective transport mode for one member.

    Args:
        member_name: e.g. ``"anthropic"`` or ``"openai"``. Used in error
            messages only — has no effect on precedence.
        invocation_mode: from a ``/council mode:<x>`` flag. Highest
            priority. ``None`` if the user did not pass a flag.
        member_settings: the dict at
            ``ai_council.members.<member_name>`` from
            ``.agent-settings.yml``. May contain a ``mode`` key.
        global_mode: from ``ai_council.mode``. Used when neither the
            invocation flag nor the per-member setting is present.

    Returns:
        One of ``VALID_MODES``. Never ``None``.

    Raises:
        InvalidModeError: if any non-empty layer requests a mode not in
            ``VALID_MODES``. The earliest layer (highest priority) is
            checked first; later layers are not validated when an
            earlier one already won.
    """
    inv = _validate(_normalise(invocation_mode), source=f"/council mode= for {member_name!r}")
    if inv is not None:
        return inv

    member_mode_raw: object | None = None
    if member_settings is not None:
        member_mode_raw = member_settings.get("mode")
    member = _validate(
        _normalise(member_mode_raw),
        source=f"ai_council.members.{member_name}.mode",
    )
    if member is not None:
        return member

    glob = _validate(_normalise(global_mode), source="ai_council.mode")
    if glob is not None:
        return glob

    return DEFAULT_MODE


def resolve_modes(
    member_names: list[str],
    *,
    invocation_mode: str | None = None,
    members_settings: Mapping[str, Mapping[str, object]] | None = None,
    global_mode: str | None = None,
) -> dict[str, str]:
    """Resolve modes for a batch of members. Convenience wrapper.

    ``members_settings`` is the full ``ai_council.members`` mapping;
    each member's sub-dict is forwarded to ``resolve_mode()``.
    """
    out: dict[str, str] = {}
    settings = members_settings or {}
    for name in member_names:
        out[name] = resolve_mode(
            name,
            invocation_mode=invocation_mode,
            member_settings=settings.get(name),
            global_mode=global_mode,
        )
    return out
