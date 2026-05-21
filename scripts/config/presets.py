"""Preset loader — step-15 Phase 1 item 4.

Resolves the active ``preset.id`` and merged knob set from the chain
documented in :mod:`docs.contracts.config-presets`. Pure, read-only,
lazy-PyYAML.

Resolution chain (last writer wins for any single knob):

1. ``pack.preset_id`` — set ``preset.id`` (Phase 2; ``None`` until packs
   land).
2. ``profile.preset_id`` — set ``preset.id`` if not pack-set.
3. ``preset.<id>.yml`` — fill all knobs from the seed file.
4. ``.agent-settings.yml`` user keys under ``preset:`` — override per-knob.
5. Environment variables (``AGENT_CONFIG_PRESET_*``) — override per-knob,
   structured keys mapped from the schema (see :data:`ENV_KNOB_MAP`).
6. Runtime CLI overrides — caller passes a flat ``runtime_overrides`` map.

Profile-aware overlay is **not** done here — callers that need
profile-specific reads of preset knobs (e.g. ``block_on_risk.code_paths``
for ``developer`` vs ``block_on_risk.financial_paths`` for ``founder``)
read the merged knob bag returned by :func:`resolve_preset`.
"""
from __future__ import annotations

import logging
import os
from copy import deepcopy
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

PRESET_ID_ENV = "AGENT_CONFIG_PRESET_ID"
SEED_PRESET_IDS: tuple[str, ...] = ("fast", "balanced", "strict")
DEFAULT_PRESET_ID = "balanced"
PRESETS_DIRNAME = ".agent-src.uncompressed/presets"

SOURCE_PACK = "pack"
SOURCE_PROFILE = "profile"
SOURCE_USER = "user-settings"
SOURCE_ENV = "env"
SOURCE_RUNTIME = "runtime"
SOURCE_DEFAULT = "default"

ENV_KNOB_MAP: dict[str, tuple[str, ...]] = {
    "AGENT_CONFIG_PRESET_COST_DAILY_MAX_USD": ("cost", "daily_max_usd"),
    "AGENT_CONFIG_PRESET_COST_WEEKLY_MAX_USD": ("cost", "weekly_max_usd"),
    "AGENT_CONFIG_PRESET_COST_MONTHLY_MAX_USD": ("cost", "monthly_max_usd"),
    "AGENT_CONFIG_PRESET_MCP_PER_CALL_MAX_USD": ("mcp", "per_call_max_usd"),
    "AGENT_CONFIG_PRESET_MCP_PER_SESSION_MAX_USD": ("mcp", "per_session_max_usd"),
    "AGENT_CONFIG_PRESET_COUNCIL_CAP_PER_CONSULT_USD": (
        "council",
        "cap_per_consult_usd",
    ),
    "AGENT_CONFIG_PRESET_AUTONOMY_DEFAULT": ("autonomy", "default"),
    "AGENT_CONFIG_PRESET_CONFIDENCE_MIN_BAND": ("confidence", "min_band"),
}


@dataclass(frozen=True)
class ResolvedPreset:
    """Outcome of :func:`resolve_preset`. See config-presets contract."""

    id: str
    knobs: dict[str, Any] = field(default_factory=dict)
    source: str = SOURCE_DEFAULT
    overrides: tuple[str, ...] = ()
    warning: str | None = None


class PresetError(Exception):
    """Raised when a preset id is referenced but its YAML cannot load."""


def _load_yaml(path: Path) -> dict[str, Any]:
    try:
        import yaml  # type: ignore[import-not-found]
    except ImportError:
        logger.info("PyYAML unavailable; preset %s returned empty", path)
        return {}
    try:
        text = path.read_text(encoding="utf-8")
    except OSError as exc:
        logger.warning("preset read failed for %s: %s", path, exc)
        return {}
    try:
        data = yaml.safe_load(text) or {}
    except yaml.YAMLError as exc:
        logger.warning("preset parse failed for %s: %s", path, exc)
        return {}
    return data if isinstance(data, dict) else {}


