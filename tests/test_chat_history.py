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


def test_read_entries_empty_when_file_missing(hist: Path):
    assert ch.read_entries(path=hist) == []


def test_read_entries_skips_header_and_returns_appended(hist: Path):
    ch.init("msg", freq="per_turn", path=hist)
    ch.append({"t": "user", "text": "one"}, path=hist)
    ch.append({"t": "agent", "text": "two"}, path=hist)
    ch.append({"t": "phase", "text": "three"}, path=hist)
    entries = ch.read_entries(path=hist)
    assert [e["t"] for e in entries] == ["user", "agent", "phase"]
    assert [e["text"] for e in entries] == ["one", "two", "three"]


def test_read_entries_last_n(hist: Path):
    ch.init("msg", freq="per_turn", path=hist)
    for i in range(5):
        ch.append({"t": "user", "text": f"msg-{i}"}, path=hist)
    last2 = ch.read_entries(last=2, path=hist)
    assert [e["text"] for e in last2] == ["msg-3", "msg-4"]


def test_read_entries_skips_malformed_lines(hist: Path):
    ch.init("msg", freq="per_turn", path=hist)
    ch.append({"t": "user", "text": "good"}, path=hist)
    with hist.open("a", encoding="utf-8") as fh:
        fh.write("{not json\n")
    ch.append({"t": "agent", "text": "also good"}, path=hist)
    entries = ch.read_entries(path=hist)
    assert [e["text"] for e in entries] == ["good", "also good"]


def test_cli_read_last(tmp_path: Path, monkeypatch, capsys):
    target = tmp_path / "read.jsonl"
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(target))
    ch.main(["init", "--first-user-msg", "x"])
    for i in range(4):
        ch.main(["append", "--type", "user", "--json", f'{{"text":"m{i}"}}'])
    capsys.readouterr()
    ch.main(["read", "--last", "2"])
    out = json.loads(capsys.readouterr().out)
    assert [e["text"] for e in out] == ["m2", "m3"]


def test_cli_read_all(tmp_path: Path, monkeypatch, capsys):
    target = tmp_path / "read.jsonl"
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(target))
    ch.main(["init", "--first-user-msg", "x"])
    for i in range(3):
        ch.main(["append", "--type", "user", "--json", f'{{"text":"m{i}"}}'])
    capsys.readouterr()
    ch.main(["read", "--all"])
    out = json.loads(capsys.readouterr().out)
    assert len(out) == 3


# --- Schema v2 --------------------------------------------------------


def test_schema_version_is_two():
    assert ch.SCHEMA_VERSION == 2


def test_init_writes_former_fps_empty(hist: Path):
    h = ch.init("msg", path=hist)
    assert h["former_fps"] == []
    assert h["v"] == 2


def test_read_header_migrates_v1_in_memory(hist: Path):
    # Craft a v1 header (no former_fps) directly
    v1 = {
        "t": "header", "v": 1, "session": "abc",
        "started": "2024-01-01T00:00:00+00:00",
        "fp": ch.fingerprint("old"),
        "preview": "old", "freq": "per_phase",
    }
    hist.write_text(json.dumps(v1) + "\n", encoding="utf-8")
    h = ch.read_header(hist)
    assert h is not None
    assert h["former_fps"] == []
    # On-disk file not rewritten by read
    raw = json.loads(hist.read_text(encoding="utf-8").splitlines()[0])
    assert "former_fps" not in raw


def test_ownership_state_match(hist: Path):
    ch.init("msg", path=hist)
    assert ch.ownership_state("msg", path=hist) == "match"


def test_ownership_state_missing(hist: Path):
    assert ch.ownership_state("x", path=hist) == "missing"


def test_ownership_state_foreign(hist: Path):
    ch.init("owner", path=hist)
    # Different fp, not in former_fps → foreign
    assert ch.ownership_state("stranger", path=hist) == "foreign"


