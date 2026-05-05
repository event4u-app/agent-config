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
    assert ch.ownership_state("new msg", path=hist) == "match"


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


def test_schema_version_is_three():
    assert ch.SCHEMA_VERSION == 3


def test_init_writes_former_fps_empty(hist: Path):
    h = ch.init("msg", path=hist)
    assert h["former_fps"] == []
    assert h["v"] == 3


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
    assert h["v"] == 3
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


# --- sidecar-shrink Phase 1 — expected_fp= parity with first_user_msg --------


def test_ownership_state_for_fp_match(hist: Path):
    h = ch.init("hello", path=hist)
    assert ch.ownership_state_for_fp(h["fp"], path=hist) == "match"


def test_ownership_state_for_fp_missing(hist: Path):
    assert ch.ownership_state_for_fp("deadbeef", path=hist) == "missing"


def test_ownership_state_for_fp_foreign(hist: Path):
    ch.init("owner", path=hist)
    assert ch.ownership_state_for_fp(ch.fingerprint("intruder"),
                                     path=hist) == "foreign"


def test_ownership_state_for_fp_returning(hist: Path):
    ch.init("A", path=hist)
    ch.adopt("B", path=hist)
    assert ch.ownership_state_for_fp(ch.fingerprint("A"),
                                     path=hist) == "returning"


def test_ownership_state_delegates_to_for_fp(hist: Path):
    """`ownership_state(prompt)` and `ownership_state_for_fp(fingerprint(prompt))`
    must agree across all four states."""
    ch.init("orig", path=hist)
    ch.adopt("new-owner", path=hist)
    cases = ["new-owner", "orig", "stranger"]  # match / returning / foreign
    for prompt in cases:
        assert (
            ch.ownership_state(prompt, path=hist)
            == ch.ownership_state_for_fp(ch.fingerprint(prompt), path=hist)
        )


def test_append_with_expected_fp_match(hist: Path):
    h = ch.init("orig", path=hist)
    ch.append({"t": "phase", "name": "ok"}, path=hist, expected_fp=h["fp"])
    assert [e.get("name") for e in ch.read_entries(path=hist)] == ["ok"]


def test_append_with_expected_fp_foreign_raises(hist: Path):
    ch.init("orig", path=hist)
    intruder_fp = ch.fingerprint("intruder")
    with pytest.raises(ch.OwnershipError) as excinfo:
        ch.append({"t": "phase", "name": "nope"}, path=hist,
                  expected_fp=intruder_fp)
    assert excinfo.value.state == "foreign"
    assert excinfo.value.header_fp == ch.fingerprint("orig")
    assert excinfo.value.current_fp == intruder_fp
    assert ch.read_entries(path=hist) == []


def test_append_with_expected_fp_returning_raises(hist: Path):
    ch.init("orig", path=hist)
    ch.adopt("new-owner", path=hist)
    with pytest.raises(ch.OwnershipError) as excinfo:
        ch.append({"t": "phase", "name": "stale"}, path=hist,
                  expected_fp=ch.fingerprint("orig"))
    assert excinfo.value.state == "returning"
    assert ch.read_entries(path=hist) == []


def test_append_with_expected_fp_missing_raises(hist: Path):
    with pytest.raises(ch.OwnershipError) as excinfo:
        ch.append({"t": "phase", "name": "x"}, path=hist,
                  expected_fp="0" * 64)
    assert excinfo.value.state == "missing"


def test_append_parity_first_user_msg_vs_expected_fp(hist: Path):
    """Same accept/reject behaviour and same OwnershipError payload."""
    ch.init("owner", path=hist)
    fum = "intruder"
    fp = ch.fingerprint(fum)
    with pytest.raises(ch.OwnershipError) as via_msg:
        ch.append({"t": "phase", "name": "a"}, path=hist, first_user_msg=fum)
    with pytest.raises(ch.OwnershipError) as via_fp:
        ch.append({"t": "phase", "name": "a"}, path=hist, expected_fp=fp)
    assert via_msg.value.state == via_fp.value.state == "foreign"
    assert via_msg.value.header_fp == via_fp.value.header_fp
    assert via_msg.value.current_fp == via_fp.value.current_fp == fp


def test_append_rejects_both_first_user_msg_and_expected_fp(hist: Path):
    ch.init("orig", path=hist)
    with pytest.raises(ValueError, match="at most one"):
        ch.append({"t": "phase", "name": "x"}, path=hist,
                  first_user_msg="orig", expected_fp=ch.fingerprint("orig"))


# --- Phase 1 (schema v3) — session id helper + tagging -----------------------


def test_current_session_id_from_header(hist: Path):
    h = ch.init("hello", path=hist)
    assert ch._current_session_id(hist) == h["fp"][:16]


def test_current_session_id_falls_back_to_sidecar(hist: Path, tmp_path: Path):
    ch.write_sidecar("only-sidecar", path=hist)
    expected = ch.fingerprint("only-sidecar")[:16]
    assert ch._current_session_id(hist) == expected


def test_current_session_id_unknown_when_both_missing(tmp_path: Path):
    target = tmp_path / "missing.jsonl"
    assert ch._current_session_id(target) == ch.SESSION_ID_UNKNOWN


def test_current_session_id_unknown_on_malformed_header(hist: Path):
    hist.write_text("not-json\n", encoding="utf-8")
    assert ch._current_session_id(hist) == ch.SESSION_ID_UNKNOWN


def test_append_auto_stamps_session_from_header(hist: Path):
    h = ch.init("owner", path=hist)
    ch.append({"t": "phase", "name": "p1"}, path=hist)
    entries = ch.read_entries(path=hist)
    assert entries[-1]["s"] == h["fp"][:16]


def test_append_session_kwarg_wins_over_auto(hist: Path):
    ch.init("owner", path=hist)
    ch.append({"t": "phase", "name": "p1"}, path=hist, session="custom-id-xyz")
    assert ch.read_entries(path=hist)[-1]["s"] == "custom-id-xyz"


def test_append_preserves_pre_filled_s(hist: Path):
    ch.init("owner", path=hist)
    ch.append({"t": "phase", "name": "p1", "s": "pre-set-id"}, path=hist)
    assert ch.read_entries(path=hist)[-1]["s"] == "pre-set-id"


def test_append_kill_switch_skips_tag(hist: Path, monkeypatch):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_SESSION_TAG", "false")
    ch.init("owner", path=hist)
    ch.append({"t": "phase", "name": "p1"}, path=hist)
    assert "s" not in ch.read_entries(path=hist)[-1]


