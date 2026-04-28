"""Schema v1 of the universal-engine work state.

The wire format adds four envelope fields on top of the legacy
``DeliveryState`` shape from ``implement_ticket.delivery_state``:

- ``version`` — integer schema version, currently ``1``.
- ``input.kind`` — typed input variant (only ``"ticket"`` for R1).
- ``input.data`` — the original payload (was ``state.ticket`` in v0).
- ``intent`` — coarse intent label (``"backend-coding"`` for R1).
- ``directive_set`` — name of the directive bundle the dispatcher
  loads. The enum is forward-compatible: ``ui``, ``ui-trivial``, and
  ``mixed`` are accepted by the schema even though only ``backend``
  has working directives in R1 (Phase 4 Step 4 — pre-listed to avoid
  a schema bump when R3 V2 lands).

All other fields keep their v0 names so the dispatcher can read the
legacy slice unchanged once Phase 3 wires the steps over.

The module exposes:

- :data:`SCHEMA_VERSION` — the integer carried in ``version``.
- :data:`KNOWN_INPUT_KINDS` / :data:`KNOWN_DIRECTIVE_SETS` — the
  whitelists used by validation.
- :class:`Input`, :class:`WorkState` — typed dataclasses.
- :func:`from_dict` / :func:`to_dict` — JSON round-trip helpers.
- :class:`SchemaError` — raised on every validation failure.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

SCHEMA_VERSION = 1
"""Integer version stored under the ``version`` key on disk."""

DEFAULT_INTENT = "backend-coding"
"""Intent applied when migrating a v0 file or building a fresh state."""

DEFAULT_DIRECTIVE_SET = "backend"
"""Directive set applied when migrating a v0 file or building a fresh state."""

KNOWN_INPUT_KINDS: frozenset[str] = frozenset({"ticket"})
"""Input kinds accepted by the schema. ``ticket`` is the only one with
semantics in R1; other kinds are rejected so unknown values surface as
errors instead of silently falling through to a default branch."""

KNOWN_DIRECTIVE_SETS: frozenset[str] = frozenset(
    {"backend", "ui", "ui-trivial", "mixed"},
)
"""Directive sets recognised by the schema.

