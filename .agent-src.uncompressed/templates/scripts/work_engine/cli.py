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
from .hooks import HookContext, HookEvent, HookHalt, HookRegistry, HookRunner
from .hooks.builtin import (
    ChatHistoryAppendHook,
    ChatHistoryHaltAppendHook,
    ChatHistoryHeartbeatHook,
    ChatHistoryTurnCheckHook,
    DirectiveSetGuardHook,
    HaltSurfaceAuditHook,
    StateShapeValidationHook,
    TraceHook,
)
from .hooks.settings import HookSettings, load_hook_settings
from .intent import populate_routing
from .migration.v0_to_v1 import migrate_payload
from .resolvers.diff import DiffResolverError, build_envelope as _build_diff_envelope
from .resolvers.file import FileResolverError, build_envelope as _build_file_envelope
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

    runner = HookRunner(_build_hook_registry(args))

    halt = runner.emit(
        HookEvent.BEFORE_LOAD,
        HookContext(state_file=state_file, args=args),
    )
    if halt is not None:
        return _emit_halt(halt)

    try:
        work, fmt = _load_or_build(state_file, args)
    except _CLIError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    halt = runner.emit(
        HookEvent.AFTER_LOAD,
        HookContext(state_file=state_file, work=work, fmt=fmt, args=args),
    )
    if halt is not None:
        return _emit_halt(halt)

    try:
        set_name = select_directive_set(work)
        assert_kind_supported(work.input.kind, set_name)
        steps = load_directive_set(set_name)
    except (ValueError, NotImplementedError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    delivery = _to_delivery(work)

    halt = runner.emit(
        HookEvent.BEFORE_DISPATCH,
        HookContext(work=work, delivery=delivery, set_name=set_name, args=args),
    )
    if halt is not None:
        return _emit_halt(halt)

    final, halting = dispatch(delivery, steps, hooks=runner)

    halt = runner.emit(
        HookEvent.AFTER_DISPATCH,
        HookContext(
            work=work,
            delivery=delivery,
            final=final,
            halting=halting,
            args=args,
        ),
    )
    if halt is not None:
        return _emit_halt(halt)

    _sync_back(work, delivery)

    halt = runner.emit(
        HookEvent.BEFORE_SAVE,
        HookContext(work=work, delivery=delivery, fmt=fmt, args=args),
    )
    if halt is not None:
        return _emit_halt(halt)

    _save(state_file, work, fmt)

    halt = runner.emit(
        HookEvent.AFTER_SAVE,
        HookContext(work=work, state_file=state_file, fmt=fmt, args=args),
    )
    if halt is not None:
        # State is already on disk; exit 2 still per the P3 branch table.
        return _emit_halt(halt)

    _emit(work, final, halting)
    return 0 if final is Outcome.SUCCESS else 1


def _build_hook_registry(args: argparse.Namespace) -> HookRegistry:
    """Build the CLI-side :class:`HookRegistry` for one ``main()`` run.

    Reads ``hooks.*`` from ``.agent-settings.yml`` and registers the
    enabled hooks. The master switch ``hooks.enabled`` defaults to
    ``False`` when the block (or the file) is missing — the registry
    stays empty and golden replay flows are byte-stable.

    ``--no-hooks`` on the CLI forces an empty registry regardless of
    settings, which is the explicit escape hatch golden-replay test
    harnesses can use.
    """
    registry = HookRegistry()
    if getattr(args, "no_hooks", False):
        return registry

    settings_path = getattr(args, "hooks_config", None)
    settings = load_hook_settings(settings_path)
    if not settings.enabled:
        return registry

    if settings.trace:
        TraceHook().register(registry)
    if settings.halt_surface_audit:
        HaltSurfaceAuditHook().register(registry)
    if settings.state_shape_validation:
        StateShapeValidationHook().register(registry)
    if settings.directive_set_guard:
        DirectiveSetGuardHook().register(registry)
    if settings.chat_history_enabled:
        _register_chat_history_hooks(registry, settings)

    return registry


def _register_chat_history_hooks(
    registry: HookRegistry, settings: HookSettings,
) -> None:
    """Register the four chat-history hooks bound to the configured script."""
    script = Path(settings.chat_history_script)
    ChatHistoryTurnCheckHook(script).register(registry)
    ChatHistoryAppendHook(script).register(registry)
    ChatHistoryHaltAppendHook(script).register(registry)
    ChatHistoryHeartbeatHook(script).register(registry)


def _emit_halt(halt: HookHalt) -> int:
    """Render a :class:`HookHalt` surface to stderr and return exit 2.

    Per the P3 halt branch table, every CLI-layer halt yields exit code
    ``2`` regardless of which event fired it. State persistence is
    governed by *where* in ``main`` the halt is detected: the call site
    decides whether ``_save`` already ran. This helper is the single
    place that formats the surface so the wire output stays consistent.
    """
    if halt.surface:
        for line in halt.surface:
            print(line, file=sys.stderr)
    else:
        print(f"halt: {halt.reason}", file=sys.stderr)
    return 2


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
        "--diff-file",
        type=Path,
        default=None,
        help="Plain-text file carrying a unified diff payload; builds an "
        "input.kind='diff' envelope routed through the UI-improve "
        "directive set. Mutually exclusive with --ticket-file / "
        "--prompt-file / --file-file. Used only when the state file does "
        "not exist yet.",
    )
    parser.add_argument(
        "--file-file",
        type=Path,
        default=None,
        help="Plain-text file carrying a single path reference (one line); "
        "builds an input.kind='file' envelope routed through the UI-improve "
        "directive set. Mutually exclusive with --ticket-file / "
        "--prompt-file / --diff-file. Used only when the state file does "
        "not exist yet.",
    )
    parser.add_argument(
        "--persona",
        type=str,
        default=None,
        help="Persona name (senior-engineer | qa | advisory). Only honoured "
        "when the state file does not exist yet; ignored on resume so a "
        "mid-flight persona switch cannot silently change behaviour.",
    )
    parser.add_argument(
        "--no-hooks",
        action="store_true",
        default=False,
        help="Disable every lifecycle hook for this run. Use in golden-"
        "replay test harnesses so a future settings change cannot "
        "silently invalidate captured outputs.",
    )
    parser.add_argument(
        "--hooks-config",
        type=Path,
        default=None,
        help="Override the path to the agent-settings file used to resolve "
        "the hooks.* block. Defaults to ./.agent-settings.yml.",
    )
    return parser