def test_append_unknown_session_when_no_header(hist: Path):
    """append() called against a file that has no header surfaces <unknown>."""
    # Create file with malformed first line (no header).
    hist.write_text("garbage\n", encoding="utf-8")
    ch.append({"t": "phase", "name": "p1"}, path=hist)
    assert ch.read_entries(path=hist)[-1]["s"] == ch.SESSION_ID_UNKNOWN


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


# --- Settings fixtures shared by hook-append + crash-recovery -------


@pytest.fixture
def settings_enabled(tmp_path: Path) -> Path:
    p = tmp_path / "agent-settings.yml"
    p.write_text(
        "chat_history:\n  enabled: true\n",
        encoding="utf-8",
    )
    return p


@pytest.fixture
def settings_disabled(tmp_path: Path) -> Path:
    p = tmp_path / "agent-settings.yml"
    p.write_text("chat_history:\n  enabled: false\n", encoding="utf-8")
    return p


# --- Phase 2: hook-append wrapper -----------------------------------


@pytest.fixture
def settings_per_tool(tmp_path: Path) -> Path:
    p = tmp_path / "settings-per-tool.yml"
    p.write_text(
        "chat_history:\n  enabled: true\n  frequency: per_tool\n",
        encoding="utf-8",
    )
    return p


@pytest.fixture
def settings_per_turn(tmp_path: Path) -> Path:
    p = tmp_path / "settings-per-turn.yml"
    p.write_text(
        "chat_history:\n  enabled: true\n  frequency: per_turn\n",
        encoding="utf-8",
    )
    return p


def test_sidecar_path_lives_next_to_history(hist: Path):
    sp = ch.sidecar_path(hist)
    assert sp.parent == hist.parent
    assert sp.name == hist.name + ".session"


def test_write_and_read_sidecar_roundtrip(hist: Path):
    payload = ch.write_sidecar("hello", path=hist)
    loaded = ch.read_sidecar(hist)
    assert loaded == payload
    assert loaded["fp"] == ch.fingerprint("hello")
    # v3 privacy-minimal shape: no raw prompt persisted on disk.
    assert "first_user_msg" not in loaded
    assert set(loaded.keys()) == {"fp", "started_at"}


def test_read_sidecar_missing_returns_none(hist: Path):
    assert ch.read_sidecar(hist) is None


def test_read_sidecar_malformed_returns_none(hist: Path):
    sp = ch.sidecar_path(hist)
    sp.write_text("{not json", encoding="utf-8")
    assert ch.read_sidecar(hist) is None


def test_hook_append_session_start_initializes(hist: Path,
                                               settings_enabled: Path):
    result = ch.hook_append("session_start",
                            first_user_msg="first",
                            path=hist,
                            settings_path=settings_enabled)
    assert result["action"] == "initialized"
    header = ch.read_header(hist)
    assert header is not None
    assert header["fp"] == ch.fingerprint("first")
    side = ch.read_sidecar(hist)
    assert side is not None
    assert side["fp"] == ch.fingerprint("first")
    assert "first_user_msg" not in side


def test_hook_append_session_start_existing_history(hist: Path,
                                                    settings_enabled: Path):
    ch.init("first", path=hist)
    result = ch.hook_append("session_start",
                            first_user_msg="first",
                            path=hist,
                            settings_path=settings_enabled)
    assert result["action"] == "sidecar_written"


def test_hook_append_disabled_short_circuits(hist: Path,
                                             settings_disabled: Path):
    result = ch.hook_append("user_prompt",
                            payload={"text": "x"},
                            path=hist,
                            settings_path=settings_disabled)
    assert result["action"] == "disabled"
    assert not hist.exists()


def test_hook_append_no_sidecar_returns_skipped(hist: Path,
                                                settings_enabled: Path):
    result = ch.hook_append("user_prompt",
                            payload={"text": "x"},
                            path=hist,
                            settings_path=settings_enabled)
    assert result["action"] == "skipped_no_sidecar"


def test_hook_append_per_phase_filters_tool_use(hist: Path,
                                                settings_enabled: Path):
    ch.hook_append("session_start", first_user_msg="m",
                   path=hist, settings_path=settings_enabled)
    result = ch.hook_append("tool_use",
                            payload={"tool": "bash"},
                            path=hist,
                            settings_path=settings_enabled)
    assert result["action"] == "skipped_cadence"
    assert result["frequency"] == "per_phase"


def test_hook_append_per_phase_appends_user_prompt(hist: Path,
                                                   settings_enabled: Path):
    ch.hook_append("session_start", first_user_msg="m",
                   path=hist, settings_path=settings_enabled)
    result = ch.hook_append("user_prompt",
                            payload={"text": "hi"},
                            path=hist,
                            settings_path=settings_enabled)
    assert result["action"] == "appended"
    entries = ch.read_entries(path=hist)
    assert len(entries) == 1
    assert entries[0]["t"] == "user"
    assert entries[0]["text"] == "hi"


def test_hook_append_per_tool_filters_user_prompt(
    hist: Path, settings_per_tool: Path,
):
    ch.hook_append("session_start", first_user_msg="m",
                   path=hist, settings_path=settings_per_tool)
    skip = ch.hook_append("user_prompt", payload={"text": "x"},
                          path=hist, settings_path=settings_per_tool)
    appended = ch.hook_append("tool_use", payload={"tool": "bash",
                                                   "text": "ls"},
                              path=hist, settings_path=settings_per_tool)
    assert skip["action"] == "skipped_cadence"
    assert appended["action"] == "appended"
    entries = ch.read_entries(path=hist)
    assert len(entries) == 1
    assert entries[0]["t"] == "tool"
    assert entries[0]["tool"] == "bash"


def test_hook_append_per_turn_appends_stop_only(
    hist: Path, settings_per_turn: Path,
):
    ch.hook_append("session_start", first_user_msg="m",
                   path=hist, settings_path=settings_per_turn)
    skip = ch.hook_append("user_prompt", payload={"text": "x"},
                          path=hist, settings_path=settings_per_turn)
    appended = ch.hook_append("stop", payload={"text": "done"},
                              path=hist, settings_path=settings_per_turn)
    assert skip["action"] == "skipped_cadence"
    assert appended["action"] == "appended"
    entries = ch.read_entries(path=hist)
    assert len(entries) == 1
    assert entries[0]["t"] == "agent"


def test_hook_append_session_end_is_noop(
    hist: Path, settings_enabled: Path,
):
    ch.hook_append("session_start", first_user_msg="m",
                   path=hist, settings_path=settings_enabled)
    before = len(ch.read_entries(path=hist))
    result = ch.hook_append("session_end", path=hist,
                            settings_path=settings_enabled)
    assert result["action"] == "session_end_noop"
    assert len(ch.read_entries(path=hist)) == before


