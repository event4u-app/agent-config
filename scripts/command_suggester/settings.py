"""Read `commands.suggestion.*` from `.agent-settings.yml` into `Settings`.

Mirror of the chat-history pattern (`scripts/chat_history.py`):

* Lazy PyYAML import — the engine works without yaml installed when no
  settings file is present (test fixtures, cloud bundles).
* Default-permissive: a missing file or missing section returns
  `Settings()` defaults (suggestion layer enabled). Only an explicit
  `enabled: false` flips the master switch off.
* Malformed YAML / unreadable file → defaults; the suggester degrades
  silently rather than crashing the turn.
* Type-coerces with bounded fallbacks (floors clamped 0.0-1.0, ints
  non-negative, blocklist forced to a tuple of strings).
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Iterable

from .types import Settings

DEFAULT_SETTINGS_FILE = ".agent-settings.yml"

_DEFAULT = Settings()


def load_settings(settings_path: Path | str | None = None) -> Settings:
    """Return a `Settings` instance hydrated from `.agent-settings.yml`.

    Parameters
    ----------
    settings_path:
        Explicit override. ``None`` resolves to ``./.agent-settings.yml``
        relative to the current working directory — same convention as
        ``chat_history``.
    """
    path = Path(settings_path) if settings_path else Path(DEFAULT_SETTINGS_FILE)
    raw = _read_section(path)
    if raw is None:
        return _DEFAULT
    return _settings_from_raw(raw)


def _read_section(path: Path) -> dict[str, Any] | None:
    """Return the ``commands.suggestion`` mapping or ``None`` on any miss."""
    if not path.is_file():
        return None
    try:
        import yaml  # type: ignore[import-untyped]
    except ImportError:
        return None
    try:
        with path.open(encoding="utf-8") as fh:
            data = yaml.safe_load(fh) or {}
    except (OSError, yaml.YAMLError):
        return None
    if not isinstance(data, dict):
        return None
    commands = data.get("commands")
    if not isinstance(commands, dict):
        return None
    section = commands.get("suggestion")
    if not isinstance(section, dict):
        return None
    return section


def _settings_from_raw(raw: dict[str, Any]) -> Settings:
    return Settings(
        enabled=_coerce_bool(raw.get("enabled"), _DEFAULT.enabled),
        confidence_floor=_coerce_floor(
            raw.get("confidence_floor"), _DEFAULT.confidence_floor
        ),
        cooldown_seconds=_coerce_nonneg_int(
            raw.get("cooldown_seconds"), _DEFAULT.cooldown_seconds
        ),
        max_options=_coerce_nonneg_int(
            raw.get("max_options"), _DEFAULT.max_options
        ),
        blocklist=_coerce_str_tuple(raw.get("blocklist")),
    )


def _coerce_bool(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if value is None:
        return default
    if isinstance(value, str):
        s = value.strip().lower()
        if s in ("true", "yes", "on", "1"):
            return True
        if s in ("false", "no", "off", "0"):
            return False
    return default


def _coerce_floor(value: Any, default: float) -> float:
    try:
        f = float(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default
    if f < 0.0:
        return 0.0
    if f > 1.0:
        return 1.0
    return f


def _coerce_nonneg_int(value: Any, default: int) -> int:
    try:
        i = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default
    return i if i >= 0 else default


def _coerce_str_tuple(value: Any) -> tuple[str, ...]:
    if not isinstance(value, Iterable) or isinstance(value, (str, bytes)):
        return ()
    out: list[str] = []
    for item in value:
        if isinstance(item, str) and item.strip():
            out.append(item.strip())
    return tuple(out)