def _preset_file(project_root: Path, preset_id: str) -> Path:
    # Legacy single-root layout — honor when present so tests that mock a
    # ``.agent-src.uncompressed/`` sub-tree under ``project_root`` keep working.
    legacy = project_root / PRESETS_DIRNAME / f"{preset_id}.yml"
    if legacy.exists():
        return legacy
    # Monorepo layout — scan every package root via the agent_src helper.
    try:
        import sys as _sys
        scripts_root = Path(__file__).resolve().parents[1]
        if str(scripts_root) not in _sys.path:
            _sys.path.insert(0, str(scripts_root))
        from _lib.agent_src import artefact_roots  # type: ignore
    except Exception:
        return legacy
    for root in artefact_roots():
        candidate = root / "presets" / f"{preset_id}.yml"
        if candidate.exists():
            return candidate
    return legacy


def _coerce_scalar(raw: str) -> Any:
    try:
        return int(raw)
    except ValueError:
        pass
    try:
        return float(raw)
    except ValueError:
        pass
    if raw.lower() in {"true", "false"}:
        return raw.lower() == "true"
    return raw


def _deep_merge(base: dict[str, Any], override: dict[str, Any]) -> list[str]:
    """Merge ``override`` into ``base`` in place; return dotted-override paths."""
    paths: list[str] = []

    def walk(b: dict[str, Any], o: dict[str, Any], prefix: str) -> None:
        for key, value in o.items():
            dotted = f"{prefix}{key}"
            if isinstance(value, dict) and isinstance(b.get(key), dict):
                walk(b[key], value, f"{dotted}.")
            else:
                b[key] = deepcopy(value)
                paths.append(dotted)

    walk(base, override, "")
    return paths


def _pick_id(
    pack_preset_id: str | None,
    profile_preset_id: str | None,
    user_settings: dict[str, Any],
    runtime_id: str | None,
) -> tuple[str | None, str]:
    if runtime_id:
        return runtime_id, SOURCE_RUNTIME
    env_id = os.environ.get(PRESET_ID_ENV)
    if env_id:
        return env_id, SOURCE_ENV
    block = user_settings.get("preset") if isinstance(user_settings, dict) else None
    if isinstance(block, dict) and block.get("id"):
        return str(block["id"]), SOURCE_USER
    if pack_preset_id:
        return pack_preset_id, SOURCE_PACK
    if profile_preset_id:
        return profile_preset_id, SOURCE_PROFILE
    return None, SOURCE_DEFAULT


def resolve_preset(
    *,
    project_root: Path,
    user_settings: dict[str, Any] | None = None,
    pack_preset_id: str | None = None,
    profile_preset_id: str | None = None,
    runtime_id: str | None = None,
    runtime_overrides: dict[tuple[str, ...], Any] | None = None,
) -> ResolvedPreset:
    """Return the active :class:`ResolvedPreset` for the current session."""
    settings = user_settings or {}
    preset_id, source = _pick_id(
        pack_preset_id, profile_preset_id, settings, runtime_id,
    )
    if preset_id is None:
        preset_id = DEFAULT_PRESET_ID
        source = SOURCE_DEFAULT
    yaml_path = _preset_file(project_root, preset_id)
    if not yaml_path.exists():
        raise PresetError(
            f"preset.id={preset_id!r} ({source}) but {yaml_path} not found",
        )
    raw = _load_yaml(yaml_path)
    knobs = raw.get("preset") or {}
    if not isinstance(knobs, dict):
        raise PresetError(f"{yaml_path} has no top-level 'preset:' mapping")
    knobs = deepcopy(knobs)
    knobs.pop("id", None)
    overrides: list[str] = []
    user_block = settings.get("preset") if isinstance(settings.get("preset"), dict) else None
    if isinstance(user_block, dict):
        user_overrides = {k: v for k, v in user_block.items() if k != "id"}
        if user_overrides:
            overrides.extend(_deep_merge(knobs, user_overrides))
    for env_key, path in ENV_KNOB_MAP.items():
        raw_value = os.environ.get(env_key)
        if raw_value is None:
            continue
        cursor = knobs
        for part in path[:-1]:
            cursor = cursor.setdefault(part, {})
        cursor[path[-1]] = _coerce_scalar(raw_value)
        overrides.append(".".join(path))
    if runtime_overrides:
        for path, value in runtime_overrides.items():
            cursor = knobs
            for part in path[:-1]:
                cursor = cursor.setdefault(part, {})
            cursor[path[-1]] = value
            overrides.append(".".join(path))
    return ResolvedPreset(
        id=preset_id,
        knobs=knobs,
        source=source,
        overrides=tuple(overrides),
    )
