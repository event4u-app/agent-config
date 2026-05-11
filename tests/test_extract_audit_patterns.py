"""Tests for ``scripts/extract_audit_patterns.py``.

Pattern-mining consumer of ``audit-log-v1`` (see
``docs/contracts/audit-log-v1.md``). The mining script is read-only;
these tests build a synthetic JSONL audit directory and assert
grouping, the ``work_id`` independence floor, supersede chains, and
forward-compat handling of unknown schema versions.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import extract_audit_patterns as eap  # noqa: E402


def _line(
    *,
    id: str,
    work_id: str,
    phase: str = "verify",
    outcome: str = "success",
    rules: list[str] | None = None,
    ts: str = "2026-05-11T12:00:00Z",
    type_: str = "phase",
    supersedes: str | None = None,
    schema_version: int = 1,
) -> dict:
    rec = {
        "schema_version": schema_version,
        "id": id,
        "ts": ts,
        "work_id": work_id,
        "phase": phase,
        "outcome": outcome,
        "confidence_band": "high",
        "risk_class": "low",
        "memory": {"asks": 0, "hits": 0},
        "verify": {"claims": 1, "first_try_passes": 1},
        "rules_applied": rules or [],
        "persona": None,
        "input_kind": "ticket",
        "type": type_,
    }
    if supersedes:
        rec["supersedes"] = supersedes
    return rec


def _write_audit(tmp_path: Path, lines: list[dict], month: str = "2026-05") -> Path:
    d = tmp_path / "audit"
    d.mkdir()
    f = d / f"{month}.jsonl"
    f.write_text("\n".join(json.dumps(r) for r in lines) + "\n", encoding="utf-8")
    return d


def test_groups_by_phase_outcome_rules(tmp_path: Path) -> None:
    lines = [
        _line(id="A", work_id="w1", rules=["r1", "r2"]),
        _line(id="B", work_id="w2", rules=["r2", "r1"]),  # same after sort
        _line(id="C", work_id="w3", rules=["r1"]),  # different group
    ]
    audit_dir = _write_audit(tmp_path, lines)
    patterns = eap.mine(audit_dir, month=None, min_count=2)
    assert len(patterns) == 1
    p = patterns[0]
    assert p["count"] == 2
    assert sorted(p["line_ids"]) == ["A", "B"]
    assert p["rules_applied"] == ["r1", "r2"]


def test_independence_floor_same_work_id_counts_once(tmp_path: Path) -> None:
    """Two lines from the same `work_id` must NOT pass the min-count gate."""
    lines = [
        _line(id="A", work_id="w1"),
        _line(id="B", work_id="w1"),  # same work_id — counts as one
    ]
    audit_dir = _write_audit(tmp_path, lines)
    patterns = eap.mine(audit_dir, month=None, min_count=2)
    assert patterns == [], "same work_id must collapse to count=1"


def test_supersede_chain_drops_prior(tmp_path: Path) -> None:
    lines = [
        _line(id="A", work_id="w1"),
        _line(id="B", work_id="w2"),
        _line(id="C", work_id="w3", type_="supersede", supersedes="B"),
    ]
    audit_dir = _write_audit(tmp_path, lines)
    patterns = eap.mine(audit_dir, month=None, min_count=2)
    # B is dropped; C is a supersede (not type=phase) → ignored too.
    # Only A remains → below min-count 2 → no patterns.
    assert patterns == []


def test_unknown_schema_version_is_skipped(tmp_path: Path) -> None:
    lines = [
        _line(id="A", work_id="w1"),
        _line(id="B", work_id="w2", schema_version=99),
    ]
    audit_dir = _write_audit(tmp_path, lines)
    patterns = eap.mine(audit_dir, month=None, min_count=2)
    assert patterns == []


def test_malformed_json_lines_are_skipped(tmp_path: Path) -> None:
    audit_dir = tmp_path / "audit"
    audit_dir.mkdir()
    f = audit_dir / "2026-05.jsonl"
    good = _line(id="A", work_id="w1")
    good2 = _line(id="B", work_id="w2")
    f.write_text(
        json.dumps(good) + "\n"
        + "{not json\n"
        + "\n"
        + json.dumps(good2) + "\n",
        encoding="utf-8",
    )
    patterns = eap.mine(audit_dir, month=None, min_count=2)
    assert len(patterns) == 1
    assert patterns[0]["count"] == 2


def test_missing_audit_dir_yields_empty(tmp_path: Path) -> None:
    assert eap.mine(tmp_path / "nope", month=None, min_count=2) == []


def test_cli_rejects_min_count_below_two(tmp_path: Path, capsys) -> None:
    rc = eap.main(["--audit-dir", str(tmp_path), "--min-count", "1"])
    assert rc == 2
    err = capsys.readouterr().err
    assert "independence floor" in err


def test_cli_json_emits_machine_readable(tmp_path: Path, capsys) -> None:
    lines = [
        _line(id="A", work_id="w1", ts="2026-05-01T00:00:00Z"),
        _line(id="B", work_id="w2", ts="2026-05-02T00:00:00Z"),
    ]
    audit_dir = _write_audit(tmp_path, lines)
    rc = eap.main(["--audit-dir", str(audit_dir), "--json"])
    assert rc == 0
    out = json.loads(capsys.readouterr().out)
    assert len(out) == 1
    assert out[0]["count"] == 2
    assert out[0]["first_seen"] == "2026-05-01T00:00:00Z"
    assert out[0]["last_seen"] == "2026-05-02T00:00:00Z"
