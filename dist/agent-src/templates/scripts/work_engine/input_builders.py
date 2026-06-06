"""File-based input builders and the load-or-build dispatch helper.

Extracted from ``cli.py`` in P2.3 of
``road-to-post-pr29-optimize.md``. Owns the CLI's "first run" path:
when no state file exists, build a fresh :class:`WorkState` from
``--ticket-file``, ``--prompt-file``, ``--diff-file`` or
``--file-file``. Every builder is byte-identical in behaviour to the
pre-split version — the resolvers it calls and the persona / routing
post-processing did not move.
"""
from __future__ import annotations

import argparse
from pathlib import Path

from .cli_args import _FMT_V0, _FMT_V1
from .errors import _CLIError
from .intent import populate_routing
from .resolvers.diff import DiffResolverError, build_envelope as _build_diff_envelope
from .resolvers.file import FileResolverError, build_envelope as _build_file_envelope
from .resolvers.prompt import PromptResolverError, build_envelope as _build_prompt_envelope
from .state import Input, WorkState
from .state_io import _load, _maybe_raise_legacy_hint, _read_json


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
    _maybe_raise_legacy_hint(state_file)
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


__all__ = [
    "_build_from_diff_file",
    "_build_from_file_file",
    "_build_from_prompt_file",
    "_load_or_build",
]
