"""Command-line entry point for ``/implement-ticket``.

Minimal Option-A transport: the script loads a persisted state file,
runs the dispatcher once, writes the updated state back, and prints
either the delivery report (on SUCCESS) or the halt surface —
directive plus numbered questions — on BLOCKED/PARTIAL.

The script never edits code, runs tests, or opens pull requests.
All of that is delegated to the agent via ``@agent-directive:``
markers per
``agents/contexts/implement-ticket-flow.md#agent-directives``. The
agent executes the directive, writes the resulting slice back to
the state file, and re-invokes this script to resume.

Wire format (R1 P4 S1, Option A2): the CLI accepts both the legacy
v0 wire format (``{"ticket": …, "persona": …}``) and the v1 schema
(``{"version": 1, "input": {"kind": "ticket", "data": …}}``). Loaded
state is wrapped in :class:`work_engine.state.WorkState` for the
boundary; before dispatch it is projected into a ``DeliveryState``
the step handlers understand. After dispatch the mutations are
mirrored back, and the file is rewritten in the **same** wire format
it was loaded with — Goldens captured against v0 stay v0 byte-for-
byte, while flows that already store v1 round-trip as v1. The
dispatcher selects the directive set via
:func:`work_engine.dispatcher.select_directive_set`, defaulting to
``"backend"`` so v0 callers behave exactly as they did before R1
Phase 4.

Exit codes:

- ``0`` — flow reached SUCCESS; ``state.report`` printed.
- ``1`` — flow halted BLOCKED; halt surface printed on stdout, the
  state file carries the updated ``outcomes`` and ``questions`` so
  the agent can resume.
- ``2`` — argument or I/O error (ticket file missing, JSON parse
  failure, etc.). The state file is *not* written in this case.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Sequence

from . import state as _state_module
from .delivery_state import DeliveryState, Outcome
from .dispatcher import (
    assert_kind_supported,
    dispatch,
    load_directive_set,
    select_directive_set,
)
from .intent import populate_routing
from .migration.v0_to_v1 import migrate_payload
from .resolvers.prompt import PromptResolverError, build_envelope as _build_prompt_envelope
from .state import Input, SchemaError, WorkState

DEFAULT_STATE_FILE = Path(".implement-ticket-state.json")
"""State file used when ``--state-file`` is not passed."""

_FMT_V0 = "v0"
_FMT_V1 = "v1"
"""Wire-format markers carried alongside the loaded :class:`WorkState`.

Format-preserving roundtrip: ``_load`` records which shape it parsed,
``_save`` rewrites in that same shape. v0 in → v0 out (Goldens stay
byte-equal); v1 in → v1 out (future flows produced by the migration
tool or a fresh v1 init keep their envelope fields)."""


def main(argv: Sequence[str] | None = None) -> int:
    """Run one dispatch cycle against the persisted state.

    ``argv`` is taken as-is; pass ``None`` to fall back to
    ``sys.argv[1:]`` (the usual entry-point contract).
    """
    parser = _build_parser()
    args = parser.parse_args(argv)
    state_file: Path = args.state_file

    try:
        work, fmt = _load_or_build(state_file, args)
    except _CLIError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    try:
        set_name = select_directive_set(work)
        assert_kind_supported(work.input.kind, set_name)
        steps = load_directive_set(set_name)
    except (ValueError, NotImplementedError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    delivery = _to_delivery(work)
    final, halting = dispatch(delivery, steps)
    _sync_back(work, delivery)
    _save(state_file, work, fmt)
    _emit(work, final, halting)
    return 0 if final is Outcome.SUCCESS else 1


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="implement-ticket",
        description="Run one dispatch cycle of the /implement-ticket flow.",
    )
    parser.add_argument(
        "--state-file",
        type=Path,
        default=DEFAULT_STATE_FILE,
        help=f"Path to persisted state JSON (default: {DEFAULT_STATE_FILE}).",
    )
    parser.add_argument(
        "--ticket-file",
        type=Path,
        default=None,
        help="JSON file carrying the ticket payload; used only when the "
        "state file does not exist yet.",
    )
    parser.add_argument(
        "--prompt-file",
        type=Path,
        default=None,
        help="Plain-text file carrying the raw user prompt; builds an "
        "input.kind='prompt' envelope. Mutually exclusive with "
        "--ticket-file. Used only when the state file does not exist yet.",
    )
    parser.add_argument(
        "--persona",
        type=str,
        default=None,
        help="Persona name (senior-engineer | qa | advisory). Only honoured "
        "when the state file does not exist yet; ignored on resume so a "
        "mid-flight persona switch cannot silently change behaviour.",
    )
    return parser


def _load_or_build(
    state_file: Path,
    args: argparse.Namespace,
) -> tuple[WorkState, str]:
    """Return the WorkState to dispatch against plus its wire format.

    Either loaded from ``state_file`` (format-preserving) or freshly
    built from ``--ticket-file`` (R1) / ``--prompt-file`` (R2). Fresh
    ticket files default to v0 wire format so that newly captured
    Goldens stay byte-equal with the pre-Phase-4 baseline; fresh
    prompt files emit v1 directly (v0 has no prompt envelope so there
    is nothing to stay byte-compatible with). v1 round-trips for state
    files already on disk in v1 shape.
    """
    if state_file.exists():
        return _load(state_file)
    if args.ticket_file is not None and args.prompt_file is not None:
        raise _CLIError(
            "--ticket-file and --prompt-file are mutually exclusive; "
            "pass exactly one when building an initial state.",
        )
    if args.prompt_file is not None:
        return _build_from_prompt_file(args), _FMT_V1
    if args.ticket_file is None:
        raise _CLIError(
            f"No state file at {state_file} and no --ticket-file or "
            "--prompt-file given; cannot build an initial state.",
        )
    ticket = _read_json(args.ticket_file)
    if not isinstance(ticket, dict):
        raise _CLIError(
            f"--ticket-file must carry a JSON object; got {type(ticket).__name__}.",
        )
    work = WorkState(input=Input(kind="ticket", data=ticket))
    if args.persona:
        work.persona = args.persona
    populate_routing(work)
    return work, _FMT_V0


def _build_from_prompt_file(args: argparse.Namespace) -> WorkState:
    """Read ``--prompt-file`` as raw text and wrap it in a prompt envelope.

    The file is read verbatim (UTF-8) and handed to the prompt resolver,
    which validates non-emptiness and returns the canonical
    ``Input(kind="prompt", data={raw, reconstructed_ac, assumptions})``
    envelope. Persona is honoured the same way as the ticket path.
    """
    try:
        raw = args.prompt_file.read_text(encoding="utf-8")
    except OSError as exc:
        raise _CLIError(f"Cannot read {args.prompt_file}: {exc}") from exc
    try:
        envelope = _build_prompt_envelope(raw)
    except PromptResolverError as exc:
        raise _CLIError(f"--prompt-file is not a valid prompt: {exc}") from exc
    work = WorkState(input=envelope)
    if args.persona:
        work.persona = args.persona
    populate_routing(work)
    return work


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


def _emit(work: WorkState, final: Outcome, halting: str | None) -> None:
    if final is Outcome.SUCCESS:
        print(work.report)
        return
    print(f"[halt] outcome={final.value} step={halting or '(none)'}")
    for line in work.questions:
        print(line)


class _CLIError(Exception):
    """Raised on configuration or I/O problems. Converted to exit code 2."""


__all__ = ["DEFAULT_STATE_FILE", "main"]