def test_ownership_state_returning_after_adopt(hist: Path):
    ch.init("A", path=hist)
    ch.adopt("B", path=hist)
    # A's fp is now in former_fps, B owns → A returning, B matches
    assert ch.ownership_state("A", path=hist) == "returning"
    assert ch.ownership_state("B", path=hist) == "match"
    assert ch.ownership_state("C", path=hist) == "foreign"


def test_adopt_pushes_old_fp_with_dedup(hist: Path):
    ch.init("A", path=hist)
    ch.adopt("B", path=hist)
    ch.adopt("A", path=hist)  # Back to A — B goes into former_fps
    h = ch.read_header(hist)
    assert h is not None
    assert h["fp"] == ch.fingerprint("A")
    # A must NOT appear in former_fps (current owner excluded)
    assert ch.fingerprint("A") not in h["former_fps"]
    assert ch.fingerprint("B") in h["former_fps"]


def test_adopt_former_fps_caps_at_limit(hist: Path):
    ch.init("msg-0", path=hist)
    # Adopt 15 times → former_fps should cap at FORMER_FPS_CAP
    for i in range(1, 16):
        ch.adopt(f"msg-{i}", path=hist)
    h = ch.read_header(hist)
    assert h is not None
    assert len(h["former_fps"]) <= ch.FORMER_FPS_CAP
    # Most recent former owner is the previous one (msg-14)
    assert h["former_fps"][0] == ch.fingerprint("msg-14")


def test_adopt_bumps_schema_version_for_v1_file(hist: Path):
    v1 = {
        "t": "header", "v": 1, "session": "abc",
        "started": "2024-01-01T00:00:00+00:00",
        "fp": ch.fingerprint("old"), "preview": "old",
        "freq": "per_phase",
    }
    hist.write_text(json.dumps(v1) + "\n", encoding="utf-8")
    h = ch.adopt("new", path=hist)
    assert h["v"] == 2
    assert ch.fingerprint("old") in h["former_fps"]


def test_reset_with_entries_replaces_body(hist: Path):
    ch.init("owner", path=hist)
    ch.append({"t": "user", "text": "stale"}, path=hist)
    new_entries = [
        {"t": "user", "text": "fresh1"},
        {"t": "agent", "text": "fresh2"},
    ]
    h = ch.reset_with_entries("newchat", new_entries, freq="per_turn",
                              path=hist)
    assert h["fp"] == ch.fingerprint("newchat")
    assert h["freq"] == "per_turn"
    # Old owner's fp preserved in former_fps
    assert ch.fingerprint("owner") in h["former_fps"]
    entries = ch.read_entries(path=hist)
    assert [e["text"] for e in entries] == ["fresh1", "fresh2"]


def test_reset_with_entries_rejects_invalid_freq(hist: Path):
    ch.init("x", path=hist)
    with pytest.raises(ValueError):
        ch.reset_with_entries("y", [], freq="hourly", path=hist)


def test_reset_with_entries_rejects_header_entry(hist: Path):
    ch.init("x", path=hist)
    with pytest.raises(ValueError):
        ch.reset_with_entries("y", [{"t": "header"}], path=hist)


def test_reset_with_entries_on_missing_file_starts_fresh(hist: Path):
    h = ch.reset_with_entries("new", [{"t": "user", "text": "a"}],
                              path=hist)
    assert h["former_fps"] == []
    entries = ch.read_entries(path=hist)
    assert [e["text"] for e in entries] == ["a"]


def test_prepend_entries_inserts_before_body(hist: Path):
    ch.init("x", path=hist)
    ch.append({"t": "agent", "text": "existing1"}, path=hist)
    ch.append({"t": "agent", "text": "existing2"}, path=hist)
    n = ch.prepend_entries(
        [{"t": "user", "text": "older1"},
         {"t": "user", "text": "older2"}], path=hist,
    )
    assert n == 2
    entries = ch.read_entries(path=hist)
    assert [e["text"] for e in entries] == [
        "older1", "older2", "existing1", "existing2",
    ]
    # Header still valid
    h = ch.read_header(hist)
    assert h is not None and h["fp"] == ch.fingerprint("x")


def test_prepend_entries_on_missing_file_raises(hist: Path):
    with pytest.raises(FileNotFoundError):
        ch.prepend_entries([{"t": "user", "text": "x"}], path=hist)


