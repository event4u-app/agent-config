"""Profile loader — step-15 Phase 1 item 1.

Resolves the active ``profile.id`` from the chain documented in
:mod:`docs.contracts.profile-system` and returns a structured
:class:`ResolvedProfile`. Pure, read-only, lazy-PyYAML.

Resolution chain (last writer wins):

1. Pack-supplied ``profile_id`` (Phase 2 item 7 — pack loader passes it
   in via ``pack_profile_id``; ``None`` until packs land).
2. ``.agent-settings.yml`` top-level ``profile.id`` (and any user
   overrides for ``audience`` / ``defaults`` / ``surface``).
3. Environment variable ``AGENT_CONFIG_PROFILE_ID``.
4. Runtime CLI flag — caller passes ``runtime_id``.

Falls back to ``developer`` **only** when no settings file exists yet
(fresh install before ``/onboard``). With a settings file present but
no ``profile`` block, the loader returns a structured warning state so
``/onboard`` can surface "audience not yet picked".
"""
from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from scripts._lib import agent_settings

logger = logging.getLogger(__name__)

PROFILE_ID_ENV = "AGENT_CONFIG_PROFILE_ID"
SEED_PROFILE_IDS: tuple[str, ...] = (
    "founder",
    "developer",
    "content_creator",
    "agency",
    "finance",
    "ops",
)
DEFAULT_PROFILE_ID = "developer"
PROFILES_DIRNAME = ".agent-src.uncondensed/profiles"

SOURCE_PACK = "pack"
SOURCE_USER = "user-settings"
SOURCE_ENV = "env"
SOURCE_RUNTIME = "runtime"
SOURCE_DEFAULT = "default"
SOURCE_MISSING = "missing"


@dataclass(frozen=True)
class ResolvedProfile:
    """Outcome of :func:`resolve_profile`. See profile-system contract."""

    id: str
    audience: dict[str, str] = field(default_factory=dict)
    preset_id: str | None = None
    packs: tuple[str, ...] = ()
    personas: tuple[str, ...] = ()
    skills_hint: tuple[str, ...] = ()
    commands_hint: tuple[str, ...] = ()
    docs_first_pointer: str | None = None
    source: str = SOURCE_DEFAULT
    warning: str | None = None


class ProfileError(Exception):
    """Raised when a profile id is referenced but its YAML cannot load."""


def _load_yaml(path: Path) -> dict[str, Any]:
    try:
        import yaml  # type: ignore[import-not-found]
    except ImportError:
        logger.info("PyYAML unavailable; profile %s returned empty", path)
        return {}
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        logger.warning("profile read failed for %s: %s", path, exc)
        return {}
    try:
        data = yaml.safe_load(text) or {}
    except yaml.YAMLError as exc:
        logger.warning("profile parse failed for %s: %s", path, exc)
        return {}
    return data if isinstance(data, dict) else {}


def _profile_file(project_root: Path, profile_id: str) -> Path:
    legacy = project_root / PROFILES_DIRNAME / f"{profile_id}.yml"
    if legacy.exists():
        return legacy
    try:
        import sys as _sys
        scripts_root = Path(__file__).resolve().parents[1]
        if str(scripts_root) not in _sys.path:
            _sys.path.insert(0, str(scripts_root))
        from _lib.agent_src import artefact_roots  # type: ignore
    except Exception:
        return legacy
    for root in artefact_roots():
        candidate = root / "profiles" / f"{profile_id}.yml"
        if candidate.exists():
            return candidate
    return legacy


def _build_resolved(
    profile_id: str,
    raw: dict[str, Any],
    *,
    source: str,
    warning: str | None = None,
) -> ResolvedProfile:
    block = raw.get("profile") or {}
    audience_raw = block.get("audience") or {}
    defaults = block.get("defaults") or {}
    surface = block.get("surface") or {}
    audience = {str(k): str(v) for k, v in audience_raw.items()}
    packs = tuple(str(p) for p in (block.get("packs") or []))
    personas = tuple(str(p) for p in (defaults.get("personas") or []))
    skills_hint = tuple(str(s) for s in (defaults.get("skills_hint") or []))
    commands_hint = tuple(str(c) for c in (surface.get("commands_hint") or []))
    docs_pointer = surface.get("docs_first_pointer")
    return ResolvedProfile(
        id=profile_id,
        audience=audience,
        preset_id=defaults.get("preset_id"),
        packs=packs,
        personas=personas,
        skills_hint=skills_hint,
        commands_hint=commands_hint,
        docs_first_pointer=str(docs_pointer) if docs_pointer else None,
        source=source,
        warning=warning,
    )


def _pick_id(
    pack_profile_id: str | None,
    user_settings: dict[str, Any],
    runtime_id: str | None,
) -> tuple[str | None, str]:
    if runtime_id:
        return runtime_id, SOURCE_RUNTIME
    env_id = os.environ.get(PROFILE_ID_ENV)
    if env_id:
        return env_id, SOURCE_ENV
    block = user_settings.get("profile") if isinstance(user_settings, dict) else None
    if isinstance(block, dict) and block.get("id"):
        return str(block["id"]), SOURCE_USER
    if pack_profile_id:
        return pack_profile_id, SOURCE_PACK
    return None, SOURCE_MISSING


def resolve_profile(
    *,
    project_root: Path,
    user_settings: dict[str, Any] | None = None,
    pack_profile_id: str | None = None,
    runtime_id: str | None = None,
) -> ResolvedProfile:
    """Return the active :class:`ResolvedProfile` for the current session."""
    settings = user_settings or {}
    settings_file = project_root / agent_settings.DEFAULT_PROJECT_FILE
    profile_id, source = _pick_id(pack_profile_id, settings, runtime_id)
    if profile_id is None:
        if settings_file.exists():
            return ResolvedProfile(
                id=DEFAULT_PROFILE_ID,
                source=SOURCE_MISSING,
                warning=(
                    "no profile.id in .agent-settings.yml — run /onboard to "
                    "pick an audience deliberately"
                ),
            )
        return _build_resolved(
            DEFAULT_PROFILE_ID,
            _load_yaml(_profile_file(project_root, DEFAULT_PROFILE_ID)),
            source=SOURCE_DEFAULT,
        )
    yaml_path = _profile_file(project_root, profile_id)
    if not yaml_path.exists():
        raise ProfileError(
            f"profile.id={profile_id!r} ({source}) but {yaml_path} not found",
        )
    return _build_resolved(profile_id, _load_yaml(yaml_path), source=source)