def test_hook_append_invalid_event_raises():
    with pytest.raises(ValueError):
        ch.hook_append("bogus_event")


def test_hook_append_ownership_refused_after_fingerprint_change(
    hist: Path, settings_enabled: Path,
):
    ch.hook_append("session_start", first_user_msg="orig",
                   path=hist, settings_path=settings_enabled)
    # Simulate an outside actor overwriting the sidecar with a different fp.
    ch.write_sidecar("imposter", path=hist)
    result = ch.hook_append("user_prompt",
                            payload={"text": "x"},
                            path=hist,
                            settings_path=settings_enabled)
    assert result["action"] == "ownership_refused"
    assert result["state"] == "foreign"


def test_cli_hook_append_session_start_then_event(
    tmp_path: Path, monkeypatch, capsys, settings_enabled: Path,
):
    target = tmp_path / "cli-hook.jsonl"
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(target))
    rc = ch.main([
        "hook-append", "--event", "session_start",
        "--first-user-msg", "first",
        "--settings", str(settings_enabled),
    ])
    assert rc == ch.EXIT_OK
    out1 = json.loads(capsys.readouterr().out)
    assert out1["action"] == "initialized"
    rc = ch.main([
        "hook-append", "--event", "user_prompt",
        "--payload", '{"text":"hello"}',
        "--settings", str(settings_enabled),
    ])
    assert rc == ch.EXIT_OK
    out2 = json.loads(capsys.readouterr().out)
    assert out2["action"] == "appended"


def test_cli_hook_append_invalid_payload_returns_bad_args(
    tmp_path: Path, monkeypatch, capsys, settings_enabled: Path,
):
    target = tmp_path / "cli-hook.jsonl"
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(target))
    rc = ch.main([
        "hook-append", "--event", "user_prompt",
        "--payload", "{not-json}",
        "--settings", str(settings_enabled),
    ])
    assert rc == ch.EXIT_BAD_ARGS



# --- Phase 5: crash-recovery smoke tests -----------------------------
#
# These simulate the HOOK lifecycle when the agent process dies between
# the `session_start` hook and the matching `session_end` hook. The file
# must survive intact, all pre-crash entries must remain readable, and a
# fresh session must rebind via session_start auto-adopt and continue
# appending without corrupting the prior log.


def test_crash_recovery_preserves_pre_crash_entries(
    hist: Path, settings_enabled: Path,
):
    """Hooks fire session_start + N appends, the process dies (no
    session_end), and a fresh process can still read every pre-crash
    entry verbatim."""
    ch.hook_append("session_start", first_user_msg="resume me",
                   path=hist, settings_path=settings_enabled)
    ch.hook_append("user_prompt", payload={"text": "step 1"},
                   path=hist, settings_path=settings_enabled)
    ch.hook_append("user_prompt", payload={"text": "step 2"},
                   path=hist, settings_path=settings_enabled)
    ch.hook_append("user_prompt", payload={"text": "step 3"},
                   path=hist, settings_path=settings_enabled)

    # --- crash: no session_end ever runs ---

    # Fresh process boots, reads the file as-is.
    header = ch.read_header(hist)
    entries = ch.read_entries(path=hist)

    assert header is not None
    assert header["fp"] == ch.fingerprint("resume me")
    assert [e["text"] for e in entries] == ["step 1", "step 2", "step 3"]


def test_crash_recovery_same_user_resumes_after_crash(
    hist: Path, settings_enabled: Path,
):
    """Same first-user-msg after a crash → ownership_state returns
    `match` and the next hook append lands after the pre-crash tail."""
    ch.hook_append("session_start", first_user_msg="same prompt",
                   path=hist, settings_path=settings_enabled)
    ch.hook_append("user_prompt", payload={"text": "before crash"},
                   path=hist, settings_path=settings_enabled)

    # --- crash ---

    # Resume turn — fresh process inspects ownership state.
    assert ch.ownership_state("same prompt", path=hist) == "match"

    # Hook appends keep flowing; pre-crash entry is preserved.
    ch.hook_append("user_prompt", payload={"text": "after crash"},
                   path=hist, settings_path=settings_enabled)

    entries = ch.read_entries(path=hist)
    assert [e["text"] for e in entries] == ["before crash", "after crash"]


def test_crash_recovery_via_cli_round_trip(
    tmp_path: Path, monkeypatch, capsys, settings_enabled: Path,
):
    """End-to-end at the CLI surface: hook commands write entries,
    process 'dies' (we drop the in-process state), a new invocation
    sees the same file and can read every pre-crash entry."""
    target = tmp_path / "crash-recovery.jsonl"
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(target))

    # Process A: session_start + two appends.
    rc = ch.main([
        "hook-append", "--event", "session_start",
        "--first-user-msg", "crash-test",
        "--settings", str(settings_enabled),
    ])
    assert rc == ch.EXIT_OK
    capsys.readouterr()

    rc = ch.main([
        "hook-append", "--event", "user_prompt",
        "--payload", '{"text":"alpha"}',
        "--settings", str(settings_enabled),
    ])
    assert rc == ch.EXIT_OK
    capsys.readouterr()

    rc = ch.main([
        "hook-append", "--event", "user_prompt",
        "--payload", '{"text":"beta"}',
        "--settings", str(settings_enabled),
    ])
    assert rc == ch.EXIT_OK
    capsys.readouterr()

    # --- Process A dies. session_end never runs. ---

    # Process B: state subcommand on the same prompt + a fresh append.
    rc = ch.main(["state", "--first-user-msg", "crash-test"])
    assert rc == ch.EXIT_OK
    assert capsys.readouterr().out.strip() == "match"

    rc = ch.main([
        "hook-append", "--event", "user_prompt",
        "--payload", '{"text":"gamma"}',
        "--settings", str(settings_enabled),
    ])
    assert rc == ch.EXIT_OK
    capsys.readouterr()

    entries = ch.read_entries(path=target)
    assert [e["text"] for e in entries] == ["alpha", "beta", "gamma"]


# --- Phase 6: hook-only auto-adopt on session_start ------------------
#
# session_start against a foreign chat-history file silently rewrites
# the header (auto-adopts). Kill-switch via AGENT_CHAT_HISTORY_AUTO_ADOPT,
# and any disk error inside adopt() surfaces as adopt_failed without
# corrupting the file.


