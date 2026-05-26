"""Unit tests for ``scripts/adoption_report.py``.

Phase D Step 3 of ``road-to-adoption-proof-and-ci-green.md``. Drives
the rollup against fixture JSONL stores.
"""
from __future__ import annotations

import datetime as dt
import importlib.util
import json
import sys
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parent.parent
MODULE_PATH = REPO_ROOT / "scripts" / "adoption_report.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("adoption_report", MODULE_PATH)
    assert spec is not None and spec.loader is not None
    mod = importlib.util.module_from_spec(spec)
    sys.modules["adoption_report"] = mod
    spec.loader.exec_module(mod)
    return mod


def _make_row(when: dt.datetime, downloads: int = 100, stars: int = 5) -> dict:
    return {
        "snapshot_at": when.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "schema": "adoption-snapshot/v0",
        "signals": {
            "npm_downloads": {"package": "@event4u/agent-config", "last_7_days": downloads, "source": "npm"},
            "npm_version": {"latest": "3.3.0", "version_count": 12, "source": "npm-registry"},
            "github_stars": {"repo": "event4u-app/agent-config", "stars": stars, "forks": 1, "watchers": stars, "source": "github-repo"},
            "topic_rank": {
                "source": "github-search",
                "agent-skills": {"rank": 3, "total_results": 42},
                "cinematic-ai-video": {"rank": 1, "total_results": 5},
            },
        },
    }


def test_empty_jsonl_produces_no_snapshot_message(tmp_path) -> None:
    mod = _load_module()
    in_path = tmp_path / "snapshots.jsonl"
    out_path = tmp_path / "report.md"
    in_path.write_text("")
    rc = mod.main(["--in", str(in_path), "--out", str(out_path), "--weeks", "8"])
    assert rc == 0
    body = out_path.read_text(encoding="utf-8")
    assert "No snapshots in the current window" in body


def test_single_snapshot_renders_four_signal_tables(tmp_path) -> None:
    mod = _load_module()
    in_path = tmp_path / "snapshots.jsonl"
    out_path = tmp_path / "report.md"
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0, tzinfo=None)
    row = _make_row(now)
    in_path.write_text(json.dumps(row) + "\n")
    rc = mod.main(["--in", str(in_path), "--out", str(out_path), "--weeks", "8"])
    assert rc == 0
    body = out_path.read_text(encoding="utf-8")
    assert "npm install count" in body
    assert "npm version distribution" in body
    assert "GitHub stars" in body
    assert "Topic-search rank" in body
    assert "3.3.0" in body


def test_window_filter_drops_older_rows(tmp_path) -> None:
    mod = _load_module()
    in_path = tmp_path / "snapshots.jsonl"
    out_path = tmp_path / "report.md"
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0, tzinfo=None)
    old = now - dt.timedelta(weeks=20)
    in_path.write_text("\n".join([json.dumps(_make_row(old)), json.dumps(_make_row(now))]) + "\n")
    rc = mod.main(["--in", str(in_path), "--out", str(out_path), "--weeks", "8"])
    assert rc == 0
    body = out_path.read_text(encoding="utf-8")
    # The 20-week-old row should not appear in the body.
    assert old.strftime("%Y-%m-%dT") not in body
    assert now.strftime("%Y-%m-%dT") in body


def test_error_row_renders_error_placeholder(tmp_path) -> None:
    mod = _load_module()
    in_path = tmp_path / "snapshots.jsonl"
    out_path = tmp_path / "report.md"
    now = dt.datetime.now(dt.timezone.utc).replace(microsecond=0, tzinfo=None)
    row = _make_row(now)
    row["signals"]["npm_downloads"] = {"error": "rate-limited", "source": "npm"}
    in_path.write_text(json.dumps(row) + "\n")
    rc = mod.main(["--in", str(in_path), "--out", str(out_path), "--weeks", "8"])
    assert rc == 0
    body = out_path.read_text(encoding="utf-8")
    assert "rate-limited" in body


def test_filter_window_rejects_malformed_timestamps() -> None:
    mod = _load_module()
    rows = [
        {"snapshot_at": "not-a-date", "signals": {}},
        {"snapshot_at": dt.datetime.now(dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "signals": {}},
    ]
    out = mod.filter_window(rows, weeks=8)
    assert len(out) == 1


def test_missing_input_file_emits_no_snapshots_message(tmp_path) -> None:
    mod = _load_module()
    in_path = tmp_path / "does-not-exist.jsonl"
    out_path = tmp_path / "report.md"
    rc = mod.main(["--in", str(in_path), "--out", str(out_path)])
    assert rc == 0
    body = out_path.read_text(encoding="utf-8")
    assert "No snapshots in the current window" in body
