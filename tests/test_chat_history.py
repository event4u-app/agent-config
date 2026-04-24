"""Tests for scripts/chat_history.py — JSONL chat-history helper."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import chat_history as ch  # noqa: E402


@pytest.fixture
def hist(tmp_path: Path) -> Path:
    return tmp_path / "chat-history.jsonl"


def test_fingerprint_is_stable_and_sha256():
    fp = ch.fingerprint("Hello world")
    assert len(fp) == 64
    assert all(c in "0123456789abcdef" for c in fp)
    assert fp == ch.fingerprint("Hello world")


def test_fingerprint_normalizes_whitespace():
    # Tabs, newlines, multiple spaces collapse to single spaces
    assert ch.fingerprint("a  b") == ch.fingerprint("a\tb")
    assert ch.fingerprint("a b") == ch.fingerprint("  a b  ")
    assert ch.fingerprint("a b") == ch.fingerprint("a\nb")


def test_fingerprint_distinguishes_content():
    assert ch.fingerprint("foo") != ch.fingerprint("bar")


def test_init_writes_header_only(hist: Path):
    header = ch.init("first user msg", freq="per_phase", path=hist)
    assert header["t"] == "header"
    assert header["v"] == ch.SCHEMA_VERSION
    assert header["freq"] == "per_phase"
    assert header["fp"] == ch.fingerprint("first user msg")
    assert header["preview"] == "first user msg"
    lines = hist.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 1
    assert json.loads(lines[0]) == header


def test_init_rejects_invalid_freq(hist: Path):
    with pytest.raises(ValueError):
        ch.init("msg", freq="hourly", path=hist)


def test_append_adds_entry_with_auto_timestamp(hist: Path):
    ch.init("msg", path=hist)
    ch.append({"t": "user", "text": "hi"}, path=hist)
    lines = hist.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 2
    entry = json.loads(lines[1])
    assert entry["t"] == "user"
    assert entry["text"] == "hi"
    assert "ts" in entry


def test_append_rejects_header_type(hist: Path):
    ch.init("msg", path=hist)
    with pytest.raises(ValueError):
        ch.append({"t": "header", "x": 1}, path=hist)


def test_append_rejects_empty_type(hist: Path):
    ch.init("msg", path=hist)
    with pytest.raises(ValueError):
        ch.append({"text": "no t"}, path=hist)


def test_read_header_missing_returns_none(hist: Path):
    assert ch.read_header(hist) is None


def test_read_header_empty_file_returns_none(hist: Path):
    hist.write_text("", encoding="utf-8")
    assert ch.read_header(hist) is None


def test_read_header_malformed_returns_none(hist: Path):
    hist.write_text("not json\n", encoding="utf-8")
    assert ch.read_header(hist) is None


def test_check_ownership_match(hist: Path):
    ch.init("my msg", path=hist)
    assert ch.check_ownership("my msg", path=hist) == "match"


def test_check_ownership_mismatch(hist: Path):
    ch.init("my msg", path=hist)
    assert ch.check_ownership("other msg", path=hist) == "mismatch"


def test_check_ownership_missing(hist: Path):
    assert ch.check_ownership("anything", path=hist) == "missing"


def test_adopt_preserves_entries_rewrites_fingerprint(hist: Path):
    ch.init("old", path=hist)
    ch.append({"t": "user", "text": "work"}, path=hist)
    ch.append({"t": "phase", "ev": "start", "name": "analyze"}, path=hist)
    new_header = ch.adopt("new msg", path=hist)
    assert new_header["fp"] == ch.fingerprint("new msg")
    assert new_header["preview"] == "new msg"
    assert "adopted_at" in new_header
    lines = hist.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 3
    assert json.loads(lines[1])["text"] == "work"
    assert json.loads(lines[2])["name"] == "analyze"
    assert ch.check_ownership("new msg", path=hist) == "match"


def test_adopt_without_header_raises(hist: Path):
    with pytest.raises(FileNotFoundError):
        ch.adopt("anything", path=hist)


def test_clear_removes_file(hist: Path):
    ch.init("msg", path=hist)
    assert hist.exists()
    ch.clear(path=hist)
    assert not hist.exists()


def test_clear_noop_when_missing(hist: Path):
    ch.clear(path=hist)  # should not raise


def test_status_missing_file(hist: Path):
    s = ch.status(path=hist)
    assert s["exists"] is False


def test_status_counts_entries(hist: Path):
    ch.init("msg", path=hist)
    for i in range(5):
        ch.append({"t": "tool", "name": f"tool{i}"}, path=hist)
    s = ch.status(path=hist)
    assert s["exists"] is True
    assert s["entries"] == 5
    assert s["header"]["fp"] == ch.fingerprint("msg")


def test_overflow_noop_when_under_limit(hist: Path):
    ch.init("msg", path=hist)
    ch.append({"t": "user", "text": "small"}, path=hist)
    result = ch.overflow_handle(max_kb=100, mode="rotate", path=hist)
    assert result["action"] == "noop"


def test_overflow_rotate_drops_oldest_keeps_header(hist: Path):
    ch.init("msg", path=hist)
    # Append many large entries to force overflow
    big_text = "x" * 500
    for i in range(50):
        ch.append({"t": "tool", "i": i, "big": big_text}, path=hist)
    assert hist.stat().st_size > 5 * 1024
    result = ch.overflow_handle(max_kb=5, mode="rotate", path=hist)
    assert result["action"] == "rotate"
    assert result["kept"] < 50
    assert result["dropped"] > 0
    # Header must still be valid
    header = ch.read_header(hist)
    assert header is not None
    assert header["fp"] == ch.fingerprint("msg")
    # File must be under budget now
    assert hist.stat().st_size <= 5 * 1024
    # Newest entries must be retained (last i stays)
    lines = hist.read_text(encoding="utf-8").splitlines()
    last_entry = json.loads(lines[-1])
    assert last_entry["i"] == 49


def test_overflow_compress_marks_entry(hist: Path):
    ch.init("msg", path=hist)
    big_text = "x" * 500
    for i in range(50):
        ch.append({"t": "tool", "i": i, "big": big_text}, path=hist)
    result = ch.overflow_handle(max_kb=1, mode="compress", path=hist)
    assert result["action"] == "compress_marked"
    lines = hist.read_text(encoding="utf-8").splitlines()
    marker = json.loads(lines[-1])
    assert marker["t"] == "needs_compress"
    assert "reason" in marker


def test_overflow_rejects_invalid_mode(hist: Path):
    ch.init("msg", path=hist)
    with pytest.raises(ValueError):
        ch.overflow_handle(max_kb=1, mode="shred", path=hist)


def test_file_path_respects_env(monkeypatch, tmp_path: Path):
    target = tmp_path / "override.jsonl"
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(target))
    assert ch.file_path() == target


def test_cli_init_and_status(tmp_path: Path, monkeypatch, capsys):
    target = tmp_path / "cli.jsonl"
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(target))
    rc = ch.main(["init", "--first-user-msg", "hello cli", "--freq", "per_turn"])
    assert rc == 0
    capsys.readouterr()
    rc = ch.main(["status"])
    assert rc == 0
    out = capsys.readouterr().out
    data = json.loads(out)
    assert data["exists"] is True
    assert data["header"]["freq"] == "per_turn"
    assert data["header"]["fp"] == ch.fingerprint("hello cli")


def test_cli_append_and_check(tmp_path: Path, monkeypatch, capsys):
    target = tmp_path / "cli.jsonl"
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(target))
    ch.main(["init", "--first-user-msg", "orig msg"])
    ch.main(["append", "--type", "user", "--json", '{"text":"hi"}'])
    capsys.readouterr()
    ch.main(["check", "--first-user-msg", "orig msg"])
    assert capsys.readouterr().out.strip() == "match"
    ch.main(["check", "--first-user-msg", "different"])
    assert capsys.readouterr().out.strip() == "mismatch"