def test_hook_append_session_start_foreign_auto_adopts(
    hist: Path, settings_enabled: Path, monkeypatch,
):
    monkeypatch.delenv("AGENT_CHAT_HISTORY_AUTO_ADOPT", raising=False)
    ch.init("orig", path=hist)
    ch.append({"t": "user", "text": "x"}, path=hist, first_user_msg="orig")
    old_fp = ch.fingerprint("orig")

    result = ch.hook_append(
        "session_start", first_user_msg="newcomer",
        path=hist, settings_path=settings_enabled,
    )
    assert result["action"] == "adopted"
    assert result["fp"] == ch.fingerprint("newcomer")

    header = ch.read_header(hist)
    assert header["fp"] == ch.fingerprint("newcomer")
    # Most recent former owner is at index 0 (see _push_former_fp).
    assert header["former_fps"][0] == old_fp

    follow = ch.hook_append(
        "user_prompt", payload={"text": "second"},
        path=hist, settings_path=settings_enabled,
    )
    assert follow["action"] == "appended"


def test_hook_append_session_start_foreign_kill_switch(
    hist: Path, settings_enabled: Path, monkeypatch,
):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_AUTO_ADOPT", "false")
    ch.init("orig", path=hist)
    old_fp = ch.fingerprint("orig")

    result = ch.hook_append(
        "session_start", first_user_msg="newcomer",
        path=hist, settings_path=settings_enabled,
    )
    assert result["action"] == "ownership_refused"
    assert result["state"] == "foreign"

    header = ch.read_header(hist)
    assert header["fp"] == old_fp
    assert header.get("former_fps") == []


def test_hook_append_session_start_foreign_adopt_failed_on_oserror(
    hist: Path, settings_enabled: Path, monkeypatch,
):
    monkeypatch.delenv("AGENT_CHAT_HISTORY_AUTO_ADOPT", raising=False)
    ch.init("orig", path=hist)
    pre = hist.read_text(encoding="utf-8")
    old_fp = ch.fingerprint("orig")

    def boom(_first, *, path=None):
        raise OSError("disk full simulated")

    monkeypatch.setattr(ch, "adopt", boom)
    result = ch.hook_append(
        "session_start", first_user_msg="newcomer",
        path=hist, settings_path=settings_enabled,
    )
    assert result["action"] == "adopt_failed"
    assert "disk full" in result["reason"]

    assert hist.read_text(encoding="utf-8") == pre
    header = ch.read_header(hist)
    assert header["fp"] == old_fp


def test_hook_append_session_start_foreign_former_fps_overflow(
    hist: Path, settings_enabled: Path, monkeypatch,
):
    monkeypatch.delenv("AGENT_CHAT_HISTORY_AUTO_ADOPT", raising=False)
    ch.init("orig", path=hist)
    cap = ch.FORMER_FPS_CAP
    fillers = [ch.fingerprint(f"filler-{i}") for i in range(cap)]
    header = ch.read_header(hist)
    header["former_fps"] = list(fillers)
    lines = hist.read_text(encoding="utf-8").splitlines(keepends=True)
    lines[0] = json.dumps(header, ensure_ascii=False) + "\n"
    hist.write_text("".join(lines), encoding="utf-8")

    # _push_former_fp prepends old_fp and truncates the tail, so the
    # last filler (oldest in the input list) is the one that drops.
    oldest_dropped = fillers[-1]
    old_fp = ch.fingerprint("orig")

    result = ch.hook_append(
        "session_start", first_user_msg="newcomer",
        path=hist, settings_path=settings_enabled,
    )
    assert result["action"] == "adopted"

    header = ch.read_header(hist)
    assert len(header["former_fps"]) == cap
    assert oldest_dropped not in header["former_fps"]
    assert header["former_fps"][0] == old_fp


def test_hook_dispatch_augment_owner_switch_produces_append_stream(
    hist: Path, settings_enabled: Path, monkeypatch,
):
    """Augment platform: a fresh session_start after an owner switch
    auto-adopts the header so the next cadence-eligible event lands
    on disk instead of being silently dropped as ownership_refused."""
    monkeypatch.delenv("AGENT_CHAT_HISTORY_AUTO_ADOPT", raising=False)

    init_payload = json.dumps({
        "hook_event_name": "SessionStart",
        "prompt": "first owner",
    })
    r1 = ch.hook_dispatch(
        "augment", init_payload,
        path=hist, settings_path=settings_enabled,
    )
    assert r1["action"] == "initialized"

    switch_payload = json.dumps({
        "hook_event_name": "SessionStart",
        "prompt": "second owner",
    })
    r2 = ch.hook_dispatch(
        "augment", switch_payload,
        path=hist, settings_path=settings_enabled,
    )
    assert r2["action"] == "adopted"
    assert r2["fp"] == ch.fingerprint("second owner")

    stop_payload = json.dumps({"hook_event_name": "Stop"})
    r3 = ch.hook_dispatch(
        "augment", stop_payload,
        path=hist, settings_path=settings_enabled,
    )
    assert r3["action"] == "appended"

    entries = ch.read_entries(path=hist)
    assert len(entries) >= 1



def test_hook_dispatch_augment_session_start_falls_back_to_session_id(
    hist: Path, settings_per_turn: Path,
):
    """Augment SessionStart payloads do not carry the user prompt. When
    a session_id is present and no prompt-bearing field is, the
    dispatcher must synthesize a stable fum so the sidecar is written
    and subsequent Stop hooks can append per-turn entries."""
    init_payload = json.dumps({
        "hook_event_name": "SessionStart",
        "session_id": "augment-sess-001",
        "workspace_roots": ["/tmp/proj"],
    })
    r1 = ch.hook_dispatch(
        "augment", init_payload,
        path=hist, settings_path=settings_per_turn,
    )
    assert r1["action"] == "initialized"
    assert r1["fp"] == ch.fingerprint("<session:augment:augment-sess-001>")

    stop_payload = json.dumps({"hook_event_name": "Stop"})
    r2 = ch.hook_dispatch(
        "augment", stop_payload,
        path=hist, settings_path=settings_per_turn,
    )
    assert r2["action"] == "appended"

    entries = ch.read_entries(path=hist)
    assert len(entries) == 1
    assert entries[0]["t"] == "agent"


def test_hook_dispatch_augment_session_start_distinguishes_sessions(
    hist: Path, settings_per_turn: Path, monkeypatch,
):
    """Two different Augment session_ids must produce different
    fingerprints so auto-adopt can switch ownership cleanly."""
    monkeypatch.delenv("AGENT_CHAT_HISTORY_AUTO_ADOPT", raising=False)

    r1 = ch.hook_dispatch(
        "augment",
        json.dumps({
            "hook_event_name": "SessionStart",
            "session_id": "sess-A",
        }),
        path=hist, settings_path=settings_per_turn,
    )
    assert r1["action"] == "initialized"

    r2 = ch.hook_dispatch(
        "augment",
        json.dumps({
            "hook_event_name": "SessionStart",
            "session_id": "sess-B",
        }),
        path=hist, settings_path=settings_per_turn,
    )
    assert r2["action"] == "adopted"
    assert r2["fp"] != r1["fp"]


