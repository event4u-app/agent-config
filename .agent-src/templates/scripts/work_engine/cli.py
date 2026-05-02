"""Command-line entry point for ``/implement-ticket``.

Minimal Option-A transport: the script loads a persisted state file,
runs the dispatcher once, writes the updated state back, and prints
either the delivery report (on SUCCESS) or the halt surface —
directive plus numbered questions — on BLOCKED/PARTIAL.

The script never edits code, runs tests, or opens pull requests.
All of that is delegated to the agent via ``@agent-directive:``
markers per
``docs/contracts/implement-ticket-flow.md#agent-directives``. The
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
byte, while flows that already store v1 round-trip as v1.

Layout (post P2.3 of ``road-to-post-pr29-optimize.md``): this file
is a thin orchestrator. The argument parser, state I/O, file-input
builders, hook bootstrap, and stdout/stderr emitters live in their
own leaf modules under ``work_engine`` — see ``cli_args``,
``state_io``, ``input_builders``, ``hook_bootstrap``, ``emitters``,
``errors``. Public names (``main``, ``DEFAULT_STATE_FILE``) and the
private monkeypatch surface (``_build_hook_registry``,
``_CLIError``, ``_load_or_build``, …) are re-exported here so
existing imports and patch targets continue to resolve.

Exit codes:

- ``0`` — flow reached SUCCESS; ``state.report`` printed.
- ``1`` — flow halted BLOCKED; halt surface printed on stdout, the
  state file carries the updated ``outcomes`` and ``questions`` so
  the agent can resume.
- ``2`` — argument or I/O error (ticket file missing, JSON parse
  failure, etc.). The state file is *not* written in this case.
"""
from __future__ import annotations

import sys
from pathlib import Path
from typing import Sequence

from .cli_args import (
    DEFAULT_STATE_FILE,
    LEGACY_STATE_FILE,
    _build_parser,
    _FMT_V0,
    _FMT_V1,
)
from .delivery_state import Outcome
from .dispatcher import (
    assert_kind_supported,
    dispatch,
    load_directive_set,
    select_directive_set,
)
from .emitters import _emit, _emit_halt
from .errors import _CLIError
from .hook_bootstrap import _build_hook_registry, _register_chat_history_hooks
from .hooks import HookContext, HookEvent, HookRunner
from .input_builders import (
    _build_from_diff_file,
    _build_from_file_file,
    _build_from_prompt_file,
    _load_or_build,
)
from .state_io import (
    _load,
    _maybe_raise_legacy_hint,
    _read_json,
    _save,
    _sync_back,
    _to_delivery,
    _to_v0_dict,
)


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


__all__ = [
    "DEFAULT_STATE_FILE",
    "LEGACY_STATE_FILE",
    "_CLIError",
    "_FMT_V0",
    "_FMT_V1",
    "_build_from_diff_file",
    "_build_from_file_file",
    "_build_from_prompt_file",
    "_build_hook_registry",
    "_build_parser",
    "_emit",
    "_emit_halt",
    "_load",
    "_load_or_build",
    "_maybe_raise_legacy_hint",
    "_read_json",
    "_register_chat_history_hooks",
    "_save",
    "_sync_back",
    "_to_delivery",
    "_to_v0_dict",
    "main",
]