def test_prepend_entries_rejects_invalid(hist: Path):
    ch.init("x", path=hist)
    with pytest.raises(ValueError):
        ch.prepend_entries([{"text": "no t"}], path=hist)


def test_cli_state_returns_one_of_four_states(tmp_path: Path,
                                              monkeypatch, capsys):
    target = tmp_path / "s.jsonl"
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(target))
    ch.main(["state", "--first-user-msg", "x"])
    assert capsys.readouterr().out.strip() == "missing"
    ch.main(["init", "--first-user-msg", "A"])
    capsys.readouterr()
    ch.main(["state", "--first-user-msg", "A"])
    assert capsys.readouterr().out.strip() == "match"
    ch.main(["state", "--first-user-msg", "B"])
    assert capsys.readouterr().out.strip() == "foreign"
    ch.main(["adopt", "--first-user-msg", "B"])
    capsys.readouterr()
    ch.main(["state", "--first-user-msg", "A"])
    assert capsys.readouterr().out.strip() == "returning"


def test_cli_reset_and_prepend(tmp_path: Path, monkeypatch, capsys):
    target = tmp_path / "r.jsonl"
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(target))
    ch.main(["init", "--first-user-msg", "orig", "--freq", "per_turn"])
    ch.main(["append", "--type", "agent", "--json", '{"text":"old"}'])
    capsys.readouterr()
    rc = ch.main([
        "reset", "--first-user-msg", "new", "--freq", "per_turn",
        "--entries-json",
        '[{"t":"user","text":"u1"},{"t":"agent","text":"a1"}]',
    ])
    assert rc == 0
    capsys.readouterr()
    rc = ch.main([
        "prepend", "--entries-json",
        '[{"t":"user","text":"earlier"}]',
    ])
    assert rc == 0
    out = json.loads(capsys.readouterr().out)
    assert out["prepended"] == 1
    entries = ch.read_entries(path=target)
    assert [e["text"] for e in entries] == ["earlier", "u1", "a1"]



# --- A: append-side ownership enforcement ----------------------------


def test_append_with_first_user_msg_match_writes(hist: Path):
    ch.init("orig msg", path=hist)
    ch.append({"t": "phase", "name": "ok"}, path=hist,
              first_user_msg="orig msg")
    entries = ch.read_entries(path=hist)
    assert [e.get("name") for e in entries] == ["ok"]


def test_append_with_first_user_msg_foreign_raises(hist: Path):
    ch.init("orig msg", path=hist)
    with pytest.raises(ch.OwnershipError) as excinfo:
        ch.append({"t": "phase", "name": "nope"}, path=hist,
                  first_user_msg="DIFFERENT")
    assert excinfo.value.state == "foreign"
    assert excinfo.value.header_fp == ch.fingerprint("orig msg")
    assert excinfo.value.current_fp == ch.fingerprint("DIFFERENT")
    # Entry must NOT have been written.
    assert ch.read_entries(path=hist) == []


def test_append_with_first_user_msg_returning_raises(hist: Path):
    ch.init("orig msg", path=hist)
    ch.adopt("new msg", path=hist)  # original fp now in former_fps
    with pytest.raises(ch.OwnershipError) as excinfo:
        ch.append({"t": "phase", "name": "still nope"}, path=hist,
                  first_user_msg="orig msg")
    assert excinfo.value.state == "returning"
    assert ch.read_entries(path=hist) == []


def test_append_with_first_user_msg_missing_raises(hist: Path):
    with pytest.raises(ch.OwnershipError) as excinfo:
        ch.append({"t": "phase", "name": "no header"}, path=hist,
                  first_user_msg="any")
    assert excinfo.value.state == "missing"


def test_append_without_first_user_msg_unchanged(hist: Path):
    """Back-compat: legacy callers without first_user_msg still pass."""
    ch.init("orig", path=hist)
    ch.append({"t": "phase", "name": "legacy"}, path=hist)
    assert [e.get("name") for e in ch.read_entries(path=hist)] == ["legacy"]