def test_hook_dispatch_augment_session_start_without_id_still_skips(
    hist: Path, settings_per_turn: Path,
):
    """Defensive: when neither prompt nor session_id is present, the
    current skip-then-bootstrap behavior is preserved (no silent
    initialization with a non-unique fum)."""
    payload = json.dumps({"hook_event_name": "SessionStart"})
    result = ch.hook_dispatch(
        "augment", payload,
        path=hist, settings_path=settings_per_turn,
    )
    assert result["action"] == "skipped_no_first_user_msg"
    assert not hist.exists()


# --- Phase 2 (schema v3) — hook write integration ---------------------------


def test_hook_append_fresh_session_tags_entries_with_header_fp(
    hist: Path, settings_enabled: Path,
):
    """All entries written in a single session carry the same s = header.fp[:16]."""
    ch.hook_append("session_start", first_user_msg="alice",
                   path=hist, settings_path=settings_enabled)
    ch.hook_append("user_prompt", payload={"text": "hi"},
                   path=hist, settings_path=settings_enabled)
    ch.hook_append("user_prompt", payload={"text": "again"},
                   path=hist, settings_path=settings_enabled)
    expected = ch.fingerprint("alice")[:16]
    entries = ch.read_entries(path=hist)
    assert len(entries) == 2
    assert all(e["s"] == expected for e in entries)


def test_hook_append_foreign_adopt_tags_new_entries_with_new_fp(
    hist: Path, settings_enabled: Path,
):
    """After auto-adopt: old entries keep their s; new entries carry new fp[:16]."""
    ch.hook_append("session_start", first_user_msg="alice",
                   path=hist, settings_path=settings_enabled)
    ch.hook_append("user_prompt", payload={"text": "from-alice"},
                   path=hist, settings_path=settings_enabled)
    alice_s = ch.fingerprint("alice")[:16]

    # Bob's session_start auto-adopts alice's file.
    result = ch.hook_append("session_start", first_user_msg="bob",
                            path=hist, settings_path=settings_enabled)
    assert result["action"] == "adopted"
    bob_s = ch.fingerprint("bob")[:16]

    ch.hook_append("user_prompt", payload={"text": "from-bob"},
                   path=hist, settings_path=settings_enabled)

    entries = ch.read_entries(path=hist)
    assert entries[0]["text"] == "from-alice"
    assert entries[0]["s"] == alice_s
    assert entries[1]["text"] == "from-bob"
    assert entries[1]["s"] == bob_s

    # Header rotation correctness: alice's fp lands in former_fps[].
    header = ch.read_header(hist)
    assert header["fp"] == ch.fingerprint("bob")
    assert ch.fingerprint("alice") in header["former_fps"]


def test_hook_append_returning_owner_tags_with_returning_fp(
    hist: Path, settings_enabled: Path,
):
    """alice → bob → adopt(alice): returning entries carry alice's fp[:16].

    Matches the documented semantics (test_append_with_first_user_msg_returning_raises):
    `returning` state requires an explicit `adopt()` — only `foreign` is
    auto-adopted via session_start. Once alice re-adopts, her hook-driven
    appends carry her fp[:16] and bob's fp lands in former_fps.
    """
    ch.hook_append("session_start", first_user_msg="alice",
                   path=hist, settings_path=settings_enabled)
    ch.hook_append("session_start", first_user_msg="bob",
                   path=hist, settings_path=settings_enabled)
    # Alice returns — explicit adopt rotates header back; sidecar follows.
    ch.adopt("alice", path=hist)
    ch.write_sidecar("alice", path=hist)
    ch.hook_append("user_prompt", payload={"text": "alice-back"},
                   path=hist, settings_path=settings_enabled)

    alice_s = ch.fingerprint("alice")[:16]
    last = ch.read_entries(path=hist)[-1]
    assert last["text"] == "alice-back"
    assert last["s"] == alice_s

    header = ch.read_header(hist)
    assert header["fp"] == ch.fingerprint("alice")
    assert ch.fingerprint("bob") in header["former_fps"]


def test_hook_append_sidecar_deleted_falls_back_to_header_fp(
    hist: Path, settings_enabled: Path,
):
    """Sidecar deleted mid-run → _current_session_id() falls back to header.fp[:16].

    Hook needs first_user_msg supplied directly (sidecar was the cache);
    once provided, append() still tags via header.fp — no <unknown> regression.
    """
    ch.hook_append("session_start", first_user_msg="alice",
                   path=hist, settings_path=settings_enabled)
    ch.hook_append("user_prompt", payload={"text": "before"},
                   path=hist, settings_path=settings_enabled)
    ch.sidecar_path(hist).unlink()

    # Without sidecar, hook needs first_user_msg passed in directly.
    result = ch.hook_append("user_prompt",
                            first_user_msg="alice",
                            payload={"text": "after"},
                            path=hist, settings_path=settings_enabled)
    assert result["action"] == "appended"

    expected = ch.fingerprint("alice")[:16]
    entries = ch.read_entries(path=hist)
    assert all(e["s"] == expected for e in entries)


def test_hook_append_both_deleted_returns_skipped_no_sidecar(
    hist: Path, settings_enabled: Path,
):
    """Both header and sidecar gone → hook surfaces skipped_no_sidecar, no crash.

    The append-time <unknown> stamping is reserved for direct append() calls
    against malformed files (covered by test_append_unknown_session_when_no_header
    in Phase 1); the hook flow has its own short-circuit before reaching append().
    """
    ch.hook_append("session_start", first_user_msg="alice",
                   path=hist, settings_path=settings_enabled)
    ch.sidecar_path(hist).unlink()
    hist.unlink()

    result = ch.hook_append("user_prompt", payload={"text": "after"},
                            path=hist, settings_path=settings_enabled)
    assert result["action"] == "skipped_no_sidecar"


# --- sidecar-shrink Phase 2 — hook write path uses sidecar.fp directly ------


def test_hook_append_uses_sidecar_fp_for_ownership(
    hist: Path, settings_enabled: Path, monkeypatch,
):
    """Non-session_start branch must use sidecar.fp directly — no
    fingerprint(first_user_msg) recompute on every event."""
    ch.hook_append("session_start", first_user_msg="alice",
                   path=hist, settings_path=settings_enabled)

    calls: list[str] = []
    real = ch.fingerprint

    def spy(msg: str) -> str:
        calls.append(msg)
        return real(msg)

    monkeypatch.setattr(ch, "fingerprint", spy)
    result = ch.hook_append("user_prompt", payload={"text": "hello"},
                            path=hist, settings_path=settings_enabled)
    assert result["action"] == "appended"
    # No fingerprint() call against the cached prompt — the sidecar's
    # fp is consumed verbatim. (CLI-style first_user_msg= would still
    # fingerprint, but no caller passes it on the per-event path.)
    assert calls == []


