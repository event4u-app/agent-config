"""Unit tests for ``scripts/adoption_snapshot.py``.

Phase D Step 2 of ``road-to-adoption-proof-and-ci-green.md``.
Covers the JSONL row shape, the ``--no-network`` path, and the
``all_signals_failed`` predicate. Live HTTP calls are not
exercised — the production cron path is the only caller that hits
the wire.
"""
from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
MODULE_PATH = REPO_ROOT / "scripts" / "adoption_snapshot.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("adoption_snapshot", MODULE_PATH)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["adoption_snapshot"] = mod
    spec.loader.exec_module(mod)
    return mod


def test_no_network_emits_skipped_signals() -> None:
    mod = _load_module()
    signals = mod.collect_signals(skip_network=True)
    assert set(signals.keys()) == {
        "npm_downloads",
        "npm_version",
        "github_stars",
        "topic_rank",
    }
    for value in signals.values():
        assert value.get("error") == "skipped"
        assert value.get("source") == "skipped"


def test_build_row_carries_iso_timestamp_and_schema() -> None:
    mod = _load_module()
    signals = mod.collect_signals(skip_network=True)
    row = mod.build_row(signals)
    assert row["schema"] == "adoption-snapshot/v0"
    assert row["snapshot_at"].endswith("Z")
    assert "T" in row["snapshot_at"]
    assert row["signals"] is signals


def test_append_row_writes_jsonl(tmp_path) -> None:
    mod = _load_module()
    out = tmp_path / "snapshots.jsonl"
    row = {"snapshot_at": "2026-05-26T00:00:00Z", "schema": "adoption-snapshot/v0", "signals": {}}
    mod.append_row(out, row)
    mod.append_row(out, row)
    lines = out.read_text(encoding="utf-8").strip().split("\n")
    assert len(lines) == 2
    parsed = [json.loads(line) for line in lines]
    assert all(p["schema"] == "adoption-snapshot/v0" for p in parsed)


def test_append_row_creates_parent_dirs(tmp_path) -> None:
    mod = _load_module()
    out = tmp_path / "nested" / "subdir" / "snapshots.jsonl"
    row = {"snapshot_at": "2026-05-26T00:00:00Z", "schema": "adoption-snapshot/v0", "signals": {}}
    mod.append_row(out, row)
    assert out.exists()


def test_all_signals_failed_detects_outage() -> None:
    mod = _load_module()
    skipped = {"error": "skipped", "source": "skipped"}
    all_skipped = {
        "npm_downloads": skipped,
        "npm_version": skipped,
        "github_stars": skipped,
        "topic_rank": {"source": "skipped", "agent-skills": skipped, "cinematic-ai-video": skipped},
    }
    assert mod.all_signals_failed(all_skipped) is True


def test_all_signals_failed_detects_partial_success() -> None:
    mod = _load_module()
    mixed = {
        "npm_downloads": {"package": "x", "last_7_days": 12, "source": "npm"},
        "npm_version": {"error": "skipped", "source": "skipped"},
        "github_stars": {"error": "skipped", "source": "skipped"},
        "topic_rank": {"source": "github-search"},
    }
    assert mod.all_signals_failed(mixed) is False


def test_main_no_network_writes_file_and_returns_zero(tmp_path) -> None:
    mod = _load_module()
    out = tmp_path / "snapshots.jsonl"
    rc = mod.main(["--no-network", "--out", str(out)])
    assert rc == 0
    lines = out.read_text(encoding="utf-8").strip().split("\n")
    assert len(lines) == 1
    parsed = json.loads(lines[0])
    assert parsed["schema"] == "adoption-snapshot/v0"
    assert parsed["signals"]["npm_downloads"]["error"] == "skipped"
