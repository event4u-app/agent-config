"""Migrate a v0 ``DeliveryState`` JSON file to the v1 schema.

The v0 era used ``.implement-ticket-state.json`` and stored the ticket
under a flat ``ticket`` key. v1 wraps the payload under ``input.kind``
/ ``input.data`` and adds ``intent``, ``directive_set``, and
``version``. The default destination is ``.work-state.json`` next to
the v0 file; the v0 file is renamed to ``.implement-ticket-state.json.bak``
to preserve the rollback surface.

The module is both importable and runnable:

    python3 -m work_engine.migration.v0_to_v1 .implement-ticket-state.json

Idempotency: ``migrate_payload`` accepts a payload that already looks
like v1 and returns it unchanged. ``migrate_file`` refuses to migrate
twice — if the destination already exists it raises rather than
silently overwriting work.
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from pathlib import Path
from typing import Any, Sequence

from ..state import (
    DEFAULT_DIRECTIVE_SET,
    DEFAULT_INTENT,
    SCHEMA_VERSION,
    SchemaError,
)

DEFAULT_V0_FILENAME = ".implement-ticket-state.json"
"""Path the dispatcher used while the engine still lived under
``implement_ticket``. The migration looks here when no source path is
passed on the CLI."""

DEFAULT_V1_FILENAME = ".work-state.json"
"""Canonical filename for the v1 wire format."""

BACKUP_SUFFIX = ".bak"
"""Appended to the v0 source path when the migration archives it.

If the ``.bak`` slot is already taken (re-running the migration after
an aborted run, manual rollback, etc.) the rotator falls back to
``.bak.1``, ``.bak.2``, ... — see :func:`_rotate_backup_path`. The
migration never silently overwrites an existing backup."""

_MAX_BACKUP_ROTATIONS = 999
"""Hard ceiling on rotated backup filenames; surfaces an explicit
:class:`SchemaError` instead of looping forever if a checkout has
hundreds of stale backups."""


def _rotate_backup_path(source: Path) -> Path:
    """Return the next free ``.bak`` slot for ``source``.

    Tries ``source.bak`` first, then ``source.bak.1``,
    ``source.bak.2``, ... up to :data:`_MAX_BACKUP_ROTATIONS`. The
    rotator only inspects existence — collision-safe by construction —
    and never deletes or overwrites prior backups.
    """
    primary = source.with_suffix(source.suffix + BACKUP_SUFFIX)
    if not primary.exists():
        return primary
    for index in range(1, _MAX_BACKUP_ROTATIONS + 1):
        candidate = primary.with_suffix(primary.suffix + f".{index}")
        if not candidate.exists():
            return candidate
    raise SchemaError(
        f"refusing to rotate backup for {source}: more than "
        f"{_MAX_BACKUP_ROTATIONS} stale .bak files already exist; "
        "clean them up before re-running the migration",
    )


def migrate_payload(payload: Any) -> dict[str, Any]:
    """Return the v1 form of ``payload``.

    A payload that already declares ``version: 1`` is returned
    unchanged (deep-copied via ``json.loads(json.dumps(...))`` so the
    caller cannot accidentally mutate the input). Anything else is
    treated as v0 and wrapped: ``ticket`` becomes ``input.data``,
    ``input.kind`` is set to ``"ticket"``, and the engine defaults are
    filled in.

    Raises
    ------
    SchemaError
        If the payload is not a dict, declares a higher version than
        this migration knows about, or lacks a ``ticket`` key.
    """
    if not isinstance(payload, dict):
        raise SchemaError(
            f"v0 state must be a JSON object; got {type(payload).__name__}",
        )

    declared_version = payload.get("version")
    if declared_version == SCHEMA_VERSION:
        return json.loads(json.dumps(payload))
    if declared_version is not None:
        raise SchemaError(
            f"cannot migrate from version {declared_version!r} to "
            f"{SCHEMA_VERSION}; this script only handles v0 (no version key)",
        )

    if "ticket" not in payload:
        raise SchemaError(
            "v0 state must carry a 'ticket' key; got keys: "
            f"{sorted(payload.keys())}",
        )
    ticket = payload["ticket"]
    if not isinstance(ticket, dict):
        raise SchemaError(
            f"v0 state.ticket must be a JSON object; got {type(ticket).__name__}",
        )

    return {
        "version": SCHEMA_VERSION,
        "input": {"kind": "ticket", "data": ticket},
        "intent": DEFAULT_INTENT,
        "directive_set": DEFAULT_DIRECTIVE_SET,
        "persona": payload.get("persona", "senior-engineer"),
        "memory": list(payload.get("memory", [])),
        "plan": payload.get("plan"),
        "changes": list(payload.get("changes", [])),
        "tests": payload.get("tests"),
        "verify": payload.get("verify"),
        "outcomes": dict(payload.get("outcomes", {})),
        "questions": list(payload.get("questions", [])),
        "report": payload.get("report", ""),
    }


def migrate_file(
    source: Path,
    *,
    destination: Path | None = None,
    backup: bool = True,
) -> Path:
    """Migrate the v0 state file at ``source`` and write the v1 result.

    ``destination`` defaults to :data:`DEFAULT_V1_FILENAME` next to
    ``source``. When ``backup`` is true (the default) the original
    file is renamed with :data:`BACKUP_SUFFIX` appended; when false,
    the original is left untouched. The destination must not exist —
    refusing to overwrite is the safety net against accidental
    double-migration on CI.

    Returns the destination path on success.
    """
    if not source.is_file():
        raise SchemaError(f"v0 state file not found: {source}")

    raw = source.read_text(encoding="utf-8")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise SchemaError(f"invalid JSON in {source}: {exc}") from exc

    target = destination or source.with_name(DEFAULT_V1_FILENAME)
    if target.exists():
        raise SchemaError(
            f"refusing to overwrite existing destination {target}; "
            "delete or rename it first",
        )

    migrated = migrate_payload(payload)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps(migrated, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    if backup:
        backup_path = _rotate_backup_path(source)
        shutil.move(str(source), str(backup_path))

    return target


def main(argv: Sequence[str] | None = None) -> int:
    """CLI entry point — ``python3 -m work_engine.migration.v0_to_v1``.

    Exits ``0`` on success, ``2`` on any :class:`SchemaError` so the
    invoking shell can branch on the failure category.
    """
    parser = argparse.ArgumentParser(
        prog="work_engine.migration.v0_to_v1",
        description="Migrate a legacy .implement-ticket-state.json file to "
        "the v1 .work-state.json schema.",
    )
    parser.add_argument(
        "source",
        type=Path,
        nargs="?",
        default=Path(DEFAULT_V0_FILENAME),
        help=f"Path to the v0 state file (default: {DEFAULT_V0_FILENAME}).",
    )
    parser.add_argument(
        "--destination",
        type=Path,
        default=None,
        help="Path to write the v1 file to "
        f"(default: {DEFAULT_V1_FILENAME} next to source).",
    )
    parser.add_argument(
        "--no-backup",
        action="store_true",
        help="Do not rename the v0 source to .bak after migration.",
    )
    args = parser.parse_args(argv)

    try:
        target = migrate_file(
            args.source,
            destination=args.destination,
            backup=not args.no_backup,
        )
    except SchemaError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    print(f"migrated {args.source} → {target}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
