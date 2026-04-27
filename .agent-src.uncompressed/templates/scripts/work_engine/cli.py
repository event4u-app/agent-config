"""Command-line entry point for ``/implement-ticket``.

Minimal Option-A transport: the script loads a persisted
``DeliveryState`` (or builds one from a ticket file), runs the
dispatcher once, writes the updated state back, and prints either
the delivery report (on SUCCESS) or the halt surface — directive
plus numbered questions — on BLOCKED/PARTIAL.

The script never edits code, runs tests, or opens pull requests.
All of that is delegated to the agent via ``@agent-directive:``
markers per
``agents/contexts/implement-ticket-flow.md#agent-directives``. The
agent executes the directive, writes the resulting slice back to
the state file, and re-invokes this script to resume.

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
from dataclasses import asdict
from pathlib import Path
from typing import Sequence

from .delivery_state import DeliveryState, Outcome
from .dispatcher import dispatch
from .directives.backend import analyze, implement, memory, plan, refine, report, verify
from .directives.backend import test as test_step

DEFAULT_STATE_FILE = Path(".implement-ticket-state.json")
"""State file used when ``--state-file`` is not passed."""

_STEPS = {
    "refine": refine.run,
    "memory": memory.run,
    "analyze": analyze.run,
    "plan": plan.run,
    "implement": implement.run,
    "test": test_step.run,
    "verify": verify.run,
    "report": report.run,
}


def main(argv: Sequence[str] | None = None) -> int:
    """Run one dispatch cycle against the persisted state.

    ``argv`` is taken as-is; pass ``None`` to fall back to
    ``sys.argv[1:]`` (the usual entry-point contract).
    """
    parser = _build_parser()
    args = parser.parse_args(argv)
    state_file: Path = args.state_file

    try:
        state = _load_or_build(state_file, args)
    except _CLIError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    final, halting = dispatch(state, _STEPS)
    _save(state_file, state)
    _emit(state, final, halting)
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
        "--persona",
        type=str,
        default=None,
        help="Persona name (senior-engineer | qa | advisory). Only honoured "
        "when the state file does not exist yet; ignored on resume so a "
        "mid-flight persona switch cannot silently change behaviour.",
    )
    return parser


def _load_or_build(state_file: Path, args: argparse.Namespace) -> DeliveryState:
    """Return the state to dispatch against — either loaded or freshly built."""
    if state_file.exists():
        return _load(state_file)
    if args.ticket_file is None:
        raise _CLIError(
            f"No state file at {state_file} and no --ticket-file given; "
            "cannot build an initial DeliveryState.",
        )
    ticket = _read_json(args.ticket_file)
    if not isinstance(ticket, dict):
        raise _CLIError(
            f"--ticket-file must carry a JSON object; got {type(ticket).__name__}.",
        )
    kwargs: dict = {"ticket": ticket}
    if args.persona:
        kwargs["persona"] = args.persona
    return DeliveryState(**kwargs)


def _load(state_file: Path) -> DeliveryState:
    data = _read_json(state_file)
    if not isinstance(data, dict):
        raise _CLIError(
            f"State file {state_file} must carry a JSON object; "
            f"got {type(data).__name__}.",
        )
    try:
        return DeliveryState(**data)
    except TypeError as exc:
        raise _CLIError(f"State file shape is invalid: {exc}") from exc


def _save(state_file: Path, state: DeliveryState) -> None:
    """Persist ``state`` as pretty JSON for diffing + human inspection."""
    state_file.parent.mkdir(parents=True, exist_ok=True)
    state_file.write_text(
        json.dumps(asdict(state), indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )


def _read_json(path: Path):
    try:
        raw = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise _CLIError(f"Cannot read {path}: {exc}") from exc
    try:
        return json.loads(raw)
    except json.JSONDecodeError as exc:
        raise _CLIError(f"Invalid JSON in {path}: {exc}") from exc


def _emit(state: DeliveryState, final: Outcome, halting: str | None) -> None:
    if final is Outcome.SUCCESS:
        print(state.report)
        return
    print(f"[halt] outcome={final.value} step={halting or '(none)'}")
    for line in state.questions:
        print(line)


class _CLIError(Exception):
    """Raised on configuration or I/O problems. Converted to exit code 2."""


__all__ = ["DEFAULT_STATE_FILE", "main"]