def test_hook_append_legacy_v2_sidecar_still_works(
    hist: Path, settings_enabled: Path,
):
    """A pre-shrink sidecar (with first_user_msg, no fp) must still drive
    appends — fp is recovered from the cached prompt as a one-shot
    fallback until the next session_start rewrites the sidecar."""
    ch.init("alice", path=hist)
    # Hand-craft a v2-shape sidecar (no fp key).
    ch.sidecar_path(hist).write_text(
        '{"first_user_msg": "alice", "started_at": "x"}',
        encoding="utf-8",
    )
    result = ch.hook_append("user_prompt", payload={"text": "hi"},
                            path=hist, settings_path=settings_enabled)
    assert result["action"] == "appended"
    assert [e.get("text") for e in ch.read_entries(path=hist)] == ["hi"]


def test_hook_append_corrupted_sidecar_no_fp_no_legacy_skips(
    hist: Path, settings_enabled: Path,
):
    """Sidecar present but missing both fp and first_user_msg → skip."""
    ch.init("alice", path=hist)
    ch.sidecar_path(hist).write_text(
        '{"started_at": "x"}', encoding="utf-8",
    )
    result = ch.hook_append("user_prompt", payload={"text": "hi"},
                            path=hist, settings_path=settings_enabled)
    assert result["action"] == "skipped_no_sidecar"


def test_hook_append_foreign_adopt_then_subsequent_event_uses_new_fp(
    hist: Path, settings_enabled: Path,
):
    """After session_start adopts a foreign file, the rewritten sidecar
    carries the new fp; the next event reads sidecar.fp and appends
    without re-deriving from a cached prompt."""
    ch.hook_append("session_start", first_user_msg="alice",
                   path=hist, settings_path=settings_enabled)
    # New owner adopts the file (rewrites both header and sidecar).
    ch.hook_append("session_start", first_user_msg="bob",
                   path=hist, settings_path=settings_enabled)
    side = ch.read_sidecar(hist)
    assert side and side.get("fp") == ch.fingerprint("bob")
    # Subsequent non-session_start event uses sidecar.fp.
    result = ch.hook_append("user_prompt", payload={"text": "after-adopt"},
                            path=hist, settings_path=settings_enabled)
    assert result["action"] == "appended"


# --- sidecar-shrink Phase 3 — write_sidecar payload shape -------------------


def test_write_sidecar_default_shape_no_first_user_msg(hist: Path):
    """Privacy regression test: written sidecar must contain no raw prompt."""
    payload = ch.write_sidecar("super secret prompt", path=hist)
    assert "first_user_msg" not in payload
    on_disk = json.loads(ch.sidecar_path(hist).read_text(encoding="utf-8"))
    assert "first_user_msg" not in on_disk
    assert set(on_disk.keys()) == {"fp", "started_at"}
    # Raw prompt must not be retrievable from disk by any obvious means.
    raw = ch.sidecar_path(hist).read_text(encoding="utf-8")
    assert "super secret prompt" not in raw


def test_write_sidecar_legacy_kill_switch_restores_v2_shape(
    hist: Path, monkeypatch,
):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_SIDECAR_LEGACY", "true")
    payload = ch.write_sidecar("hello", path=hist)
    assert payload["first_user_msg"] == "hello"
    assert payload["fp"] == ch.fingerprint("hello")
    on_disk = json.loads(ch.sidecar_path(hist).read_text(encoding="utf-8"))
    assert on_disk["first_user_msg"] == "hello"
    assert set(on_disk.keys()) == {"first_user_msg", "fp", "started_at"}


def test_write_sidecar_legacy_kill_switch_case_and_whitespace(
    hist: Path, monkeypatch,
):
    """Kill-switch parsing matches `_session_tag_enabled` style: trim + lower."""
    monkeypatch.setenv("AGENT_CHAT_HISTORY_SIDECAR_LEGACY", "  TRUE  ")
    payload = ch.write_sidecar("hi", path=hist)
    assert "first_user_msg" in payload


def test_legacy_v2_sidecar_remains_readable(hist: Path):
    """Existing v2-shape sidecars on disk stay readable; `read_sidecar`
    surfaces both `fp` and the redundant `first_user_msg` verbatim."""
    legacy = {
        "first_user_msg": "old prompt",
        "fp": ch.fingerprint("old prompt"),
        "started_at": "2026-01-01T00:00:00Z",
    }
    ch.sidecar_path(hist).write_text(
        json.dumps(legacy), encoding="utf-8",
    )
    loaded = ch.read_sidecar(hist)
    assert loaded == legacy


# --- Phase 3 (schema v3) — read path filtering -----------------------------


def test_read_entries_session_none_returns_everything(hist: Path):
    ch.init("alice", path=hist)
    ch.append({"t": "user", "text": "a"}, path=hist)
    ch.append({"t": "user", "text": "b", "s": "<legacy>"}, path=hist)
    ch.append({"t": "user", "text": "c", "s": "<unknown>"}, path=hist)
    out = ch.read_entries(path=hist, session=None)
    assert [e["text"] for e in out] == ["a", "b", "c"]


def test_read_entries_session_filters_exact_match(hist: Path):
    ch.init("alice", path=hist)
    ch.append({"t": "user", "text": "a"}, path=hist)
    ch.append({"t": "user", "text": "legacy", "s": "<legacy>"}, path=hist)
    ch.append({"t": "user", "text": "unknown", "s": "<unknown>"}, path=hist)
    alice_s = ch.fingerprint("alice")[:16]
    assert [e["text"] for e in ch.read_entries(path=hist, session=alice_s)] == ["a"]
    assert [e["text"] for e in ch.read_entries(path=hist, session="<legacy>")] == ["legacy"]
    assert [e["text"] for e in ch.read_entries(path=hist, session="<unknown>")] == ["unknown"]


def test_read_entries_session_filter_then_last_slice(hist: Path):
    ch.init("alice", path=hist)
    for i in range(5):
        ch.append({"t": "user", "text": f"a{i}"}, path=hist)
    ch.append({"t": "user", "text": "legacy-x", "s": "<legacy>"}, path=hist)
    alice_s = ch.fingerprint("alice")[:16]
    out = ch.read_entries(path=hist, last=2, session=alice_s)
    assert [e["text"] for e in out] == ["a3", "a4"]


