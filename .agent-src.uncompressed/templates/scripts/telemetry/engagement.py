"""Engagement event schema and JSONL appender (Phase 1).

Stdlib-only. No external deps. All validation is structural — Phase 5
adds the redaction validator on top. The contract here is:

    {
      "schema_version": 1,
      "ts": "<ISO-8601 UTC>",
      "task_id": "<repo-internal id>",
      "boundary_kind": "task" | "phase-step" | "tool-call",
      "consulted": {"skills": [...], "rules": [...], ...},
      "applied":   {"skills": [...], "rules": [...], ...},
      "outcomes":  ["blocked", "verification_failed", ...]  # optional
      "tokens_estimate": {"consulted_load": <int>}   # optional
    }

Outcomes (optional, additive in schema v1) capture *what happened*
during the boundary, not which artefacts were consulted. The five
allowed categories are scoped tightly so reports stay actionable:

- ``blocked``                    — Hard-Floor / scope-control gate fired, work paused.
- ``partial``                    — boundary closed without finishing the planned scope.
- ``memory_influenced_decision`` — a memory entry shaped a non-trivial decision.
- ``verification_failed``        — verify-before-complete gate rejected the result.
- ``stop_rule_triggered``        — context-hygiene 3-failure / tool-loop stop fired.

Outcomes compose: a single boundary may carry multiple. Order is
preserved as recorded; duplicates are rejected to keep reports
honest.

Design choices:

- Dataclass + manual ``validate()`` (no pydantic — keep the engine
  install footprint flat, mirroring ``work_engine``).
- Append uses ``open(..., "a")`` with ``flush()`` so one record is one
  line; concurrent-write durability is Phase 2's job (file-lock).
- ``parse_event`` round-trips a serialised line back into a dataclass
  for the tests; production agents only ever ``append_event``.
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 1
MAX_ID_LEN = 200

ALLOWED_KINDS: tuple[str, ...] = (
    "skills",
    "rules",
    "commands",
    "guidelines",
    "personas",
)

ALLOWED_BOUNDARY_KINDS: tuple[str, ...] = (
    "task",
    "phase-step",
    "tool-call",
)

# Outcome categories — see module docstring for semantics. The set is
# intentionally small; widening requires an explicit follow-up roadmap
# step. Reports group by these labels, so renaming is breaking.
ALLOWED_OUTCOMES: tuple[str, ...] = (
    "blocked",
    "partial",
    "memory_influenced_decision",
    "verification_failed",
    "stop_rule_triggered",
)
MAX_OUTCOMES_PER_EVENT = len(ALLOWED_OUTCOMES)

# Phase 5 redaction validator — keep id fields from leaking paths,
# free-text, or filenames. Repository-internal artefact ids and
# task ids never contain these characters.
_FORBIDDEN_ID_CHARS: tuple[str, ...] = ("/", "\\", "\n", "\r", "\t")
# Trailing alphabetic extension (`.md`, `.py`, `.json`, …). Restricting
# to alphabetic chars 1-8 long avoids false positives on version-like
# patterns (e.g. ``v1.0``, ``ticket-1.2``) while still catching the
# realistic file-extension leak surface.
_FILE_EXTENSION_RE = re.compile(r"\.[A-Za-z]{1,8}$")


class EngagementSchemaError(ValueError):
    """Raised when an event violates the schema."""


def check_id_redaction(label: str, value: str) -> None:
    """Phase 5 redaction validator — reject path- and free-text-shaped ids.

    Public surface: the schema layer calls this on every ``task_id``
    and every ``consulted``/``applied`` artefact id before write; the
    report renderer calls it on every id before emitting JSON, so a
    pre-validator (or hand-edited) log can never leak into a shared
    report.

    Caller has already verified ``value`` is a non-empty string of
    length ``<= MAX_ID_LEN``. This function adds the privacy floor:
    no slashes, no backslashes, no embedded control chars, no leading
    or trailing whitespace, no file-extension suffix.

    Failure raises :class:`EngagementSchemaError` with a label that
    points at the offending field (``task_id``, ``consulted.skills``,
    ``applied.rules`` …).
    """
    if not isinstance(value, str):
        raise EngagementSchemaError(f"{label} must be a string")
    if not value:
        raise EngagementSchemaError(f"{label} must be non-empty")
    if len(value) > MAX_ID_LEN:
        raise EngagementSchemaError(
            f"{label} exceeds {MAX_ID_LEN} chars"
        )
    for ch in _FORBIDDEN_ID_CHARS:
        if ch in value:
            raise EngagementSchemaError(
                f"{label} contains forbidden character {ch!r}; "
                "id fields must be repository-internal artefact ids only "
                "(no paths, no free-text)"
            )
    if value != value.strip():
        raise EngagementSchemaError(
            f"{label} must not start or end with whitespace"
        )
    if _FILE_EXTENSION_RE.search(value):
        raise EngagementSchemaError(
            f"{label} ends in a file extension; "
            "id fields must be repository-internal artefact ids only "
            "(strip path + extension before recording)"
        )


@dataclass
class EngagementEvent:
    ts: str
    task_id: str
    boundary_kind: str
    consulted: dict[str, list[str]] = field(default_factory=dict)
    applied: dict[str, list[str]] = field(default_factory=dict)
    outcomes: list[str] | None = None
    tokens_estimate: dict[str, int] | None = None
    schema_version: int = SCHEMA_VERSION

    def validate(self) -> None:
        if not isinstance(self.ts, str) or not self.ts:
            raise EngagementSchemaError("ts must be a non-empty string")
        if not isinstance(self.task_id, str) or not self.task_id:
            raise EngagementSchemaError("task_id must be a non-empty string")
        if len(self.task_id) > MAX_ID_LEN:
            raise EngagementSchemaError(
                f"task_id exceeds {MAX_ID_LEN} chars"
            )
        check_id_redaction("task_id", self.task_id)
        if self.boundary_kind not in ALLOWED_BOUNDARY_KINDS:
            raise EngagementSchemaError(
                f"boundary_kind must be one of {ALLOWED_BOUNDARY_KINDS!r}"
            )
        _validate_artefact_dict("consulted", self.consulted)
        _validate_artefact_dict("applied", self.applied)
        if self.outcomes is not None:
            _validate_outcomes(self.outcomes)
        if self.tokens_estimate is not None:
            if not isinstance(self.tokens_estimate, dict):
                raise EngagementSchemaError(
                    "tokens_estimate must be a dict[str,int] or None"
                )
            for k, v in self.tokens_estimate.items():
                if not isinstance(k, str) or not isinstance(v, int):
                    raise EngagementSchemaError(
                        "tokens_estimate keys must be str, values int"
                    )
        if self.schema_version != SCHEMA_VERSION:
            raise EngagementSchemaError(
                f"schema_version must be {SCHEMA_VERSION}, got "
                f"{self.schema_version!r}"
            )

    def to_dict(self) -> dict[str, Any]:
        self.validate()
        out: dict[str, Any] = {
            "schema_version": self.schema_version,
            "ts": self.ts,
            "task_id": self.task_id,
            "boundary_kind": self.boundary_kind,
            "consulted": _normalise_artefact_dict(self.consulted),
            "applied": _normalise_artefact_dict(self.applied),
        }
        if self.outcomes:
            out["outcomes"] = list(self.outcomes)
        if self.tokens_estimate:
            out["tokens_estimate"] = dict(self.tokens_estimate)
        return out

    def to_jsonl(self) -> str:
        return json.dumps(self.to_dict(), sort_keys=True, separators=(",", ":")) + "\n"


def _validate_artefact_dict(label: str, payload: Any) -> None:
    if not isinstance(payload, dict):
        raise EngagementSchemaError(f"{label} must be a dict[str,list[str]]")
    for kind, ids in payload.items():
        if kind not in ALLOWED_KINDS:
            raise EngagementSchemaError(
                f"{label}.{kind!r} is not an allowed artefact kind "
                f"(allowed: {ALLOWED_KINDS!r})"
            )
        if not isinstance(ids, list):
            raise EngagementSchemaError(
                f"{label}.{kind} must be a list of str"
            )
        for art_id in ids:
            if not isinstance(art_id, str) or not art_id:
                raise EngagementSchemaError(
                    f"{label}.{kind} must contain non-empty str ids"
                )
            if len(art_id) > MAX_ID_LEN:
                raise EngagementSchemaError(
                    f"{label}.{kind} id exceeds {MAX_ID_LEN} chars"
                )
            check_id_redaction(f"{label}.{kind}", art_id)


def _normalise_artefact_dict(payload: dict[str, list[str]]) -> dict[str, list[str]]:
    # Stable shape: only non-empty kinds, ids preserved in declared order.
    return {kind: list(payload[kind]) for kind in ALLOWED_KINDS if payload.get(kind)}


def _validate_outcomes(payload: Any) -> None:
    if not isinstance(payload, list):
        raise EngagementSchemaError(
            "outcomes must be a list of str or None"
        )
    if len(payload) > MAX_OUTCOMES_PER_EVENT:
        raise EngagementSchemaError(
            f"outcomes exceeds {MAX_OUTCOMES_PER_EVENT} entries"
        )
    seen: set[str] = set()
    for label in payload:
        if not isinstance(label, str) or not label:
            raise EngagementSchemaError(
                "outcomes must contain non-empty str labels"
            )
        if label not in ALLOWED_OUTCOMES:
            raise EngagementSchemaError(
                f"outcomes contains {label!r}; allowed: {ALLOWED_OUTCOMES!r}"
            )
        if label in seen:
            raise EngagementSchemaError(
                f"outcomes contains duplicate {label!r}"
            )
        seen.add(label)


def parse_event(line: str) -> EngagementEvent:
    if not isinstance(line, str) or not line.strip():
        raise EngagementSchemaError("line must be a non-empty JSONL record")
    try:
        raw = json.loads(line)
    except json.JSONDecodeError as exc:
        raise EngagementSchemaError(f"line is not valid JSON: {exc}") from exc
    if not isinstance(raw, dict):
        raise EngagementSchemaError("event must be a JSON object")
    event = EngagementEvent(
        ts=raw.get("ts", ""),
        task_id=raw.get("task_id", ""),
        boundary_kind=raw.get("boundary_kind", ""),
        consulted=raw.get("consulted", {}) or {},
        applied=raw.get("applied", {}) or {},
        outcomes=raw.get("outcomes"),
        tokens_estimate=raw.get("tokens_estimate"),
        schema_version=raw.get("schema_version", SCHEMA_VERSION),
    )
    event.validate()
    return event


def append_event(log_path: Path, event: EngagementEvent) -> None:
    """Append one validated event to the JSONL log.

    Caller is responsible for the enabled-flag check — this function
    writes unconditionally. Phase 2 wraps it with the settings probe.
    """
    payload = event.to_jsonl()
    log_path.parent.mkdir(parents=True, exist_ok=True)
    with log_path.open("a", encoding="utf-8") as fh:
        fh.write(payload)
        fh.flush()


def now_utc_iso() -> str:
    """ISO-8601 UTC timestamp, second precision, ``Z`` suffix."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