Per the roadmap (Phase 4 Step 4), ``ui``, ``ui-trivial``, and ``mixed``
are intentionally pre-listed so a future R3 V2 release does not need a
schema bump. Only ``backend`` has working directives in R1; the others
raise ``NotImplementedError`` at dispatch time."""


class SchemaError(ValueError):
    """Raised when a state payload violates the v1 contract."""


@dataclass
class Input:
    """Typed envelope for the user-supplied work item.

    ``kind`` is one of :data:`KNOWN_INPUT_KINDS`; ``data`` is the raw
    payload. The legacy ``state.ticket`` dict lands here as
    ``Input(kind="ticket", data=<dict>)`` after migration.
    """

    kind: str
    data: dict[str, Any] = field(default_factory=dict)


@dataclass
class WorkState:
    """Schema v1 of the persisted work state.

    Field order mirrors the on-disk JSON: envelope (``version``,
    ``input``, ``intent``, ``directive_set``) first, then the legacy
    ``DeliveryState`` slice (``persona`` … ``report``) so a diff
    between a v1 file and its v0 ancestor stays readable.
    """

    input: Input
    intent: str = DEFAULT_INTENT
    directive_set: str = DEFAULT_DIRECTIVE_SET
    version: int = SCHEMA_VERSION
    persona: str = "senior-engineer"
    memory: list[dict[str, Any]] = field(default_factory=list)
    plan: Any = None
    changes: list[dict[str, Any]] = field(default_factory=list)
    tests: Any = None
    verify: Any = None
    outcomes: dict[str, str] = field(default_factory=dict)
    questions: list[str] = field(default_factory=list)
    report: str = ""


def to_dict(state: WorkState) -> dict[str, Any]:
    """Serialise ``state`` to the canonical v1 JSON shape.

    Field order is fixed: ``version`` → ``input`` → ``intent`` →
    ``directive_set`` → legacy slice. Stable order keeps state
    snapshots diff-friendly across re-runs and across the freeze-guard
    replay. Validation runs before serialisation so an in-memory
    object that was mutated past the schema cannot reach disk.
    """
    _validate_kind(state.input.kind)
    _validate_directive_set(state.directive_set)
    if state.version != SCHEMA_VERSION:
        raise SchemaError(
            f"version must be {SCHEMA_VERSION}; got {state.version!r}",
        )
    return {
        "version": state.version,
        "input": {"kind": state.input.kind, "data": state.input.data},
        "intent": state.intent,
        "directive_set": state.directive_set,
        "persona": state.persona,
        "memory": state.memory,
        "plan": state.plan,
        "changes": state.changes,
        "tests": state.tests,
        "verify": state.verify,
        "outcomes": state.outcomes,
        "questions": state.questions,
        "report": state.report,
    }


def from_dict(payload: Any) -> WorkState:
    """Build a :class:`WorkState` from a parsed JSON payload.

    Validates the envelope (``version``, ``input.kind``,
    ``directive_set``) before instantiating the dataclass. Unknown
    top-level keys are tolerated and dropped — the schema is additive,
    not strict-rejecting, so a future field rolled out by a newer
    engine version does not crash an older reader.
    """
    if not isinstance(payload, dict):
        raise SchemaError(
            f"state payload must be a JSON object; got {type(payload).__name__}",
        )

    version = payload.get("version")
    if version != SCHEMA_VERSION:
        raise SchemaError(
            f"version must be {SCHEMA_VERSION}; got {version!r}. "
            "Run the v0→v1 migration before loading legacy files.",
        )

    raw_input = payload.get("input")
    if not isinstance(raw_input, dict):
        raise SchemaError(
            "state.input must be a JSON object with 'kind' and 'data' keys",
        )
    kind = raw_input.get("kind")
    _validate_kind(kind)
    data = raw_input.get("data", {})
    if not isinstance(data, dict):
        raise SchemaError(
            f"state.input.data must be a JSON object; got {type(data).__name__}",
        )

    directive_set = payload.get("directive_set", DEFAULT_DIRECTIVE_SET)
    _validate_directive_set(directive_set)

    return WorkState(
        input=Input(kind=kind, data=data),
        intent=payload.get("intent", DEFAULT_INTENT),
        directive_set=directive_set,
        version=version,
        persona=payload.get("persona", "senior-engineer"),
        memory=list(payload.get("memory", [])),
        plan=payload.get("plan"),
        changes=list(payload.get("changes", [])),
        tests=payload.get("tests"),
        verify=payload.get("verify"),
        outcomes=dict(payload.get("outcomes", {})),
        questions=list(payload.get("questions", [])),
        report=payload.get("report", ""),
    )


def load(path: Path) -> WorkState:
    """Read a v1 state file from disk and return a :class:`WorkState`."""
    raw = path.read_text(encoding="utf-8")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise SchemaError(f"invalid JSON in {path}: {exc}") from exc
    return from_dict(payload)


def dump(state: WorkState, path: Path) -> None:
    """Write ``state`` to ``path`` as pretty JSON, terminating newline included."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(to_dict(state), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def _validate_kind(kind: Any) -> None:
    if not isinstance(kind, str):
        raise SchemaError(
            f"state.input.kind must be a string; got {type(kind).__name__}",
        )
    if kind not in KNOWN_INPUT_KINDS:
        raise SchemaError(
            f"unknown input.kind {kind!r}; "
            f"expected one of {sorted(KNOWN_INPUT_KINDS)}",
        )


def _validate_directive_set(name: Any) -> None:
    if not isinstance(name, str):
        raise SchemaError(
            f"state.directive_set must be a string; got {type(name).__name__}",
        )
    if name not in KNOWN_DIRECTIVE_SETS:
        raise SchemaError(
            f"unknown directive_set {name!r}; "
            f"expected one of {sorted(KNOWN_DIRECTIVE_SETS)}",
        )


__all__ = [
    "DEFAULT_DIRECTIVE_SET",
    "DEFAULT_INTENT",
    "Input",
    "KNOWN_DIRECTIVE_SETS",
    "KNOWN_INPUT_KINDS",
    "SCHEMA_VERSION",
    "SchemaError",
    "WorkState",
    "dump",
    "from_dict",
    "load",
    "to_dict",
]
