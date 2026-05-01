"""Read ``hooks.*`` from ``.agent-settings.yml`` into :class:`HookSettings`.

Mirror of the chat-history settings pattern (``scripts/command_suggester/
settings.py``):

* Lazy PyYAML import — the engine works without yaml installed when no
  settings file is present (test fixtures, cloud bundles).
* Default-permissive: a missing file or missing ``hooks:`` block returns
  :class:`HookSettings` with ``enabled=False`` — every hook off, every
  golden replay safe by construction.
* Malformed YAML / unreadable file → defaults; the engine degrades
  silently rather than crashing the CLI.
* Chat-history hooks gate on **two** switches: ``hooks.chat_history.
  enabled`` AND the global ``chat_history.enabled``. Either off → no
  chat-history hook registers.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

DEFAULT_SETTINGS_FILE = ".agent-settings.yml"
DEFAULT_CHAT_HISTORY_SCRIPT = "scripts/chat_history.py"


@dataclass(frozen=True)
class HookSettings:
    """Resolved view of the ``hooks:`` block.

    ``enabled`` is the master switch. When ``False`` the registry stays
    empty regardless of the per-hook fields; this is the default when no
    settings file exists or no ``hooks`` block is declared, and it is
    what keeps golden-replay tests byte-stable.
    """

    enabled: bool = False
    trace: bool = False
    halt_surface_audit: bool = False
    state_shape_validation: bool = False
    directive_set_guard: bool = False
    chat_history_enabled: bool = False
    chat_history_script: str = DEFAULT_CHAT_HISTORY_SCRIPT


_DEFAULT = HookSettings()


def load_hook_settings(
    settings_path: Path | str | None = None,
) -> HookSettings:
    """Return :class:`HookSettings` hydrated from ``.agent-settings.yml``.

    ``settings_path`` defaults to ``./.agent-settings.yml`` relative to
    the current working directory — same convention as chat-history.
    """
    path = Path(settings_path) if settings_path else Path(DEFAULT_SETTINGS_FILE)
    raw = _read_yaml(path)
    if raw is None:
        return _DEFAULT
    return _settings_from_raw(raw)


def _read_yaml(path: Path) -> dict[str, Any] | None:
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
    return data


def _settings_from_raw(data: dict[str, Any]) -> HookSettings:
    hooks = data.get("hooks")
    if not isinstance(hooks, dict):
        return _DEFAULT
    enabled = _coerce_bool(hooks.get("enabled"), False)
    if not enabled:
        return HookSettings(enabled=False)

    chat_section = hooks.get("chat_history")
    if isinstance(chat_section, dict):
        chat_block_enabled = _coerce_bool(chat_section.get("enabled"), True)
        chat_script = str(
            chat_section.get("script") or DEFAULT_CHAT_HISTORY_SCRIPT
        )
    else:
        chat_block_enabled = True
        chat_script = DEFAULT_CHAT_HISTORY_SCRIPT

    global_chat = data.get("chat_history")
    global_chat_on = (
        isinstance(global_chat, dict)
        and _coerce_bool(global_chat.get("enabled"), False)
    )

    return HookSettings(
        enabled=True,
        trace=_coerce_bool(hooks.get("trace"), False),
        halt_surface_audit=_coerce_bool(
            hooks.get("halt_surface_audit"), True
        ),
        state_shape_validation=_coerce_bool(
            hooks.get("state_shape_validation"), True
        ),
        directive_set_guard=_coerce_bool(
            hooks.get("directive_set_guard"), True
        ),
        chat_history_enabled=chat_block_enabled and global_chat_on,
        chat_history_script=chat_script,
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


__all__ = [
    "DEFAULT_CHAT_HISTORY_SCRIPT",
    "DEFAULT_SETTINGS_FILE",
    "HookSettings",
    "load_hook_settings",
]