def test_read_entries_for_current_uses_header_fp(hist: Path):
    ch.init("alice", path=hist)
    ch.append({"t": "user", "text": "mine"}, path=hist)
    ch.append({"t": "user", "text": "legacy", "s": "<legacy>"}, path=hist)
    out = ch.read_entries_for_current(path=hist)
    assert [e["text"] for e in out] == ["mine"]


def test_read_entries_for_current_kill_switch_returns_everything(
    hist: Path, monkeypatch,
):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_SESSION_FILTER", "false")
    ch.init("alice", path=hist)
    ch.append({"t": "user", "text": "mine"}, path=hist)
    ch.append({"t": "user", "text": "legacy", "s": "<legacy>"}, path=hist)
    out = ch.read_entries_for_current(path=hist)
    assert [e["text"] for e in out] == ["mine", "legacy"]


def test_read_entries_for_current_sidecar_missing_falls_back_to_header(
    hist: Path,
):
    ch.init("alice", path=hist)
    ch.append({"t": "user", "text": "mine"}, path=hist)
    ch.append({"t": "user", "text": "legacy", "s": "<legacy>"}, path=hist)
    # No sidecar was written by init() — current_session_id must derive from header.
    assert ch.read_sidecar(hist) is None
    out = ch.read_entries_for_current(path=hist)
    assert [e["text"] for e in out] == ["mine"]


def test_read_entries_for_current_both_missing_returns_unknown_only(
    hist: Path,
):
    # File exists but malformed → no header → _current_session_id() = <unknown>.
    hist.write_text(
        '{"t":"user","text":"orphan","s":"<unknown>"}\n'
        '{"t":"user","text":"alice","s":"abcdef0123456789"}\n',
        encoding="utf-8",
    )
    out = ch.read_entries_for_current(path=hist)
    assert [e["text"] for e in out] == ["orphan"]


def test_cli_read_default_filters_to_current_session(
    tmp_path: Path, monkeypatch, capsys,
):
    target = tmp_path / "read.jsonl"
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(target))
    ch.main(["init", "--first-user-msg", "alice"])
    ch.main(["append", "--type", "user", "--json", '{"text":"mine"}'])
    # Inject a foreign-session entry directly.
    with target.open("a", encoding="utf-8") as fh:
        fh.write('{"t":"user","text":"foreign","s":"deadbeefdeadbeef"}\n')
    capsys.readouterr()
    ch.main(["read", "--last", "10"])  # default → current session only
    out = json.loads(capsys.readouterr().out)
    assert [e["text"] for e in out] == ["mine"]


def test_cli_read_all_returns_every_session(
    tmp_path: Path, monkeypatch, capsys,
):
    target = tmp_path / "read.jsonl"
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(target))
    ch.main(["init", "--first-user-msg", "alice"])
    ch.main(["append", "--type", "user", "--json", '{"text":"mine"}'])
    with target.open("a", encoding="utf-8") as fh:
        fh.write('{"t":"user","text":"foreign","s":"deadbeefdeadbeef"}\n')
    capsys.readouterr()
    ch.main(["read", "--all"])
    out = json.loads(capsys.readouterr().out)
    assert [e["text"] for e in out] == ["mine", "foreign"]


def test_cli_read_explicit_session_filter(
    tmp_path: Path, monkeypatch, capsys,
):
    target = tmp_path / "read.jsonl"
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(target))
    ch.main(["init", "--first-user-msg", "alice"])
    ch.main(["append", "--type", "user", "--json", '{"text":"mine"}'])
    with target.open("a", encoding="utf-8") as fh:
        fh.write('{"t":"user","text":"legacy"}\n')
        fh.write('{"t":"user","text":"orphan","s":"<unknown>"}\n')
    capsys.readouterr()
    ch.main(["read", "--last", "10", "--session", "<unknown>"])
    out = json.loads(capsys.readouterr().out)
    assert [e["text"] for e in out] == ["orphan"]


def test_cli_read_kill_switch_overrides_default_filter(
    tmp_path: Path, monkeypatch, capsys,
):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_SESSION_FILTER", "false")
    target = tmp_path / "read.jsonl"
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(target))
    ch.main(["init", "--first-user-msg", "alice"])
    ch.main(["append", "--type", "user", "--json", '{"text":"mine"}'])
    with target.open("a", encoding="utf-8") as fh:
        fh.write('{"t":"user","text":"foreign","s":"deadbeefdeadbeef"}\n')
    capsys.readouterr()
    ch.main(["read", "--last", "10"])  # default but kill-switch active
    out = json.loads(capsys.readouterr().out)
    assert [e["text"] for e in out] == ["mine", "foreign"]


def test_read_entries_for_current_10k_under_100ms(hist: Path):
    """Council R9 — flagged but acceptable: 10k entries < 100 ms with filter."""
    import time

    ch.init("alice", path=hist)
    alice_s = ch.fingerprint("alice")[:16]
    with hist.open("a", encoding="utf-8") as fh:
        for i in range(10_000):
            fh.write(json.dumps({
                "t": "user", "text": f"m{i}",
                "s": alice_s if i % 2 == 0 else "deadbeefdeadbeef",
            }) + "\n")
    start = time.perf_counter()
    out = ch.read_entries_for_current(path=hist)
    elapsed_ms = (time.perf_counter() - start) * 1000
    assert len(out) == 5_000
    assert elapsed_ms < 100, f"filter took {elapsed_ms:.1f} ms (>=100)"



# --- Phase 4 (schema v3) — session listing ---------------------------------


def test_list_sessions_empty_file_returns_empty(hist: Path):
    assert ch.list_sessions(path=hist) == []


def test_list_sessions_single_session_one_bucket(hist: Path):
    ch.init("alice", path=hist)
    ch.append({"t": "user", "text": "hello"}, path=hist)
    ch.append({"t": "phase", "name": "design"}, path=hist)
    out = ch.list_sessions(path=hist)
    alice_s = ch.fingerprint("alice")[:16]
    assert len(out) == 1
    assert out[0]["id"] == alice_s
    assert out[0]["count"] == 2
    assert out[0]["preview"] == "hello"
    assert out[0]["first_ts"] is not None
    assert out[0]["last_ts"] is not None


def test_list_sessions_two_sessions_after_adopt(hist: Path):
    ch.init("alice", path=hist)
    ch.append({"t": "user", "text": "alice msg"}, path=hist)
    ch.adopt("bob", path=hist)
    ch.append({"t": "user", "text": "bob msg"}, path=hist)
    out = ch.list_sessions(path=hist)
    alice_s = ch.fingerprint("alice")[:16]
    bob_s = ch.fingerprint("bob")[:16]
    ids = {b["id"] for b in out}
    assert alice_s in ids
    assert bob_s in ids


