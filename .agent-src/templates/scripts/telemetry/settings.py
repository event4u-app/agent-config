"""Shared settings reader for the ``telemetry:*`` CLI commands.

Reads the ``telemetry.artifact_engagement`` namespace from
``.agent-settings.yml``. Tolerates a missing file, a missing section,
and missing PyYAML — the default-off doctrine means "everything
unparseable means disabled".

Single source of truth so ``telemetry_record.py`` and
``telemetry_status.py`` cannot drift on what counts as "enabled".
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

DEFAULT_LOG_PATH = Path(".agent-engagement.jsonl")
DEFAULT_GRANULARITY = "task"
ALLOWED_GRANULARITIES = ("task", "phase-step", "tool-call")


@dataclass(frozen=True)
class TelemetrySettings:
    enabled: bool
    granularity: str
    log_path: Path
    record_consulted: bool
    record_applied: bool

    @property
    def section_present(self) -> bool:
        # Distinguishes "disabled because section absent" from
        # "disabled because someone wrote enabled: false". The status
        # CLI uses this to render a different hint.
        return self._section_present  # type: ignore[attr-defined]


def _coerce_bool(value: Any, default: bool) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalised = value.strip().lower()
        if normalised in ("true", "yes", "on", "1"):
            return True
        if normalised in ("false", "no", "off", "0"):
            return False
    return default


def _coerce_str(value: Any, default: str, allowed: tuple[str, ...] | None = None) -> str:
    if not isinstance(value, str) or not value.strip():
        return default
    candidate = value.strip()
    if allowed and candidate not in allowed:
        return default
    return candidate


def _coerce_path(value: Any, default: Path) -> Path:
    if not isinstance(value, str) or not value.strip():
        return default
    return Path(value.strip())


def read_settings(path: Path) -> TelemetrySettings:
    """Return parsed telemetry settings — never raises on missing data."""
    section: dict[str, Any] = {}
    section_present = False

    if path.is_file():
        try:
            import yaml  # type: ignore[import-not-found]
        except ImportError:
            yaml = None  # type: ignore[assignment]
        if yaml is not None:
            try:
                raw = yaml.safe_load(path.read_text(encoding="utf-8")) or {}
            except Exception:
                raw = {}
            if isinstance(raw, dict):
                tele = raw.get("telemetry")
                if isinstance(tele, dict):
                    artefact = tele.get("artifact_engagement")
                    if isinstance(artefact, dict):
                        section = artefact
                        section_present = True

    record = section.get("record") if isinstance(section.get("record"), dict) else {}
    output = section.get("output") if isinstance(section.get("output"), dict) else {}

    settings = TelemetrySettings(
        enabled=_coerce_bool(section.get("enabled"), default=False),
        granularity=_coerce_str(
            section.get("granularity"),
            default=DEFAULT_GRANULARITY,
            allowed=ALLOWED_GRANULARITIES,
        ),
        log_path=_coerce_path(output.get("path"), DEFAULT_LOG_PATH),
        record_consulted=_coerce_bool(record.get("consulted"), default=True),
        record_applied=_coerce_bool(record.get("applied"), default=True),
    )
    # Carry the section-present flag without breaking dataclass frozen-ness.
    object.__setattr__(settings, "_section_present", section_present)
    return settings


__all__ = [
    "DEFAULT_GRANULARITY",
    "DEFAULT_LOG_PATH",
    "TelemetrySettings",
    "read_settings",
]
