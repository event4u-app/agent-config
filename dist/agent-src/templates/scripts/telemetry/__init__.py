"""``telemetry`` — artefact engagement recording (default-off).

The package owns the local-only engagement log
(``.agent-engagement.jsonl``) that records, at task boundaries, which
artefacts (skills, rules, commands, guidelines, personas) the agent
``consulted`` (loaded into context) and ``applied`` (cited or directly
drove a decision).

Architectural constraints (from
``agents/roadmaps/road-to-artifact-engagement-telemetry.md`` Phase 1):

- Default-off. ``telemetry.artifact_engagement.enabled: false`` in
  ``.agent-settings.yml`` produces zero file IO and zero token cost.
- Local only. No server-side aggregation, no cross-repo sync.
- ID-only payloads. No paths, no file contents, no prompts, no
  secrets ever reach the log.
- Append-only JSONL. One event per task / phase-step boundary.
- Strict schema. Unknown artefact kinds are rejected.
"""
from __future__ import annotations

from .engagement import (
    ALLOWED_BOUNDARY_KINDS,
    ALLOWED_KINDS,
    SCHEMA_VERSION,
    EngagementEvent,
    EngagementSchemaError,
    append_event,
    now_utc_iso,
    parse_event,
)

__all__ = [
    "ALLOWED_BOUNDARY_KINDS",
    "ALLOWED_KINDS",
    "SCHEMA_VERSION",
    "EngagementEvent",
    "EngagementSchemaError",
    "append_event",
    "now_utc_iso",
    "parse_event",
]
