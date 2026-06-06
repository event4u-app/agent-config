"""State-file I/O helpers for the CLI entry point.

Extracted from ``cli.py`` in P2.3 of
``road-to-post-pr29-optimize.md``. Holds the format-preserving
load/save pair, the v0 legacy serialiser, the JSON reader, the
``DeliveryState`` projection helpers, and the legacy-file migration
hint. Behaviour is byte-identical to the pre-split version — Goldens
stay green.
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from . import state as _state_module
from .cli_args import DEFAULT_STATE_FILE, LEGACY_STATE_FILE, _FMT_V0, _FMT_V1
from .delivery_state import DeliveryState
from .errors import _CLIError
from .migration.v0_to_v1 import migrate_payload
from .state import SchemaError, WorkState


def _maybe_raise_legacy_hint(state_file: Path) -> None:
    """Surface a migration hint when only the pre-1.15.0 file is present.

    The dispatcher renamed the default state file from
    ``.implement-ticket-state.json`` to ``.work-state.json`` in 1.15.0
    (alongside the ``implement_ticket → work_engine`` package move).
    Existing checkouts that still carry the legacy file would otherwise
    fail with a generic "no state file" message. This helper detects
    the legacy file in the same directory and points the user at the
    one-shot migration command instead.

    Only fires when ``state_file`` has the canonical default name and
    sits next to a legacy file — explicit ``--state-file`` overrides
    bypass the hint so power users can carry their own naming scheme.
    """
    if state_file.name != DEFAULT_STATE_FILE.name:
        return
    legacy_candidate = state_file.with_name(LEGACY_STATE_FILE.name)
    if not legacy_candidate.is_file():
        return
    raise _CLIError(
        f"Found legacy state file {legacy_candidate} but no "
        f"{state_file}. The default state file was renamed in 1.15.0. "
        f"Run `python3 -m work_engine.migration.v0_to_v1 "
        f"{legacy_candidate}` to migrate, or pass `--state-file "
        f"{legacy_candidate}` to keep using the old name. See "
        "docs/MIGRATION.md.",
    )


def _load(state_file: Path) -> tuple[WorkState, str]:
    """Load ``state_file`` and tag it with the wire format detected."""
    data = _read_json(state_file)
    if not isinstance(data, dict):
        raise _CLIError(
            f"State file {state_file} must carry a JSON object; "
            f"got {type(data).__name__}.",
        )

    # v1 declares ``version``; v0 has none. Anything else is invalid.
    if data.get("version") == _state_module.SCHEMA_VERSION:
        try:
            return _state_module.from_dict(data), _FMT_V1
        except SchemaError as exc:
            raise _CLIError(f"State file shape is invalid: {exc}") from exc
    if "version" in data:
        raise _CLIError(
            f"State file shape is invalid: unsupported version "
            f"{data.get('version')!r}; expected {_state_module.SCHEMA_VERSION}",
        )
    if "ticket" not in data:
        raise _CLIError(
            "State file shape is invalid: missing 'ticket' (v0) or "
            "'version' (v1) — file is neither shape.",
        )
    try:
        migrated = migrate_payload(data)
        return _state_module.from_dict(migrated), _FMT_V0
    except SchemaError as exc:
        raise _CLIError(f"State file shape is invalid: {exc}") from exc


def _to_delivery(work: WorkState) -> DeliveryState:
    """Project ``work`` into a ``DeliveryState`` for handler dispatch.

    R1 P4 S1 (Option A2): handlers continue to consume ``DeliveryState``
    with ``state.ticket``; the ``WorkState`` wrapper exists at the CLI
    boundary so the dispatcher's directive-set selection has a v1
    state object to read ``directive_set`` from. Mutable containers
    (``memory``, ``changes``, ``outcomes``, ``questions``) are passed
    by reference — in-place mutations land on both objects without an
    explicit sync. Reassignments (``state.plan = …``, ``state.report
    = …``) are mirrored back by :func:`_sync_back`.
    """
    return DeliveryState(
        ticket=work.input.data,
        persona=work.persona,
        memory=work.memory,
        plan=work.plan,
        changes=work.changes,
        tests=work.tests,
        verify=work.verify,
        outcomes=work.outcomes,
        questions=work.questions,
        report=work.report,
        ui_audit=work.ui_audit,
        ui_design=work.ui_design,
        ui_review=work.ui_review,
        ui_polish=work.ui_polish,
        contract=work.contract,
        stitch=work.stitch,
        stack=work.stack,
    )


def _sync_back(work: WorkState, delivery: DeliveryState) -> None:
    """Mirror handler mutations from ``delivery`` back into ``work``.

    Container fields are shared by reference (see :func:`_to_delivery`)
    so the assignment is a no-op for those — we still mirror them
    defensively to cover the case where a handler reassigned the
    attribute (``state.memory = [new_list]``) instead of mutating in
    place.
    """
    work.input.data = delivery.ticket
    work.persona = delivery.persona
    work.memory = delivery.memory
    work.plan = delivery.plan
    work.changes = delivery.changes
    work.tests = delivery.tests
    work.verify = delivery.verify
    work.outcomes = delivery.outcomes
    work.questions = delivery.questions
    work.report = delivery.report
    work.ui_audit = delivery.ui_audit
    work.ui_design = delivery.ui_design
    work.ui_review = delivery.ui_review
    work.ui_polish = delivery.ui_polish
    work.contract = delivery.contract
    work.stitch = delivery.stitch
    work.stack = delivery.stack


def _save(state_file: Path, work: WorkState, fmt: str) -> None:
    """Persist ``work`` in the wire format it was loaded with.

    v1 emits the canonical envelope via :func:`work_engine.state.to_dict`;
    v0 emits the legacy flat shape that ``DeliveryState.asdict`` used
    to produce, byte-identical to the pre-Phase-4 output so the
    Golden Transcript replay stays green.
    """
    state_file.parent.mkdir(parents=True, exist_ok=True)
    payload = _state_module.to_dict(work) if fmt == _FMT_V1 else _to_v0_dict(work)
    state_file.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def _to_v0_dict(work: WorkState) -> dict[str, Any]:
    """Serialise ``work`` in the legacy v0 wire format.

    Field order matches ``DeliveryState`` declaration order so
    pre-Phase-4 state files round-trip byte-equal.
    """
    return {
        "ticket": work.input.data,
        "persona": work.persona,
        "memory": work.memory,
        "plan": work.plan,
        "changes": work.changes,
        "tests": work.tests,
        "verify": work.verify,
        "outcomes": work.outcomes,
        "questions": work.questions,
        "report": work.report,
    }


def _read_json(path: Path):
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise _CLIError(f"Cannot read {path}: {exc}") from exc
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise _CLIError(f"Invalid JSON in {path}: {exc}") from exc


__all__ = [
    "_load",
    "_maybe_raise_legacy_hint",
    "_read_json",
    "_save",
    "_sync_back",
    "_to_delivery",
    "_to_v0_dict",
]
