"""Resolve the ``inputs`` and ``pack`` why-slots for the trace.

Reuses :mod:`scripts.config.profiles` and :mod:`scripts.config.presets`
so the rendered chain matches what the runtime loader actually
consulted (no parallel logic — the v1 ``explain config`` surface
already covers this and we read through the same resolvers).
"""
from __future__ import annotations

import logging
from contextlib import contextmanager
from pathlib import Path
from typing import Any

from scripts._cli.explain_last.scrubber import scrub_string
from scripts._lib.agent_settings import DEFAULT_PROJECT_FILE, load_agent_settings
from scripts.config import presets, profiles

_DEFAULT_COST_PROFILE = "balanced"
_SILENCED_LOGGERS = ("scripts.config.profiles", "scripts.config.presets")


@contextmanager
def _silence_resolver_warnings():
    # Profile / preset loggers emit absolute paths on read failure;
    # the explain trace must never leak them. Failures bubble up via
    # ProfileError / PresetError anyway, so the warning has no signal.
    previous: list[tuple[logging.Logger, int]] = []
    for name in _SILENCED_LOGGERS:
        log = logging.getLogger(name)
        previous.append((log, log.level))
        log.setLevel(logging.ERROR)
    try:
        yield
    finally:
        for log, level in previous:
            log.setLevel(level)


def _load_settings(project_root: Path) -> dict[str, Any]:
    path = project_root / DEFAULT_PROJECT_FILE
    if not path.exists():
        return {}
    return load_agent_settings(project_path=path) or {}


def build(project_root: Path) -> dict[str, Any] | None:
    """Return the ``inputs`` slot or ``None`` on broken settings.

    Each knob carries its source (``pack | profile | preset | user |
    env | runtime | default``) so the renderer's table can attribute
    the value to the layer that won the resolution race.
    """
    try:
        with _silence_resolver_warnings():
            settings = _load_settings(project_root)
            resolved_profile = profiles.resolve_profile(
                project_root=project_root,
                user_settings=settings,
            )
            resolved_preset = presets.resolve_preset(
                project_root=project_root,
                user_settings=settings,
                profile_preset_id=resolved_profile.preset_id,
            )
    except (profiles.ProfileError, presets.PresetError, OSError):
        return None
    cost_profile = settings.get("cost_profile") if isinstance(settings, dict) else None
    cost_profile_source = "user" if cost_profile else "default"
    if not cost_profile or cost_profile == "__COST_PROFILE__":
        cost_profile = _DEFAULT_COST_PROFILE
        cost_profile_source = "default"
    return {
        "profile": scrub_string(resolved_profile.id),
        "preset": scrub_string(resolved_preset.id),
        "cost_profile": scrub_string(str(cost_profile)),
        "source_per_knob": {
            "profile": resolved_profile.source,
            "preset": resolved_preset.source,
            "cost_profile": cost_profile_source,
        },
    }


def _pack_marker(project_root: Path) -> Path | None:
    for candidate in (
        project_root / ".agent-pack.yml",
        project_root / ".agent-src.uncompressed" / ".agent-pack.yml",
    ):
        if candidate.exists():
            return candidate
    return None


def build_pack(project_root: Path) -> dict[str, Any] | None:
    """Return the active workspace pack or ``None``.

    The discovery pipeline (R3) writes a ``.agent-pack.yml`` marker
    when a pack is bound to the project. We surface only the id and a
    short reason; pack-internal payloads stay invisible to the trace.
    """
    marker = _pack_marker(project_root)
    if marker is None:
        return None
    try:
        import yaml  # type: ignore[import-not-found]
    except ImportError:
        return None
    try:
        raw = yaml.safe_load(marker.read_text(encoding="utf-8")) or {}
    except (OSError, yaml.YAMLError):
        return None
    if not isinstance(raw, dict):
        return None
    pack_id = raw.get("id") or raw.get("pack")
    if not isinstance(pack_id, str) or not pack_id.strip():
        return None
    reason = raw.get("reason") or f"declared in {marker.name}"
    return {
        "id": scrub_string(pack_id.strip()),
        "reason": scrub_string(str(reason)),
    }


__all__ = ["build", "build_pack"]