def test_cli_append_first_user_msg_match_exit_0(
    tmp_path: Path, monkeypatch, capsys,
):
    target = tmp_path / "cli.jsonl"
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(target))
    ch.main(["init", "--first-user-msg", "orig"])
    capsys.readouterr()
    rc = ch.main([
        "append", "--first-user-msg", "orig",
        "--type", "phase", "--json", '{"name":"ok"}',
    ])
    assert rc == ch.EXIT_OK


def test_cli_append_first_user_msg_foreign_exit_3(
    tmp_path: Path, monkeypatch, capsys,
):
    target = tmp_path / "cli.jsonl"
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(target))
    ch.main(["init", "--first-user-msg", "orig"])
    capsys.readouterr()
    rc = ch.main([
        "append", "--first-user-msg", "DIFFERENT",
        "--type", "phase", "--json", '{"name":"nope"}',
    ])
    assert rc == ch.EXIT_OWNERSHIP_REFUSED
    err = capsys.readouterr().err
    assert "state=foreign" in err
    assert "turn-check" in err
    # File still has only the header.
    assert ch.read_entries(path=target) == []


# --- B: turn-check ---------------------------------------------------


@pytest.fixture
def settings_enabled(tmp_path: Path) -> Path:
    p = tmp_path / "agent-settings.yml"
    p.write_text("chat_history:\n  enabled: true\n", encoding="utf-8")
    return p


@pytest.fixture
def settings_disabled(tmp_path: Path) -> Path:
    p = tmp_path / "agent-settings.yml"
    p.write_text("chat_history:\n  enabled: false\n", encoding="utf-8")
    return p


def test_turn_check_disabled_short_circuits(
    hist: Path, settings_disabled: Path,
):
    # Even with a foreign file present, disabled wins.
    ch.init("orig", path=hist)
    result = ch.turn_check("anything", path=hist,
                           settings_path=settings_disabled)
    assert result == {"state": "disabled", "exit": ch.EXIT_OK}


def test_turn_check_match(hist: Path, settings_enabled: Path):
    ch.init("orig", path=hist)
    ch.append({"t": "phase", "name": "x"}, path=hist)
    result = ch.turn_check("orig", path=hist,
                           settings_path=settings_enabled)
    assert result["state"] == "ok"
    assert result["exit"] == ch.EXIT_OK
    assert result["entries"] == 1


def test_turn_check_missing(tmp_path: Path, settings_enabled: Path):
    hist = tmp_path / "absent.jsonl"
    result = ch.turn_check("orig", path=hist,
                           settings_path=settings_enabled)
    assert result["state"] == "missing"
    assert result["exit"] == ch.EXIT_MISSING


def test_turn_check_foreign(hist: Path, settings_enabled: Path):
    ch.init("orig", path=hist)
    result = ch.turn_check("DIFFERENT", path=hist,
                           settings_path=settings_enabled)
    assert result["state"] == "foreign"
    assert result["exit"] == ch.EXIT_FOREIGN
    assert result["header_fp"] == ch.fingerprint("orig")
    assert result["current_fp"] == ch.fingerprint("DIFFERENT")


def test_turn_check_returning(hist: Path, settings_enabled: Path):
    ch.init("orig", path=hist)
    ch.adopt("new", path=hist)
    result = ch.turn_check("orig", path=hist,
                           settings_path=settings_enabled)
    assert result["state"] == "returning"
    assert result["exit"] == ch.EXIT_RETURNING


def test_turn_check_settings_missing_treated_as_disabled(
    tmp_path: Path, hist: Path,
):
    ch.init("orig", path=hist)
    result = ch.turn_check("orig", path=hist,
                           settings_path=tmp_path / "absent.yml")
    assert result["state"] == "disabled"


def test_turn_check_settings_no_chat_history_section_disabled(
    tmp_path: Path, hist: Path,
):
    ch.init("orig", path=hist)
    settings = tmp_path / "agent-settings.yml"
    settings.write_text("cost_profile: minimal\n", encoding="utf-8")
    result = ch.turn_check("orig", path=hist, settings_path=settings)
    assert result["state"] == "disabled"


