"""Tests for scripts/lint_flows.py (road-to-6.1.0 Step 8b, ADR-055).

The negative cases sandbox only the flow *files* (a tmp copy via
``FLOWS_DIR``); ``resolve_logical`` still targets the real repo, so real
commands/skills resolve and only the injected fault trips the lint.
"""
from __future__ import annotations

import shutil
from pathlib import Path

import yaml

from scripts import lint_flows as lf


def _seed_real_flows(tmp_path: Path, monkeypatch) -> Path:
    dst = tmp_path / "flows"
    dst.mkdir()
    for f in (lf.ROOT / "src" / "flows").glob("*.yaml"):
        shutil.copy(f, dst / f.name)
    monkeypatch.setattr(lf, "FLOWS_DIR", dst)
    return dst


# --- positive: the shipped flows are valid (regression lock) ----------------

def test_real_flows_are_valid() -> None:
    assert lf.main(["--quiet"]) == 0


def test_seeded_copy_is_valid(tmp_path: Path, monkeypatch) -> None:
    _seed_real_flows(tmp_path, monkeypatch)
    assert lf.main(["--quiet"]) == 0


# --- negative: each fault must fail the lint --------------------------------

def test_bad_command_ref_fails(tmp_path: Path, monkeypatch) -> None:
    dst = _seed_real_flows(tmp_path, monkeypatch)
    p = dst / "review.yaml"
    p.write_text(p.read_text().replace(
        "  - judge\n", "  - judge\n  - not-a-real-command\n", 1))
    assert lf.main(["--quiet"]) == 1


def test_bad_skill_ref_fails(tmp_path: Path, monkeypatch) -> None:
    dst = _seed_real_flows(tmp_path, monkeypatch)
    p = dst / "review.yaml"
    p.write_text(p.read_text().replace(
        "  - code-review\n", "  - code-review\n  - not-a-real-skill\n", 1))
    assert lf.main(["--quiet"]) == 1


def test_unknown_id_rejected(tmp_path: Path, monkeypatch) -> None:
    dst = _seed_real_flows(tmp_path, monkeypatch)
    p = dst / "discovery.yaml"
    p.write_text(p.read_text().replace("id: discovery\n", "id: exploration\n", 1))
    assert lf.main(["--quiet"]) == 1


def test_missing_required_field_fails(tmp_path: Path, monkeypatch) -> None:
    dst = _seed_real_flows(tmp_path, monkeypatch)
    p = dst / "delivery.yaml"
    data = yaml.safe_load(p.read_text())
    del data["skills"]  # schema `required` violation
    p.write_text(yaml.safe_dump(data, sort_keys=False))
    assert lf.main(["--quiet"]) == 1


def test_incomplete_set_fails(tmp_path: Path, monkeypatch) -> None:
    dst = _seed_real_flows(tmp_path, monkeypatch)
    (dst / "delivery.yaml").unlink()  # only 3 of 4 closed-set flows present
    assert lf.main(["--quiet"]) == 1


# --- suggestion helper ------------------------------------------------------

def test_suggest_offers_close_match() -> None:
    assert "did you mean 'pr/create'" in lf._suggest("pr/creat", {"pr/create", "commit"})


def test_suggest_silent_when_no_match() -> None:
    assert lf._suggest("zzzzzzzz", {"pr/create", "commit"}) == ""
