"""Conformance: the shipped file-backed backend speaks v1.

These tests are the gate that proves Phase 1 of the retrieval-contract
consumer roadmap. They run without any `agent-memory` dependency — a
fresh clone of this repo must pass them.
"""

from __future__ import annotations

import json
import subprocess
import sys
import textwrap
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[3] / "scripts"))
import memory_lookup  # noqa: E402
import memory_status  # noqa: E402

from tests.conformance.retrieval.validator import (  # noqa: E402
    validate_health,
    validate_retrieve,
)

SCRIPTS = Path(__file__).resolve().parents[3] / "scripts"


def _chdir(monkeypatch, tmp_path: Path) -> None:
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(memory_lookup, "MEMORY_ROOT",
                        Path("agents/memory"))
    monkeypatch.setattr(memory_lookup, "INTAKE_ROOT",
                        Path("agents/memory/intake"))


def _write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(textwrap.dedent(content), encoding="utf-8")


def test_retrieve_v1_empty_is_valid(tmp_path, monkeypatch):
    _chdir(monkeypatch, tmp_path)
    envelope = memory_lookup.retrieve_v1(["ownership"], ["anything"])
    validate_retrieve(envelope)
    assert envelope["status"] == "ok"
    assert envelope["entries"] == []
    assert envelope["slices"] == {"ownership": {"status": "ok", "count": 0}}


def test_retrieve_v1_single_hit_is_valid(tmp_path, monkeypatch):
    _chdir(monkeypatch, tmp_path)
    _write(tmp_path / "agents/memory/ownership.yml", """
        version: 1
        entries:
          - id: own-01
            path: "app/Http/Controllers/UserController.php"
            owner: "team-growth"
    """)
    envelope = memory_lookup.retrieve_v1(
        ["ownership"], ["UserController"], limit=5,
    )
    validate_retrieve(envelope)
    assert envelope["status"] == "ok"
    assert len(envelope["entries"]) == 1
    assert envelope["entries"][0]["id"] == "own-01"
    assert envelope["entries"][0]["source"] == "repo"
    assert envelope["entries"][0]["type"] == "ownership"
    assert envelope["slices"]["ownership"]["count"] == 1


def test_retrieve_v1_unknown_type_reports_per_slice(tmp_path, monkeypatch):
    """Unknown type MUST not fail the whole call — only its slice."""
    _chdir(monkeypatch, tmp_path)
    envelope = memory_lookup.retrieve_v1(
        ["ownership", "not-a-real-type"], ["x"],
    )
    validate_retrieve(envelope)
    assert envelope["slices"]["ownership"]["status"] == "ok"
    assert envelope["slices"]["not-a-real-type"]["status"] == "unknown_type"
    assert envelope["status"] == "partial"
    assert any(
        e["type"] == "not-a-real-type" and e["code"] == "unknown_type"
        for e in envelope["errors"]
    )


def test_retrieve_v1_all_unknown_types_is_error(tmp_path, monkeypatch):
    _chdir(monkeypatch, tmp_path)
    envelope = memory_lookup.retrieve_v1(["not-a-real-type"], ["x"])
    validate_retrieve(envelope)
    assert envelope["status"] == "error"
    assert envelope["entries"] == []


def test_health_envelope_is_valid(monkeypatch):
    # Ensure status is detected as `absent` in the test environment so the
    # probe is deterministic and never blocks on an installed CLI.
    monkeypatch.setattr(memory_status, "_find_cli", lambda: "")
    monkeypatch.delenv(memory_status._CACHE_ENV, raising=False)
    envelope = memory_status.health(refresh=True)
    validate_health(envelope)
    assert envelope["contract_version"] == 1
    assert "file-fallback" in envelope["features"]


def test_cli_retrieve_v1_output_is_valid(tmp_path):
    """CLI path: `python3 scripts/memory_lookup.py --envelope v1` emits a valid envelope."""
    out = subprocess.check_output(
        [sys.executable, str(SCRIPTS / "memory_lookup.py"),
         "--types", "ownership", "--key", "any",
         "--envelope", "v1"],
        cwd=str(tmp_path),
        text=True,
    )
    envelope = json.loads(out)
    validate_retrieve(envelope)


def test_cli_health_output_is_valid(tmp_path, monkeypatch):
    """CLI path: `python3 scripts/memory_status.py --health` emits a valid envelope."""
    # Neutralise any test-local status cache so the file reflects the
    # real (absent) probe rather than a stale session state.
    monkeypatch.setenv("AGENT_MEMORY_STATUS", "")
    out = subprocess.check_output(
        [sys.executable, str(SCRIPTS / "memory_status.py"),
         "--health", "--refresh"],
        cwd=str(tmp_path),
        text=True,
    )
    envelope = json.loads(out)
    validate_health(envelope)
    assert envelope["contract_version"] == 1


def test_retrieve_v1_survives_operational_provider_exception(tmp_path, monkeypatch):
    """An operational backend that raises does not crash the envelope."""
    _chdir(monkeypatch, tmp_path)

    def boom(_types, _keys):
        raise RuntimeError("backend went away")

    envelope = memory_lookup.retrieve_v1(
        ["ownership"], ["x"],
        operational_provider=boom,
    )
    validate_retrieve(envelope)
