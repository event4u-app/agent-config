"""Argument parser and state-file constants for the CLI entry point.

Extracted from ``cli.py`` in P2.3 of
``road-to-post-pr29-optimize.md``. Behaviour-preserving: the parser
shape, default values, help strings and exit-code semantics are
byte-identical to the pre-split version. The constants moved here
so the parser default and the legacy-file detector both reference
a single source of truth.
"""
from __future__ import annotations

import argparse
from pathlib import Path

DEFAULT_STATE_FILE = Path(".work-state.json")
"""State file used when ``--state-file`` is not passed.

Renamed from ``.implement-ticket-state.json`` in 1.15.0 alongside the
``implement_ticket → work_engine`` package move. The legacy filename is
still recognised on load (see :data:`LEGACY_STATE_FILE` below) so that
existing checkouts surface a clear migration message instead of a
silent "no state file" error."""

LEGACY_STATE_FILE = Path(".implement-ticket-state.json")
"""Pre-1.15.0 default state file. Detected only as a migration hint;
never written to. See ``docs/MIGRATION.md``."""

_FMT_V0 = "v0"
_FMT_V1 = "v1"
"""Wire-format markers carried alongside the loaded :class:`WorkState`.

Format-preserving roundtrip: ``_load`` records which shape it parsed,
``_save`` rewrites in that same shape. v0 in → v0 out (Goldens stay
byte-equal); v1 in → v1 out (future flows produced by the migration
tool or a fresh v1 init keep their envelope fields)."""


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


__all__ = [
    "DEFAULT_STATE_FILE",
    "LEGACY_STATE_FILE",
    "_FMT_V0",
    "_FMT_V1",
    "_build_parser",
]