def test_cli_turn_check_match_exit_0(
    tmp_path: Path, monkeypatch, capsys,
):
    target = tmp_path / "cli.jsonl"
    settings = tmp_path / "agent-settings.yml"
    settings.write_text("chat_history:\n  enabled: true\n", encoding="utf-8")
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(target))
    ch.main(["init", "--first-user-msg", "orig"])
    capsys.readouterr()
    rc = ch.main([
        "turn-check", "--first-user-msg", "orig",
        "--settings", str(settings),
    ])
    assert rc == ch.EXIT_OK
    out = capsys.readouterr()
    assert "state=ok" in out.out
    assert out.err == ""  # no ACTION-REQUIRED hint on match


def test_cli_turn_check_foreign_exit_11_with_hint(
    tmp_path: Path, monkeypatch, capsys,
):
    target = tmp_path / "cli.jsonl"
    settings = tmp_path / "agent-settings.yml"
    settings.write_text("chat_history:\n  enabled: true\n", encoding="utf-8")
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(target))
    ch.main(["init", "--first-user-msg", "orig"])
    capsys.readouterr()
    rc = ch.main([
        "turn-check", "--first-user-msg", "DIFFERENT",
        "--settings", str(settings),
    ])
    assert rc == ch.EXIT_FOREIGN
    captured = capsys.readouterr()
    assert "state=foreign" in captured.out
    assert "header_fp=" in captured.out
    assert "current_fp=" in captured.out
    assert "ACTION REQUIRED" in captured.err
    assert "Foreign-Prompt" in captured.err


def test_cli_turn_check_missing_exit_10(
    tmp_path: Path, monkeypatch, capsys,
):
    settings = tmp_path / "agent-settings.yml"
    settings.write_text("chat_history:\n  enabled: true\n", encoding="utf-8")
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE",
                       str(tmp_path / "absent.jsonl"))
    rc = ch.main([
        "turn-check", "--first-user-msg", "anything",
        "--settings", str(settings),
    ])
    assert rc == ch.EXIT_MISSING
    captured = capsys.readouterr()
    assert "state=missing" in captured.out
    assert "ACTION REQUIRED" in captured.err
    assert "init" in captured.err


def test_cli_turn_check_disabled_exit_0_no_hint(
    tmp_path: Path, monkeypatch, capsys,
):
    settings = tmp_path / "agent-settings.yml"
    settings.write_text("chat_history:\n  enabled: false\n", encoding="utf-8")
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE",
                       str(tmp_path / "absent.jsonl"))
    rc = ch.main([
        "turn-check", "--first-user-msg", "anything",
        "--settings", str(settings),
    ])
    assert rc == ch.EXIT_OK
    captured = capsys.readouterr()
    assert "state=disabled" in captured.out
    assert captured.err == ""


# --- C: heartbeat ----------------------------------------------------


def test_format_age_units():
    assert ch._format_age(0) == "0s ago"
    assert ch._format_age(45) == "45s ago"
    assert ch._format_age(60) == "1m ago"
    assert ch._format_age(3599) == "59m ago"
    assert ch._format_age(3600) == "1h ago"
    assert ch._format_age(86399) == "23h ago"
    assert ch._format_age(86400) == "1d ago"
    assert ch._format_age(-5) == "just now"


def test_last_entry_age_no_file(tmp_path: Path):
    assert ch._last_entry_age_seconds(tmp_path / "absent") is None


def test_last_entry_age_header_only(hist: Path):
    ch.init("msg", path=hist)
    assert ch._last_entry_age_seconds(hist) is None


def test_last_entry_age_recent(hist: Path):
    ch.init("msg", path=hist)
    ch.append({"t": "phase", "name": "x"}, path=hist)
    age = ch._last_entry_age_seconds(hist)
    assert age is not None
    assert 0 <= age <= 5


def test_heartbeat_disabled(hist: Path, settings_disabled: Path):
    ch.init("orig", path=hist)
    result = ch.heartbeat("anything", path=hist,
                          settings_path=settings_disabled)
    assert result["state"] == "disabled"
    assert result["marker"] == "📒 chat-history: disabled"


