"""Migration of legacy ``DeliveryState`` JSON files to schema v1.

Fixtures live under ``tests/work_engine/fixtures/v0/`` — frozen copies
of three captured state snapshots from the Phase 1 baseline. They are
intentionally decoupled from the live golden baselines under
``tests/golden/baseline/``: those snapshots evolve with the schema (R3
Phase 1 added ``stack``, future phases will add more), but the
migration must keep working against the *original* v0 shape forever.

Coverage:

- early flow (GT-1 cycle 1) — only refine/memory/analyze done, plan
  blocked, simple ticket payload
- mid-recovery (GT-3 cycle 4) — tests step blocked with a failure
  recorded, ``changes`` populated
- final delivery (GT-5 cycle 5) — every step success, full report
  text
"""
from __future__ import annotations

import json
from pathlib import Path

import pytest

from work_engine.migration.v0_to_v1 import (
    BACKUP_SUFFIX,
    DEFAULT_V1_FILENAME,
    migrate_file,
    migrate_payload,
)
from work_engine.state import (
    DEFAULT_DIRECTIVE_SET,
    DEFAULT_INTENT,
    SCHEMA_VERSION,
    SchemaError,
    from_dict,
)

FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures" / "v0"

LEGACY_FIXTURES: list[tuple[str, Path]] = [
    ("GT-1/cycle-01", FIXTURES_DIR / "gt-1-cycle-01.json"),
    ("GT-3/cycle-04", FIXTURES_DIR / "gt-3-cycle-04.json"),
    ("GT-5/cycle-05", FIXTURES_DIR / "gt-5-cycle-05.json"),
]


@pytest.fixture(params=LEGACY_FIXTURES, ids=[label for label, _ in LEGACY_FIXTURES])
def legacy_state(request) -> tuple[str, dict]:
    label, path = request.param
    if not path.is_file():
        pytest.skip(f"baseline fixture not present: {path}")
    return label, json.loads(path.read_text(encoding="utf-8"))


class TestMigratePayload:
    def test_migrated_payload_validates_against_v1(self, legacy_state) -> None:
        _label, v0 = legacy_state

        v1 = migrate_payload(v0)

        # Round-trip through the schema's strict validator — proves
        # the migrator emits a payload the engine can actually load.
        rebuilt = from_dict(v1)
        assert rebuilt.version == SCHEMA_VERSION
        assert rebuilt.input.kind == "ticket"
        assert rebuilt.intent == DEFAULT_INTENT
        assert rebuilt.directive_set == DEFAULT_DIRECTIVE_SET

    def test_ticket_payload_is_preserved_verbatim(self, legacy_state) -> None:
        _label, v0 = legacy_state

        v1 = migrate_payload(v0)

        assert v1["input"]["data"] == v0["ticket"]

    def test_legacy_slice_is_preserved(self, legacy_state) -> None:
        _label, v0 = legacy_state

        v1 = migrate_payload(v0)

        for key in ("persona", "memory", "plan", "changes", "tests",
                    "verify", "outcomes", "questions", "report"):
            assert v1[key] == v0[key], f"field {key!r} drifted during migration"

    def test_idempotent_on_already_v1(self, legacy_state) -> None:
        _label, v0 = legacy_state
        v1_once = migrate_payload(v0)

        v1_twice = migrate_payload(v1_once)

        assert v1_twice == v1_once

    def test_rejects_payload_with_higher_version(self) -> None:
        with pytest.raises(SchemaError, match="cannot migrate from version 99"):
            migrate_payload({"version": 99, "input": {"kind": "ticket", "data": {}}})

    def test_rejects_payload_without_ticket(self) -> None:
        with pytest.raises(SchemaError, match="must carry a 'ticket' key"):
            migrate_payload({"persona": "qa"})


class TestMigrateFile:
    def _write_v0(self, tmp_path: Path, payload: dict) -> Path:
        source = tmp_path / ".implement-ticket-state.json"
        source.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
        return source

    def test_writes_canonical_destination_and_renames_source(
        self, tmp_path, legacy_state,
    ) -> None:
        _label, v0 = legacy_state
        source = self._write_v0(tmp_path, v0)

        target = migrate_file(source)

        assert target == tmp_path / DEFAULT_V1_FILENAME
        assert target.is_file()
        assert not source.exists(), "v0 source should be renamed away"
        backup = source.with_suffix(source.suffix + BACKUP_SUFFIX)
        assert backup.is_file(), "v0 source must be preserved as .bak"
        assert json.loads(backup.read_text(encoding="utf-8")) == v0

    def test_no_backup_flag_leaves_source_in_place(self, tmp_path, legacy_state) -> None:
        _label, v0 = legacy_state
        source = self._write_v0(tmp_path, v0)

        target = migrate_file(source, backup=False)

        assert target.is_file()
        assert source.is_file(), "v0 source must remain when backup=False"
        backup = source.with_suffix(source.suffix + BACKUP_SUFFIX)
        assert not backup.exists()

    def test_refuses_to_overwrite_existing_destination(
        self, tmp_path, legacy_state,
    ) -> None:
        _label, v0 = legacy_state
        source = self._write_v0(tmp_path, v0)
        existing = tmp_path / DEFAULT_V1_FILENAME
        existing.write_text("{}\n", encoding="utf-8")

        with pytest.raises(SchemaError, match="refusing to overwrite"):
            migrate_file(source)
        # The pre-existing destination is untouched.
        assert existing.read_text(encoding="utf-8") == "{}\n"

    def test_missing_source_raises(self, tmp_path) -> None:
        with pytest.raises(SchemaError, match="v0 state file not found"):
            migrate_file(tmp_path / "does-not-exist.json")

    def test_invalid_json_source_raises(self, tmp_path) -> None:
        source = tmp_path / ".implement-ticket-state.json"
        source.write_text("not json", encoding="utf-8")

        with pytest.raises(SchemaError, match="invalid JSON"):
            migrate_file(source)

    def test_existing_bak_rotates_to_numbered_slot(
        self, tmp_path, legacy_state,
    ) -> None:
        """A pre-existing ``.bak`` must not be overwritten — the rotator
        falls back to ``.bak.1`` so prior rollback surfaces are
        preserved."""
        _label, v0 = legacy_state
        source = self._write_v0(tmp_path, v0)
        existing_bak = source.with_suffix(source.suffix + BACKUP_SUFFIX)
        existing_bak.write_text("prior backup\n", encoding="utf-8")

        target = migrate_file(source)

        assert target.is_file()
        assert existing_bak.read_text(encoding="utf-8") == "prior backup\n", (
            "pre-existing .bak must be preserved verbatim"
        )
        rotated = existing_bak.with_suffix(existing_bak.suffix + ".1")
        assert rotated.is_file(), "rotator must fall back to .bak.1"
        assert json.loads(rotated.read_text(encoding="utf-8")) == v0

    def test_multiple_bak_rotations_pick_next_free_slot(
        self, tmp_path, legacy_state,
    ) -> None:
        """``.bak`` and ``.bak.1`` taken → migration writes ``.bak.2``."""
        _label, v0 = legacy_state
        source = self._write_v0(tmp_path, v0)
        primary = source.with_suffix(source.suffix + BACKUP_SUFFIX)
        primary.write_text("first\n", encoding="utf-8")
        primary.with_suffix(primary.suffix + ".1").write_text("second\n", encoding="utf-8")

        migrate_file(source)

        next_slot = primary.with_suffix(primary.suffix + ".2")
        assert next_slot.is_file()
        assert json.loads(next_slot.read_text(encoding="utf-8")) == v0
