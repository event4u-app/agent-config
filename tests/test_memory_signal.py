"""Tests for scripts/memory_signal.py — the write-side helper."""

from __future__ import annotations

import datetime as dt
import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import memory_signal  # noqa: E402


@pytest.fixture(autouse=True)
def _chdir_and_paths(monkeypatch, tmp_path):
    monkeypatch.chdir(tmp_path)
    monkeypatch.setattr(memory_signal, "INTAKE_ROOT",
                        tmp_path / "agents/memory/intake")


def _read_all_lines() -> list[dict]:
    lines = []
    for jsonl in (memory_signal.INTAKE_ROOT).glob("signals-*.jsonl"):
        for line in jsonl.read_text(encoding="utf-8").splitlines():
            if line.strip():
                lines.append(json.loads(line))
    return lines


def test_emit_writes_append_only_jsonl():
    rec = memory_signal.emit(
        "historical-patterns",
        "app/Foo.php",
        "null deref when X is missing",
    )
    assert rec is not None
    all_lines = _read_all_lines()
    assert len(all_lines) == 1
    written = all_lines[0]
    assert written["entry_type"] == "historical-patterns"
    assert written["path"] == "app/Foo.php"
    assert written["body"] == "null deref when X is missing"
    assert written["id"].startswith("sig-")
    assert written["origin"] == "agent"


def test_rate_limit_skips_duplicate_within_window():
    memory_signal.emit("incident-learnings", "queue/x.php", "timeout on retry")
    second = memory_signal.emit("incident-learnings",
                                "queue/x.php", "timeout on retry")
    assert second is None, "second emit within window must be skipped"
    assert len(_read_all_lines()) == 1


def test_force_bypasses_rate_limit():
    memory_signal.emit("ownership", "app/Http/Billing", "team-payments")
    again = memory_signal.emit("ownership", "app/Http/Billing",
                               "team-payments", force=True)
    assert again is not None
    assert len(_read_all_lines()) == 2


def test_rate_limit_does_not_skip_different_body():
    memory_signal.emit("historical-patterns", "app/A.php", "bug 1")
    second = memory_signal.emit("historical-patterns", "app/A.php", "bug 2")
    assert second is not None
    assert len(_read_all_lines()) == 2


def test_rate_limit_window_expiry(monkeypatch):
    """An entry older than the window must not block a fresh emit."""
    memory_signal.emit("historical-patterns", "app/B.php", "flake")
    # Rewrite the one line with a stale timestamp (10 days old).
    target = memory_signal._monthly_file()
    stale = dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=10)
    records = [json.loads(line)
               for line in target.read_text(encoding="utf-8").splitlines()
               if line.strip()]
    records[0]["ts"] = stale.isoformat(timespec="seconds")
    target.write_text("\n".join(json.dumps(r) for r in records) + "\n",
                      encoding="utf-8")
    second = memory_signal.emit("historical-patterns", "app/B.php", "flake")
    assert second is not None, "emit outside rate-limit window must proceed"


def test_unknown_type_raises():
    with pytest.raises(ValueError, match="unknown memory type"):
        memory_signal.emit("not-a-type", "x", "y")


def test_missing_fields_raise():
    with pytest.raises(ValueError):
        memory_signal.emit("ownership", "", "body")
    with pytest.raises(ValueError):
        memory_signal.emit("ownership", "app/x", "")


def test_extra_fields_are_preserved():
    rec = memory_signal.emit(
        "historical-patterns", "app/Foo.php", "off-by-one",
        extra={"symptom": "returns wrong count", "severity": "medium"},
    )
    assert rec["symptom"] == "returns wrong count"
    assert rec["severity"] == "medium"


def test_extra_cannot_overwrite_reserved():
    rec = memory_signal.emit(
        "ownership", "app/x", "team-x",
        extra={"id": "hijack", "path": "other"},
    )
    assert rec["id"].startswith("sig-"), "reserved id must not be overwritten"
    assert rec["path"] == "app/x"



def test_skip_when_present_true_suppresses_jsonl(monkeypatch, tmp_path):
    pytest.importorskip("yaml")
    monkeypatch.setattr(memory_signal, "SETTINGS_FILE",
                        tmp_path / ".agent-settings.yml")
    (tmp_path / ".agent-settings.yml").write_text(
        "memory:\n  intake:\n    skip_when_present: true\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(memory_signal, "_backend_status", lambda: "present")
    rec = memory_signal.emit("historical-patterns", "app/Foo.php", "x")
    assert rec is not None
    assert rec["_backend"] == "package-only"
    # No JSONL file must exist.
    assert not (tmp_path / "agents/memory/intake").exists() or \
           not list((tmp_path / "agents/memory/intake").glob("signals-*.jsonl"))


def test_skip_when_present_false_still_writes(monkeypatch, tmp_path):
    pytest.importorskip("yaml")
    monkeypatch.setattr(memory_signal, "SETTINGS_FILE",
                        tmp_path / ".agent-settings.yml")
    (tmp_path / ".agent-settings.yml").write_text(
        "memory:\n  intake:\n    skip_when_present: false\n",
        encoding="utf-8",
    )
    monkeypatch.setattr(memory_signal, "_backend_status", lambda: "present")
    rec = memory_signal.emit("historical-patterns", "app/Bar.php", "y")
    assert rec is not None
    assert "_backend" not in rec
    assert _read_all_lines()  # file exists, has a line


def test_backend_absent_writes_regardless(monkeypatch, tmp_path):
    monkeypatch.setattr(memory_signal, "_backend_status", lambda: "absent")
    rec = memory_signal.emit("product-rules", "app/Baz.php", "z")
    assert rec is not None
    assert "_backend" not in rec
    assert _read_all_lines()


def test_missing_settings_file_defaults_to_writing(monkeypatch):
    # No settings file → never skip
    monkeypatch.setattr(memory_signal, "_backend_status", lambda: "present")
    rec = memory_signal.emit("ownership", "app/x", "team-y")
    assert rec is not None
    assert "_backend" not in rec
