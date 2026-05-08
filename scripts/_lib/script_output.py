"""Verbosity-aware print router for scripts/*.py.

Phase 10 of road-to-token-frugality. Single source of truth for how
maintenance scripts emit progress, success, warnings, and errors.

Resolution order (first wins):
  1. AGENT_SCRIPT_VERBOSITY env var      (silent | minimal | verbose)
  2. SCRIPT_OUTPUT_VERBOSE=1 alias       (== verbose)
  3. .agent-settings.yml verbosity.script_output
  4. Default: minimal

Once resolved, the level is exported back into AGENT_SCRIPT_VERBOSITY
so child processes inherit the same level (Phase 10.1c). Explicit
--quiet flags on the child still win at the call site.

Levels:
  silent   = stderr only; success() drops; info() drops; warn() drops
  minimal  = success() collapsed to one end-of-run summary; info() drops
  verbose  = pre-Phase-10 behaviour, every call prints

error() always writes to stderr regardless of level. Iron-Law surfaces
(release confirms, install secrets prompts) bypass this module and use
plain print() so they cannot be silenced.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from typing import Final

VALID_LEVELS: Final[tuple[str, ...]] = ("silent", "minimal", "verbose")
DEFAULT_LEVEL: Final[str] = "minimal"
ENV_VAR: Final[str] = "AGENT_SCRIPT_VERBOSITY"
ENV_ALIAS: Final[str] = "SCRIPT_OUTPUT_VERBOSE"
SETTINGS_FILE: Final[str] = ".agent-settings.yml"

_resolved_level: str | None = None
_pending_summary: list[str] = []


def _read_settings_level(settings_path: Path) -> str | None:
    """Read verbosity.script_output from .agent-settings.yml.

    Returns None when the file is missing, PyYAML is unavailable, or
    the key is absent. Errors fall through to the default level.
    """
    if not settings_path.is_file():
        return None
    try:
        import yaml  # type: ignore[import-untyped]
    except ImportError:
        return None
    try:
        with settings_path.open(encoding="utf-8") as fh:
            data = yaml.safe_load(fh) or {}
    except (OSError, yaml.YAMLError):
        return None
    section = data.get("verbosity") if isinstance(data, dict) else None
    if not isinstance(section, dict):
        return None
    value = section.get("script_output")
    if isinstance(value, str) and value in VALID_LEVELS:
        return value
    return None


def resolve_level(settings_path: Path | None = None) -> str:
    """Resolve and cache the active verbosity level.

    First call wins; subsequent calls return the cached value so the
    process is internally consistent. Tests reset via reset_level().
    """
    global _resolved_level
    if _resolved_level is not None:
        return _resolved_level

    env_value = os.environ.get(ENV_VAR, "").strip().lower()
    if env_value in VALID_LEVELS:
        _resolved_level = env_value
    elif os.environ.get(ENV_ALIAS, "").strip() == "1":
        _resolved_level = "verbose"
    else:
        path = settings_path or Path(SETTINGS_FILE)
        _resolved_level = _read_settings_level(path) or DEFAULT_LEVEL

    # Inheritance: export resolved level so child processes see it.
    os.environ[ENV_VAR] = _resolved_level
    return _resolved_level


def reset_level() -> None:
    """Clear the cached level. Test helper."""
    global _resolved_level
    _resolved_level = None
    _pending_summary.clear()


def info(message: str) -> None:
    """Per-step progress note. Drops at silent + minimal."""
    if resolve_level() == "verbose":
        print(message)


def success(message: str) -> None:
    """Per-step success. At minimal collected for end-of-run summary;
    at verbose printed immediately; at silent dropped."""
    level = resolve_level()
    if level == "verbose":
        print(message)
    elif level == "minimal":
        _pending_summary.append(message)


def warn(message: str) -> None:
    """Warning. Stderr at all levels except silent."""
    if resolve_level() != "silent":
        print(message, file=sys.stderr)


def error(message: str) -> None:
    """Error. Always stderr regardless of level."""
    print(message, file=sys.stderr)


def flush_summary(headline: str | None = None) -> None:
    """Emit the pending success() summary at end-of-run.

    No-op at verbose (already printed) and silent (suppressed).
    Use the explicit `headline` arg to override the auto-pick.
    """
    level = resolve_level()
    if level != "minimal" or not _pending_summary:
        return
    if headline:
        print(headline)
    else:
        # Default: print the last collected line as the headline.
        print(_pending_summary[-1])
    _pending_summary.clear()