def test_list_sessions_legacy_bucket_for_untagged_entries(hist: Path):
    ch.init("alice", path=hist)
    ch.append({"t": "user", "text": "tagged"}, path=hist)
    # Inject untagged legacy entry directly.
    with hist.open("a", encoding="utf-8") as fh:
        fh.write('{"t":"user","text":"old","ts":"2025-01-01T00:00:00+00:00"}\n')
    out = ch.list_sessions(path=hist)
    ids = {b["id"]: b for b in out}
    assert ch.SESSION_ID_LEGACY in ids
    assert ids[ch.SESSION_ID_LEGACY]["count"] == 1
    assert ids[ch.SESSION_ID_LEGACY]["preview"] == "old"


def test_list_sessions_unknown_bucket(hist: Path):
    ch.init("alice", path=hist)
    with hist.open("a", encoding="utf-8") as fh:
        fh.write('{"t":"user","text":"orphan","s":"<unknown>",'
                 '"ts":"2025-01-01T00:00:00+00:00"}\n')
    out = ch.list_sessions(path=hist)
    ids = {b["id"]: b for b in out}
    assert ch.SESSION_ID_UNKNOWN in ids
    assert ids[ch.SESSION_ID_UNKNOWN]["count"] == 1


def test_list_sessions_former_fps_empty_bucket_when_no_body(hist: Path):
    """Council R2-4: header.former_fps[] surfaces even without body entries."""
    ch.init("alice", path=hist)
    ch.adopt("bob", path=hist)
    # No appends after adopt → alice has no body entries; only header tracks her.
    out = ch.list_sessions(path=hist)
    alice_s = ch.fingerprint("alice")[:16]
    bob_s = ch.fingerprint("bob")[:16]
    by_id = {b["id"]: b for b in out}
    assert alice_s in by_id
    assert by_id[alice_s]["count"] == 0  # empty bucket from former_fps[]
    assert bob_s in by_id


def test_list_sessions_sort_by_last_ts_desc(hist: Path):
    ch.init("alice", path=hist)
    with hist.open("a", encoding="utf-8") as fh:
        fh.write('{"t":"user","text":"old","s":"aaaaaaaaaaaaaaaa",'
                 '"ts":"2024-01-01T00:00:00+00:00"}\n')
        fh.write('{"t":"user","text":"new","s":"bbbbbbbbbbbbbbbb",'
                 '"ts":"2026-01-01T00:00:00+00:00"}\n')
    out = ch.list_sessions(path=hist)
    non_empty = [b for b in out if b["count"] > 0]
    # newest first
    assert non_empty[0]["id"] == "bbbbbbbbbbbbbbbb"
    # alice header bucket may have count=0 (empty) and goes after non-empty ones
    empty = [b for b in out if b["count"] == 0]
    if empty:
        assert empty[0]["id"] == ch.fingerprint("alice")[:16]


def test_list_sessions_10k_under_200ms(hist: Path):
    """Council R2-3: O(n) over body entries — same trade-off as read_entries."""
    import time

    ch.init("alice", path=hist)
    alice_s = ch.fingerprint("alice")[:16]
    with hist.open("a", encoding="utf-8") as fh:
        for i in range(10_000):
            fh.write(json.dumps({
                "t": "user", "text": f"m{i}",
                "s": alice_s if i % 2 == 0 else "deadbeefdeadbeef",
                "ts": f"2026-01-{(i % 28) + 1:02d}T00:00:00+00:00",
            }) + "\n")
    start = time.perf_counter()
    out = ch.list_sessions(path=hist)
    elapsed_ms = (time.perf_counter() - start) * 1000
    counts = {b["id"]: b["count"] for b in out}
    assert counts.get(alice_s) == 5_000
    assert counts.get("deadbeefdeadbeef") == 5_000
    assert elapsed_ms < 200, f"list took {elapsed_ms:.1f} ms (>=200)"


def test_cli_sessions_default_excludes_empty(
    tmp_path: Path, monkeypatch, capsys,
):
    target = tmp_path / "h.jsonl"
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(target))
    ch.main(["init", "--first-user-msg", "alice"])
    ch.main(["adopt", "--first-user-msg", "bob"])  # creates empty alice bucket
    ch.main(["append", "--type", "user", "--json", '{"text":"bob says hi"}'])
    capsys.readouterr()
    ch.main(["sessions", "--json"])
    out = json.loads(capsys.readouterr().out)
    bob_s = ch.fingerprint("bob")[:16]
    assert all(b["count"] > 0 for b in out)
    assert any(b["id"] == bob_s for b in out)


def test_cli_sessions_include_empty_shows_former_fps(
    tmp_path: Path, monkeypatch, capsys,
):
    target = tmp_path / "h.jsonl"
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(target))
    ch.main(["init", "--first-user-msg", "alice"])
    ch.main(["adopt", "--first-user-msg", "bob"])
    capsys.readouterr()
    ch.main(["sessions", "--include-empty", "--json"])
    out = json.loads(capsys.readouterr().out)
    alice_s = ch.fingerprint("alice")[:16]
    assert any(b["id"] == alice_s and b["count"] == 0 for b in out)


def test_cli_sessions_limit_truncates(
    tmp_path: Path, monkeypatch, capsys,
):
    target = tmp_path / "h.jsonl"
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(target))
    ch.main(["init", "--first-user-msg", "alice"])
    # Inject 5 distinct sessions in body.
    with target.open("a", encoding="utf-8") as fh:
        for i in range(5):
            fh.write(json.dumps({
                "t": "user", "text": f"m{i}",
                "s": f"sess{i:012d}",
                "ts": f"2026-01-{i + 1:02d}T00:00:00+00:00",
            }) + "\n")
    capsys.readouterr()
    ch.main(["sessions", "--limit", "2", "--json"])
    out = json.loads(capsys.readouterr().out)
    assert len(out) == 2
    # newest first
    assert out[0]["id"] == "sess000000000004"
    assert out[1]["id"] == "sess000000000003"


def test_cli_sessions_table_renders_header(
    tmp_path: Path, monkeypatch, capsys,
):
    target = tmp_path / "h.jsonl"
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(target))
    ch.main(["init", "--first-user-msg", "alice"])
    ch.main(["append", "--type", "user", "--json", '{"text":"hi"}'])
    capsys.readouterr()
    ch.main(["sessions"])
    out = capsys.readouterr().out
    assert "ID" in out
    assert "COUNT" in out
    assert "PREVIEW" in out
    assert "hi" in out


def test_cli_sessions_empty_file_prints_no_sessions(
    tmp_path: Path, monkeypatch, capsys,
):
    target = tmp_path / "h.jsonl"
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(target))
    capsys.readouterr()
    ch.main(["sessions"])
    out = capsys.readouterr().out
    assert "(no sessions)" in out