def test_heartbeat_match_no_entries(hist: Path, settings_enabled: Path):
    ch.init("orig", path=hist)
    result = ch.heartbeat("orig", path=hist,
                          settings_path=settings_enabled)
    assert result["state"] == "ok"
    assert result["entries"] == 0
    assert result["freq"] == "per_phase"
    assert result["last_age_seconds"] is None
    assert "ok" in result["marker"]
    assert "0 entries" in result["marker"]
    assert "no entries" in result["marker"]


def test_heartbeat_match_with_entries(hist: Path, settings_enabled: Path):
    ch.init("orig", path=hist)
    ch.append({"t": "phase", "name": "x"}, path=hist)
    ch.append({"t": "phase", "name": "y"}, path=hist)
    result = ch.heartbeat("orig", path=hist,
                          settings_path=settings_enabled)
    assert result["state"] == "ok"
    assert result["entries"] == 2
    assert result["last_age_seconds"] is not None
    assert result["last_age_seconds"] >= 0
    assert "2 entries" in result["marker"]
    assert "per_phase" in result["marker"]
    assert "last " in result["marker"]


def test_heartbeat_missing(tmp_path: Path, settings_enabled: Path):
    hist = tmp_path / "absent.jsonl"
    result = ch.heartbeat("orig", path=hist,
                          settings_path=settings_enabled)
    assert result["state"] == "missing"
    assert "missing" in result["marker"]


def test_heartbeat_foreign(hist: Path, settings_enabled: Path):
    ch.init("orig", path=hist)
    ch.append({"t": "phase", "name": "x"}, path=hist)
    result = ch.heartbeat("DIFFERENT", path=hist,
                          settings_path=settings_enabled)
    assert result["state"] == "foreign"
    assert result["entries"] == 1
    assert "foreign" in result["marker"]
    assert "Foreign-Prompt" in result["marker"]


def test_heartbeat_returning(hist: Path, settings_enabled: Path):
    ch.init("orig", path=hist)
    ch.append({"t": "phase", "name": "x"}, path=hist)
    ch.adopt("new", path=hist)
    result = ch.heartbeat("orig", path=hist,
                          settings_path=settings_enabled)
    assert result["state"] == "returning"
    assert result["entries"] == 1
    assert "returning" in result["marker"]
    assert "Returning-Prompt" in result["marker"]


def test_cli_heartbeat_match(
    hist: Path, settings_enabled: Path, monkeypatch, capsys,
):
    ch.init("orig", path=hist)
    ch.append({"t": "phase", "name": "x"}, path=hist)
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(hist))
    rc = ch.main([
        "heartbeat", "--first-user-msg", "orig",
        "--settings", str(settings_enabled),
    ])
    assert rc == ch.EXIT_OK
    captured = capsys.readouterr()
    assert captured.out.startswith("📒 chat-history: ok")
    assert "1 entries" in captured.out
    assert captured.err == ""


def test_cli_heartbeat_json_flag(
    hist: Path, settings_enabled: Path, monkeypatch, capsys,
):
    ch.init("orig", path=hist)
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(hist))
    rc = ch.main([
        "heartbeat", "--first-user-msg", "orig",
        "--settings", str(settings_enabled), "--json",
    ])
    assert rc == ch.EXIT_OK
    captured = capsys.readouterr()
    payload = json.loads(captured.out)
    assert payload["state"] == "ok"
    assert "marker" in payload


def test_cli_heartbeat_disabled(tmp_path: Path, monkeypatch, capsys):
    settings = tmp_path / "agent-settings.yml"
    settings.write_text("chat_history:\n  enabled: false\n", encoding="utf-8")
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE",
                       str(tmp_path / "absent.jsonl"))
    rc = ch.main([
        "heartbeat", "--first-user-msg", "anything",
        "--settings", str(settings),
    ])
    assert rc == ch.EXIT_OK
    captured = capsys.readouterr()
    assert "disabled" in captured.out

