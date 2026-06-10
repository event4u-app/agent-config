"""profile_explain — the `profile-overlay` explain envelope + renderer.

Phase 2 of road-to-session-profile-observability: answer "why is the agent
behaving differently / why is the surface different?" over the session-profile
overlay, in plain language by default (`technical` for an engineering lead).

Trust boundary (AI-council amendment): the renderer is a **pure template** over
the envelope fields — it NEVER calls an LLM and NEVER reads beyond the overlay
state it is handed. `build_profile_envelope` is the only place that reads state;
`render_profile_overlay` is a pure function of the envelope (golden-testable).

Reuses the explain-modes two-views-over-one-envelope convention
(`docs/contracts/explain-modes.md`).
"""

from __future__ import annotations

from typing import Any

ENVELOPE_TYPE = "profile-overlay"


def build_profile_envelope(
    active_packs: list[str],
    commands_shown: int,
    skills_shown: int,
    hidden_total: int,
) -> dict[str, Any]:
    """Build the `profile-overlay` envelope from the `show`/`surface` state.

    Only the persisted overlay state is available, so seed-vs-closure split and
    staleness-age-in-days are intentionally NOT fields (the overlay stores the
    effective pack set, no request log, no timestamp — see the contract). The
    overlay set is reported as the effective `active_packs`; staleness is
    persistence, not an age.
    """
    return {
        "envelope_type": ENVELOPE_TYPE,
        "active": list(active_packs),
        "commands_shown": commands_shown,
        "skills_shown": skills_shown,
        "hidden_total": hidden_total,
        # deterministic "what changed vs the full surface"
        "delta": {"hidden_behind_inactive_packs": hidden_total},
        # staleness = persistence (no timestamp in the overlay)
        "persists_across_sessions": bool(active_packs),
    }


def _g(env: dict[str, Any], key: str, default: Any) -> Any:
    """Missing-field-tolerant getter — the renderer never throws on a partial
    envelope (a missing field renders a placeholder, per the coverage spec)."""
    v = env.get(key, default)
    return default if v is None else v


def render_profile_overlay(envelope: dict[str, Any], mode: str = "plain") -> str:
    """Pure render of the `profile-overlay` envelope. `plain` (default) for a
    non-technical employee; `technical` for an engineering lead. Never raises on
    a partial envelope."""
    active = _g(envelope, "active", [])
    cmds = _g(envelope, "commands_shown", "?")
    skills = _g(envelope, "skills_shown", "?")
    hidden = _g(envelope, "hidden_total", "?")

    if not active:
        if mode == "technical":
            return "profile-overlay: none active — full surface (no filtering)."
        return (
            "Nothing is filtered — no profile is active, so you see every command "
            "and skill. The agent isn't hiding anything."
        )

    names = ", ".join(active) if isinstance(active, list) else str(active)
    if mode == "technical":
        return "\n".join([
            f"profile-overlay: active=[{names}]",
            f"  surfaced: commands={cmds} skills={skills}",
            f"  hidden:   {hidden} (behind inactive packs)",
            "  delta:    surface = full ∖ (artefacts whose packs ∉ active)",
            "  staleness: persists across sessions (overlay has no timestamp)",
        ])
    return "\n".join([
        f"Why the surface looks different: a profile is active ({names}).",
        f"It shows you {cmds} commands and {skills} skills, and hides {hidden} "
        "behind packs you haven't turned on — that's why some commands aren't visible.",
        "Nothing is broken; the overlay just narrows the surface to this profile.",
        "It stays this way across sessions until you run `/profile deactivate`.",
    ])