def _load_or_build(
    state_file: Path,
    args: argparse.Namespace,
) -> tuple[WorkState, str]:
    """Return the WorkState to dispatch against plus its wire format.

    Either loaded from ``state_file`` (format-preserving) or freshly
    built from ``--ticket-file`` (R1), ``--prompt-file`` (R2),
    ``--diff-file`` (R3) or ``--file-file`` (R3). Fresh ticket files
    default to v0 wire format so that newly captured Goldens stay
    byte-equal with the pre-Phase-4 baseline; the prompt / diff / file
    paths emit v1 directly (v0 has no envelope concept for these
    kinds). v1 round-trips for state files already on disk in v1 shape.
    """
    if state_file.exists():
        return _load(state_file)
    inputs = [
        ("--ticket-file", args.ticket_file),
        ("--prompt-file", args.prompt_file),
        ("--diff-file", args.diff_file),
        ("--file-file", args.file_file),
    ]
    supplied = [name for name, value in inputs if value is not None]
    if len(supplied) > 1:
        raise _CLIError(
            f"{', '.join(supplied)} are mutually exclusive; pass exactly "
            "one when building an initial state.",
        )
    if not supplied:
        raise _CLIError(
            f"No state file at {state_file} and no --ticket-file, "
            "--prompt-file, --diff-file, or --file-file given; cannot "
            "build an initial state.",
        )
    if args.prompt_file is not None:
        return _build_from_prompt_file(args), _FMT_V1
    if args.diff_file is not None:
        return _build_from_diff_file(args), _FMT_V1
    if args.file_file is not None:
        return _build_from_file_file(args), _FMT_V1
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


def _build_from_diff_file(args: argparse.Namespace) -> WorkState:
    """Read ``--diff-file`` as raw text and wrap it in a diff envelope.

    The file is read verbatim (UTF-8) and handed to the diff resolver,
    which validates the unified-diff header heuristic and returns the
    canonical
    ``Input(kind="diff", data={raw, reconstructed_ac, assumptions})``
    envelope. ``populate_routing`` then routes the envelope to the
    UI-improve directive set without running the prose classifier — see
    :mod:`work_engine.intent.classify` for the routing contract.
    """
    try:
        raw = args.diff_file.read_text(encoding="utf-8")
    except OSError as exc:
        raise _CLIError(f"Cannot read {args.diff_file}: {exc}") from exc
    try:
        envelope = _build_diff_envelope(raw)
    except DiffResolverError as exc:
        raise _CLIError(f"--diff-file is not a valid diff: {exc}") from exc
    work = WorkState(input=envelope)
    if args.persona:
        work.persona = args.persona
    populate_routing(work)
    return work


def _build_from_file_file(args: argparse.Namespace) -> WorkState:
    """Read ``--file-file`` as a single-line path and wrap it in a file envelope.

    The file is read verbatim (UTF-8); the first non-empty line is taken
    as the path reference and handed to the file resolver, which
    validates path shape (non-empty, NUL-free, not a URL) and returns
    the canonical
    ``Input(kind="file", data={path, reconstructed_ac, assumptions})``
    envelope. Trailing whitespace and additional lines are ignored —
    the resolver treats the file's content as the path itself, not as
    structured payload.
    """
    try:
        raw = args.file_file.read_text(encoding="utf-8")
    except OSError as exc:
        raise _CLIError(f"Cannot read {args.file_file}: {exc}") from exc
    path = raw.strip().splitlines()[0] if raw.strip() else ""
    try:
        envelope = _build_file_envelope(path)
    except FileResolverError as exc:
        raise _CLIError(
            f"--file-file does not carry a valid path: {exc}",
        ) from exc
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
