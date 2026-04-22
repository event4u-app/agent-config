"""Tests for scripts/check_memory_proposal.py — the promotion gate."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import check_memory_proposal as gate  # noqa: E402


@pytest.fixture(autouse=True)
def _chdir(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(gate, "INTAKE_ROOT",
                        tmp_path / "agents/memory/intake")


def _write_intake(lines: list[dict], name: str = "signals-2026-04.jsonl"):
    root = gate.INTAKE_ROOT
    root.mkdir(parents=True, exist_ok=True)
    target = root / name
    with target.open("w", encoding="utf-8") as fh:
        for obj in lines:
            fh.write(json.dumps(obj) + "\n")


def test_pattern_signal_passes_on_sibling_paths():
    _write_intake([
        {"id": "sig-1", "entry_type": "historical-patterns",
         "path": "app/A.php", "body": "null deref"},
        {"id": "sig-2", "entry_type": "historical-patterns",
         "path": "app/B.php", "body": "null deref"},
    ])
    record = gate._find_intake("sig-1")
    assert record is not None
    failures = gate.check(record, "sig-1")
    assert failures == []


def test_single_path_requires_future_decisions():
    _write_intake([
        {"id": "sig-solo", "entry_type": "incident-learnings",
         "path": "queue/x", "body": "timeout on retry"},
    ])
    record = gate._find_intake("sig-solo")
    failures = gate.check(record, "sig-solo")
    assert any("future_decisions" in f for f in failures)


def test_future_decisions_satisfies_weak_evidence():
    _write_intake([
        {"id": "sig-fd", "entry_type": "architecture-decisions",
         "path": "app/X.php", "body": "use service Y",
         "future_decisions": [
             {"decision": "A", "expected_by": "2026-05-01", "owner": "t1"},
             {"decision": "B", "expected_by": "2026-06-01", "owner": "t2"},
             {"decision": "C", "expected_by": "2026-07-01", "owner": "t3"},
         ]},
    ])
    record = gate._find_intake("sig-fd")
    assert gate.check(record, "sig-fd") == []


def test_incomplete_future_decision_fails():
    _write_intake([
        {"id": "sig-part", "entry_type": "product-rules",
         "path": "app/x", "body": "cap N users",
         "future_decisions": [
             {"decision": "A", "owner": "t1"},  # missing expected_by
             {"decision": "B", "expected_by": "2026-06-01", "owner": "t2"},
             {"decision": "C", "expected_by": "2026-07-01", "owner": "t3"},
         ]},
    ])
    record = gate._find_intake("sig-part")
    failures = gate.check(record, "sig-part")
    assert any("expected_by" in f for f in failures)


def test_unknown_type_fails():
    failures = gate.check({"id": "x", "entry_type": "not-real",
                           "path": "a", "body": "b"}, "inline")
    assert any("entry_type" in f for f in failures)


def test_missing_required_field_fails():
    failures = gate.check({"id": "x", "entry_type": "ownership",
                           "body": "owner"}, "inline")  # no path
    assert any("path" in f for f in failures)


def test_intake_not_found_returns_none():
    _write_intake([
        {"id": "sig-1", "entry_type": "ownership",
         "path": "a", "body": "b"},
    ])
    assert gate._find_intake("sig-missing") is None
