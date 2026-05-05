"""Tests for scripts/chat_history.py — v4 stateless multi-session JSONL log."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import chat_history as ch  # noqa: E402


# ---------------------------------------------------------------------------
# fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def hist(tmp_path: Path) -> Path:
    return tmp_path / "chat-history.jsonl"


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


@pytest.fixture
def settings_per_turn(tmp_path: Path) -> Path:
    p = tmp_path / "settings-per-turn.yml"
    p.write_text(
        "chat_history:\n  enabled: true\n  frequency: per_turn\n",
        encoding="utf-8",
    )
    return p


@pytest.fixture
def settings_per_tool(tmp_path: Path) -> Path:
    p = tmp_path / "settings-per-tool.yml"
    p.write_text(
        "chat_history:\n  enabled: true\n  frequency: per_tool\n",
        encoding="utf-8",
    )
    return p


# ---------------------------------------------------------------------------
# fingerprint / derive_session_tag
# ---------------------------------------------------------------------------


def test_fingerprint_is_stable_and_sha256():
    fp = ch.fingerprint("Hello world")
    assert len(fp) == 64
    assert all(c in "0123456789abcdef" for c in fp)
    assert fp == ch.fingerprint("Hello world")


def test_fingerprint_normalizes_whitespace():
    assert ch.fingerprint("a  b") == ch.fingerprint("a\tb")
    assert ch.fingerprint("a b") == ch.fingerprint("  a b  ")
    assert ch.fingerprint("a b") == ch.fingerprint("a\nb")


def test_fingerprint_distinguishes_content():
    assert ch.fingerprint("foo") != ch.fingerprint("bar")


def test_derive_session_tag_is_deterministic():
    assert ch.derive_session_tag("sess-1") == ch.derive_session_tag("sess-1")


def test_derive_session_tag_length_is_16_hex():
    tag = ch.derive_session_tag("anything")
    assert len(tag) == ch.SESSION_ID_LEN == 16
    assert all(c in "0123456789abcdef" for c in tag)


def test_derive_session_tag_distinguishes_inputs():
    assert ch.derive_session_tag("a") != ch.derive_session_tag("b")


def test_derive_session_tag_empty_returns_unknown():
    assert ch.derive_session_tag("") == ch.SESSION_ID_UNKNOWN


# ---------------------------------------------------------------------------
# init / header / status
# ---------------------------------------------------------------------------


def test_schema_version_is_four():
    assert ch.SCHEMA_VERSION == 4


def test_init_writes_v4_header_only(hist: Path):
    header = ch.init(freq="per_phase", path=hist)
    assert header == {"t": "header", "v": 4, "started": header["started"],
                      "freq": "per_phase"}
    assert set(header.keys()) == {"t", "v", "started", "freq"}
    lines = hist.read_text(encoding="utf-8").splitlines()
    assert len(lines) == 1
    assert json.loads(lines[0]) == header


def test_init_rejects_invalid_freq(hist: Path):
    with pytest.raises(ValueError):
        ch.init(freq="hourly", path=hist)


def test_init_default_freq_is_per_phase(hist: Path):
    header = ch.init(path=hist)
    assert header["freq"] == "per_phase"


def test_read_header_missing_returns_none(hist: Path):
    assert ch.read_header(hist) is None


def test_read_header_empty_file_returns_none(hist: Path):
    hist.write_text("", encoding="utf-8")
    assert ch.read_header(hist) is None


def test_read_header_malformed_returns_none(hist: Path):
    hist.write_text("{not json\n", encoding="utf-8")
    assert ch.read_header(hist) is None



# ---------------------------------------------------------------------------
# append / prepend / reset_with_entries / clear
# ---------------------------------------------------------------------------


def test_append_writes_entry_with_ts_and_session_unknown(hist: Path):
    ch.init(path=hist)
    ch.append({"t": "user", "text": "hi"}, path=hist)
    entries = ch.read_entries(path=hist)
    assert len(entries) == 1
    e = entries[0]
    assert e["t"] == "user"
    assert e["text"] == "hi"
    assert "ts" in e and isinstance(e["ts"], str)
    # No session was passed and file was empty -> defaults to <unknown>.
    assert e["s"] == ch.SESSION_ID_UNKNOWN


def test_append_explicit_session_wins(hist: Path):
    ch.init(path=hist)
    tag = ch.derive_session_tag("sess-A")
    ch.append({"t": "user", "text": "x"}, path=hist, session=tag)
    assert ch.read_entries(path=hist)[0]["s"] == tag


def test_append_preserves_pre_filled_s(hist: Path):
    ch.init(path=hist)
    ch.append({"t": "agent", "text": "y", "s": "abc123"}, path=hist)
    assert ch.read_entries(path=hist)[0]["s"] == "abc123"


def test_append_inherits_last_body_session_when_no_session(hist: Path):
    ch.init(path=hist)
    tag = ch.derive_session_tag("sess-A")
    ch.append({"t": "user", "text": "first"}, path=hist, session=tag)
    ch.append({"t": "agent", "text": "follow"}, path=hist)
    entries = ch.read_entries(path=hist)
    assert entries[0]["s"] == tag
    assert entries[1]["s"] == tag


def test_append_rejects_header(hist: Path):
    ch.init(path=hist)
    with pytest.raises(ValueError):
        ch.append({"t": "header"}, path=hist)


def test_append_rejects_missing_t(hist: Path):
    ch.init(path=hist)
    with pytest.raises(ValueError):
        ch.append({"text": "no type"}, path=hist)


def test_append_rejects_non_dict(hist: Path):
    ch.init(path=hist)
    with pytest.raises(ValueError):
        ch.append("not a dict", path=hist)  # type: ignore[arg-type]


def test_reset_with_entries_replaces_body(hist: Path):
    ch.init(path=hist)
    ch.append({"t": "user", "text": "old"}, path=hist)
    header = ch.reset_with_entries(
        [{"t": "user", "text": "new1"}, {"t": "agent", "text": "new2"}],
        path=hist,
    )
    assert header["v"] == 4
    assert header["freq"] == "per_phase"
    entries = ch.read_entries(path=hist)
    assert [e["text"] for e in entries] == ["new1", "new2"]


def test_reset_with_entries_rejects_header_in_payload(hist: Path):
    with pytest.raises(ValueError):
        ch.reset_with_entries([{"t": "header"}], path=hist)


def test_reset_with_entries_rejects_invalid_freq(hist: Path):
    with pytest.raises(ValueError):
        ch.reset_with_entries([], freq="hourly", path=hist)


def test_prepend_entries_inserts_after_header(hist: Path):
    ch.init(path=hist)
    ch.append({"t": "user", "text": "second"}, path=hist)
    n = ch.prepend_entries([{"t": "user", "text": "first"}], path=hist)
    assert n == 1
    entries = ch.read_entries(path=hist)
    assert [e["text"] for e in entries] == ["first", "second"]


def test_prepend_entries_missing_file_raises(hist: Path):
    with pytest.raises(FileNotFoundError):
        ch.prepend_entries([{"t": "user", "text": "x"}], path=hist)


def test_clear_removes_file(hist: Path):
    ch.init(path=hist)
    assert hist.is_file()
    ch.clear(path=hist)
    assert not hist.is_file()


def test_clear_missing_file_is_noop(hist: Path):
    ch.clear(path=hist)  # must not raise


# ---------------------------------------------------------------------------
# status
# ---------------------------------------------------------------------------


def test_status_missing_file(hist: Path):
    s = ch.status(path=hist)
    assert s == {"exists": False, "path": str(hist)}


def test_status_after_init_and_append(hist: Path):
    ch.init(path=hist)
    ch.append({"t": "user", "text": "hi"}, path=hist)
    s = ch.status(path=hist)
    assert s["exists"] is True
    assert s["path"] == str(hist)
    assert s["entries"] == 1
    assert s["header"]["v"] == 4
    assert s["size_bytes"] > 0



# ---------------------------------------------------------------------------
# read_entries / read_entries_for_current
# ---------------------------------------------------------------------------


def _seed_two_sessions(hist: Path) -> tuple[str, str]:
    """Init the file and append a/b/c on session A then x/y on session B."""
    ch.init(path=hist)
    a = ch.derive_session_tag("sess-A")
    b = ch.derive_session_tag("sess-B")
    ch.append({"t": "user", "text": "a"}, path=hist, session=a)
    ch.append({"t": "agent", "text": "b"}, path=hist, session=a)
    ch.append({"t": "tool", "text": "c"}, path=hist, session=a)
    ch.append({"t": "user", "text": "x"}, path=hist, session=b)
    ch.append({"t": "agent", "text": "y"}, path=hist, session=b)
    return a, b


def test_read_entries_skips_header(hist: Path):
    ch.init(path=hist)
    ch.append({"t": "user", "text": "hi"}, path=hist)
    out = ch.read_entries(path=hist)
    assert len(out) == 1
    assert out[0]["t"] == "user"


def test_read_entries_session_filter(hist: Path):
    a, b = _seed_two_sessions(hist)
    only_a = ch.read_entries(path=hist, session=a)
    only_b = ch.read_entries(path=hist, session=b)
    assert [e["text"] for e in only_a] == ["a", "b", "c"]
    assert [e["text"] for e in only_b] == ["x", "y"]


def test_read_entries_session_no_match_returns_empty(hist: Path):
    _seed_two_sessions(hist)
    assert ch.read_entries(path=hist, session="0" * 16) == []


def test_read_entries_last_after_session_filter(hist: Path):
    a, _b = _seed_two_sessions(hist)
    out = ch.read_entries(last=2, path=hist, session=a)
    assert [e["text"] for e in out] == ["b", "c"]


def test_read_entries_last_without_filter_takes_trailing(hist: Path):
    _seed_two_sessions(hist)
    out = ch.read_entries(last=2, path=hist)
    assert [e["text"] for e in out] == ["x", "y"]


def test_read_entries_skips_malformed_lines(hist: Path):
    ch.init(path=hist)
    ch.append({"t": "user", "text": "ok"}, path=hist)
    with hist.open("a", encoding="utf-8") as fh:
        fh.write("{not json\n")
    out = ch.read_entries(path=hist)
    assert len(out) == 1


def test_read_entries_for_current_only_returns_last_session(hist: Path):
    _a, b = _seed_two_sessions(hist)
    out = ch.read_entries_for_current(path=hist)
    assert all(e["s"] == b for e in out)
    assert [e["text"] for e in out] == ["x", "y"]


def test_read_entries_for_current_kill_switch_returns_all(
    hist: Path, monkeypatch: pytest.MonkeyPatch,
):
    _seed_two_sessions(hist)
    monkeypatch.setenv("AGENT_CHAT_HISTORY_SESSION_FILTER", "false")
    out = ch.read_entries_for_current(path=hist)
    assert [e["text"] for e in out] == ["a", "b", "c", "x", "y"]


def test_read_entries_for_current_last_slice(hist: Path):
    _seed_two_sessions(hist)
    out = ch.read_entries_for_current(path=hist, last=1)
    assert [e["text"] for e in out] == ["y"]


# ---------------------------------------------------------------------------
# list_sessions
# ---------------------------------------------------------------------------


def test_list_sessions_buckets_by_s(hist: Path):
    a, b = _seed_two_sessions(hist)
    sessions = ch.list_sessions(path=hist)
    by_id = {s["id"]: s for s in sessions}
    assert set(by_id.keys()) == {a, b}
    assert by_id[a]["count"] == 3
    assert by_id[b]["count"] == 2


def test_list_sessions_preview_prefers_user(hist: Path):
    ch.init(path=hist)
    tag = ch.derive_session_tag("sess-A")
    ch.append({"t": "agent", "text": "agent first"}, path=hist, session=tag)
    ch.append({"t": "user", "text": "user later"}, path=hist, session=tag)
    sessions = ch.list_sessions(path=hist)
    assert len(sessions) == 1
    assert sessions[0]["preview"] == "user later"


def test_list_sessions_order_by_last_ts_desc(hist: Path):
    # Use explicit ts so the order is deterministic — wall-clock appends
    # within one test tick share a second-resolution timestamp.
    ch.init(path=hist)
    a = ch.derive_session_tag("sess-A")
    b = ch.derive_session_tag("sess-B")
    ch.append({"t": "user", "text": "a", "ts": "2024-01-01T00:00:00+00:00"},
              path=hist, session=a)
    ch.append({"t": "user", "text": "b", "ts": "2024-01-02T00:00:00+00:00"},
              path=hist, session=b)
    sessions = ch.list_sessions(path=hist)
    assert sessions[0]["id"] == b
    assert sessions[-1]["id"] == a


def test_list_sessions_missing_file(hist: Path):
    assert ch.list_sessions(path=hist) == []


def test_list_sessions_legacy_bucket_for_missing_s(hist: Path):
    ch.init(path=hist)
    # Append a body line without an `s` field by writing raw — simulates
    # a v2 line that survived a partial migration.
    with hist.open("a", encoding="utf-8") as fh:
        fh.write(json.dumps({"t": "user", "text": "old", "ts": "2024-01-01T00:00:00+00:00"}) + "\n")
    sessions = ch.list_sessions(path=hist)
    assert len(sessions) == 1
    assert sessions[0]["id"] == ch.SESSION_ID_LEGACY


# ---------------------------------------------------------------------------
# _apply_text_limit / _read_text_limits
# ---------------------------------------------------------------------------


def test_default_text_limits_are_user0_agent5000_tool200_phase200():
    assert ch.DEFAULT_TEXT_LIMITS == {
        "user": 0, "agent": 5000, "tool": 200, "phase": 200,
    }


def test_apply_text_limit_zero_returns_verbatim():
    text = "line one\n  line two\t  trailing"
    out = ch._apply_text_limit(text, "user", {"user": 0})
    assert out == text


def test_apply_text_limit_truncates_with_suffix():
    text = "abcdefghij"  # 10 chars
    out = ch._apply_text_limit(text, "tool", {"tool": 4})
    assert out == "abcd … [+6 chars]"


def test_apply_text_limit_collapses_whitespace_when_truncating():
    text = "aa  bb\tcc\ndd"  # collapses to "aa bb cc dd" (11 chars)
    out = ch._apply_text_limit(text, "tool", {"tool": 5})
    assert out.startswith("aa bb")
    assert out.endswith(" chars]")


def test_apply_text_limit_no_truncation_when_below_cap():
    out = ch._apply_text_limit("short", "tool", {"tool": 100})
    assert out == "short"


def test_apply_text_limit_empty_returns_empty():
    assert ch._apply_text_limit("", "user", {"user": 100}) == ""


def test_apply_text_limit_unknown_kind_falls_back_to_defaults():
    # `agent` default is 5000 — text shorter, must pass through (collapsed).
    out = ch._apply_text_limit("hi  there", "agent", {})
    assert out == "hi there"


def test_read_text_limits_defaults_when_no_file(tmp_path: Path):
    out = ch._read_text_limits(tmp_path / "missing.yml")
    assert out == ch.DEFAULT_TEXT_LIMITS


def test_read_text_limits_overrides_partial(tmp_path: Path):
    p = tmp_path / "settings.yml"
    p.write_text(
        "chat_history:\n  text_limits:\n    user: 100\n    agent: 0\n",
        encoding="utf-8",
    )
    out = ch._read_text_limits(p)
    assert out["user"] == 100
    assert out["agent"] == 0
    # Untouched defaults survive.
    assert out["tool"] == ch.DEFAULT_TEXT_LIMITS["tool"]
    assert out["phase"] == ch.DEFAULT_TEXT_LIMITS["phase"]


def test_read_text_limits_clamps_negative_to_zero(tmp_path: Path):
    p = tmp_path / "settings.yml"
    p.write_text(
        "chat_history:\n  text_limits:\n    user: -5\n",
        encoding="utf-8",
    )
    out = ch._read_text_limits(p)
    assert out["user"] == 0


def test_read_text_limits_drops_non_int(tmp_path: Path):
    p = tmp_path / "settings.yml"
    p.write_text(
        "chat_history:\n  text_limits:\n    user: nope\n",
        encoding="utf-8",
    )
    out = ch._read_text_limits(p)
    assert out["user"] == ch.DEFAULT_TEXT_LIMITS["user"]


# ---------------------------------------------------------------------------
# prune_sessions
# ---------------------------------------------------------------------------


def test_prune_sessions_noop_when_below_cap(hist: Path):
    a = ch.derive_session_tag("sess-A")
    ch.init(path=hist)
    ch.append({"t": "user", "text": "x"}, path=hist, session=a)
    res = ch.prune_sessions(5, path=hist)
    assert res["action"] == "noop"
    assert res["dropped_sessions"] == 0


def test_prune_sessions_keeps_n_most_recent_by_position(hist: Path):
    ch.init(path=hist)
    # 4 distinct sessions, appended in order A → B → C → D.
    for sid in ("A", "B", "C", "D"):
        tag = ch.derive_session_tag(f"sess-{sid}")
        ch.append({"t": "user", "text": sid}, path=hist, session=tag)
    res = ch.prune_sessions(2, path=hist)
    assert res["action"] == "pruned"
    assert res["kept_sessions"] == 2
    assert res["dropped_sessions"] == 2
    assert res["dropped_entries"] == 2
    surviving = {e["text"] for e in ch.read_entries(path=hist)}
    assert surviving == {"C", "D"}


def test_prune_sessions_keeps_full_session_not_just_last_entry(hist: Path):
    ch.init(path=hist)
    a = ch.derive_session_tag("sess-A")
    b = ch.derive_session_tag("sess-B")
    ch.append({"t": "user", "text": "a1"}, path=hist, session=a)
    ch.append({"t": "agent", "text": "a2"}, path=hist, session=a)
    ch.append({"t": "user", "text": "b1"}, path=hist, session=b)
    ch.append({"t": "agent", "text": "b2"}, path=hist, session=b)
    res = ch.prune_sessions(1, path=hist)
    assert res["action"] == "pruned"
    assert res["kept_sessions"] == 1
    assert res["dropped_entries"] == 2
    surviving = [e["text"] for e in ch.read_entries(path=hist)]
    assert surviving == ["b1", "b2"]


def test_prune_sessions_idempotent(hist: Path):
    ch.init(path=hist)
    for sid in ("A", "B", "C"):
        tag = ch.derive_session_tag(f"sess-{sid}")
        ch.append({"t": "user", "text": sid}, path=hist, session=tag)
    ch.prune_sessions(2, path=hist)
    res = ch.prune_sessions(2, path=hist)
    assert res["action"] == "noop"


def test_prune_sessions_clamps_below_one(hist: Path):
    ch.init(path=hist)
    a = ch.derive_session_tag("sess-A")
    b = ch.derive_session_tag("sess-B")
    ch.append({"t": "user", "text": "a"}, path=hist, session=a)
    ch.append({"t": "user", "text": "b"}, path=hist, session=b)
    # 0 must clamp to 1, not wipe everything.
    res = ch.prune_sessions(0, path=hist)
    assert res["kept_sessions"] == 1
    assert ch.read_entries(path=hist)[0]["text"] == "b"


def test_prune_sessions_missing_file_is_noop(hist: Path):
    res = ch.prune_sessions(5, path=hist)
    assert res["action"] == "noop"
    assert res["kept_sessions"] == 0



# ---------------------------------------------------------------------------
# hook_append
# ---------------------------------------------------------------------------


def test_hook_append_disabled_short_circuits(
    hist: Path, settings_disabled: Path, monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(hist))
    res = ch.hook_append(
        "user_prompt", session_id="sess-1",
        payload={"text": "hi"}, settings_path=settings_disabled,
    )
    assert res["action"] == "disabled"
    assert not hist.is_file()


def test_hook_append_initialises_header_lazily(
    hist: Path, settings_enabled: Path, monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(hist))
    ch.hook_append(
        "user_prompt", session_id="sess-1",
        payload={"text": "hello"}, settings_path=settings_enabled,
    )
    header = ch.read_header(hist)
    assert header is not None
    assert header["v"] == 4


def test_hook_append_user_prompt_writes_entry_and_tag(
    hist: Path, settings_enabled: Path, monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(hist))
    res = ch.hook_append(
        "user_prompt", session_id="sess-1",
        payload={"text": "hello"}, settings_path=settings_enabled,
    )
    assert res["action"] == "appended"
    assert res["type"] == "user"
    expected_tag = ch.derive_session_tag("sess-1")
    entries = ch.read_entries(path=hist)
    assert len(entries) == 1
    assert entries[0]["t"] == "user"
    assert entries[0]["text"] == "hello"
    assert entries[0]["s"] == expected_tag


def test_hook_append_session_start_is_noop(
    hist: Path, settings_enabled: Path, monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(hist))
    res = ch.hook_append(
        "session_start", session_id="sess-1",
        settings_path=settings_enabled,
    )
    assert res["action"] == "session_start_noop"
    # Header is created, but no body entry.
    assert ch.read_entries(path=hist) == []


def test_hook_append_skipped_cadence_per_phase(
    hist: Path, settings_enabled: Path, monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(hist))
    # `agent_response` is in per_turn cadence but NOT per_phase (the default).
    res = ch.hook_append(
        "agent_response", session_id="sess-1",
        payload={"text": "x"}, settings_path=settings_enabled,
    )
    assert res["action"] == "skipped_cadence"
    assert res["frequency"] == "per_phase"


def test_hook_append_per_turn_records_agent_response(
    hist: Path, settings_per_turn: Path, monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(hist))
    res = ch.hook_append(
        "agent_response", session_id="sess-1",
        payload={"text": "reply"}, settings_path=settings_per_turn,
    )
    assert res["action"] == "appended"
    assert res["type"] == "agent"


def test_hook_append_tool_use_per_tool_cadence(
    hist: Path, settings_per_tool: Path, monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(hist))
    res = ch.hook_append(
        "tool_use", session_id="sess-1",
        payload={"text": "reading", "tool": "view"},
        settings_path=settings_per_tool,
    )
    assert res["action"] == "appended"
    entries = ch.read_entries(path=hist)
    assert entries[-1]["tool"] == "view"
    assert entries[-1]["t"] == "tool"


def test_hook_append_applies_text_limit_to_tool(
    hist: Path, settings_enabled: Path, monkeypatch: pytest.MonkeyPatch,
):
    # Use per_tool cadence so the tool_use append is not skipped.
    sp = hist.parent / "settings-tool.yml"
    sp.write_text(
        "chat_history:\n"
        "  enabled: true\n"
        "  frequency: per_tool\n"
        "  text_limits:\n    tool: 10\n",
        encoding="utf-8",
    )
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(hist))
    long_text = "x" * 50
    ch.hook_append(
        "tool_use", session_id="sess-1",
        payload={"text": long_text, "tool": "view"},
        settings_path=sp,
    )
    e = ch.read_entries(path=hist)[-1]
    assert e["text"].startswith("xxxxxxxxxx ")
    assert e["text"].endswith(" chars]")


def test_hook_append_unknown_session_id_uses_unknown_tag(
    hist: Path, settings_enabled: Path, monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(hist))
    res = ch.hook_append(
        "user_prompt", session_id=None,
        payload={"text": "x"}, settings_path=settings_enabled,
    )
    assert res["s"] == ch.SESSION_ID_UNKNOWN
    assert ch.read_entries(path=hist)[0]["s"] == ch.SESSION_ID_UNKNOWN


def test_hook_append_invalid_event_raises(settings_enabled: Path):
    with pytest.raises(ValueError):
        ch.hook_append("nope", session_id="x",
                       settings_path=settings_enabled)



# ---------------------------------------------------------------------------
# hook_append — pruning regression
# ---------------------------------------------------------------------------


@pytest.fixture
def settings_max_two(tmp_path: Path) -> Path:
    p = tmp_path / "settings-max2.yml"
    p.write_text(
        "chat_history:\n"
        "  enabled: true\n"
        "  frequency: per_phase\n"
        "  max_sessions: 2\n",
        encoding="utf-8",
    )
    return p


def test_hook_append_prunes_on_session_change(
    hist: Path, settings_max_two: Path, monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(hist))
    for sid in ("A", "B", "C"):
        ch.hook_append(
            "user_prompt", session_id=f"sess-{sid}",
            payload={"text": sid}, settings_path=settings_max_two,
        )
    sessions = {e["s"] for e in ch.read_entries(path=hist)}
    expected = {ch.derive_session_tag(f"sess-{sid}") for sid in ("B", "C")}
    assert sessions == expected


def test_hook_append_does_not_reprune_same_session(
    hist: Path, settings_max_two: Path, monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(hist))
    ch.hook_append("user_prompt", session_id="sess-1",
                   payload={"text": "first"},
                   settings_path=settings_max_two)
    ch.hook_append("user_prompt", session_id="sess-1",
                   payload={"text": "second"},
                   settings_path=settings_max_two)
    ch.hook_append("user_prompt", session_id="sess-1",
                   payload={"text": "third"},
                   settings_path=settings_max_two)
    entries = ch.read_entries(path=hist)
    assert [e["text"] for e in entries] == ["first", "second", "third"]


def test_hook_append_respects_cap_under_repeated_appends_per_session(
    hist: Path, settings_max_two: Path, monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(hist))
    # Two appends per session, three sessions; cap=2 must keep 2 sessions
    # × 2 entries = 4 entries.
    for sid in ("A", "B", "C"):
        for n in range(2):
            ch.hook_append(
                "user_prompt", session_id=f"sess-{sid}",
                payload={"text": f"{sid}{n}"},
                settings_path=settings_max_two,
            )
    sessions = {e["s"] for e in ch.read_entries(path=hist)}
    assert len(sessions) == 2
    assert len(ch.read_entries(path=hist)) == 4


# ---------------------------------------------------------------------------
# hook_dispatch
# ---------------------------------------------------------------------------


def test_hook_dispatch_unknown_platform_raises(settings_enabled: Path):
    with pytest.raises(ValueError):
        ch.hook_dispatch("nope", "{}", settings_path=settings_enabled)


def test_hook_dispatch_invalid_json_raises(settings_enabled: Path):
    with pytest.raises(ValueError):
        ch.hook_dispatch("claude", "{not json",
                         settings_path=settings_enabled)


def test_hook_dispatch_unmapped_event_returns_skipped(
    hist: Path, settings_enabled: Path, monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(hist))
    res = ch.hook_dispatch(
        "claude",
        json.dumps({"hook_event_name": "PreToolUse", "session_id": "x"}),
        settings_path=settings_enabled,
    )
    assert res["action"] == "skipped_unmapped_event"
    assert res["raw_event"] == "PreToolUse"


def test_hook_dispatch_claude_user_prompt(
    hist: Path, settings_enabled: Path, monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(hist))
    payload = {
        "hook_event_name": "UserPromptSubmit",
        "session_id": "claude-abc",
        "prompt": "what time is it?",
    }
    res = ch.hook_dispatch(
        "claude", json.dumps(payload), settings_path=settings_enabled,
    )
    assert res["action"] == "appended"
    assert res["type"] == "user"
    expected_tag = ch.derive_session_tag("claude-abc")
    e = ch.read_entries(path=hist)[-1]
    assert e["t"] == "user"
    assert e["text"] == "what time is it?"
    assert e["s"] == expected_tag
    assert e.get("agent") == "claude"


def test_hook_dispatch_event_override(
    hist: Path, settings_per_turn: Path, monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(hist))
    # Payload has no event key; override forces the mapping.
    res = ch.hook_dispatch(
        "claude",
        json.dumps({"session_id": "s", "response": "ok"}),
        event_override="Stop",
        settings_path=settings_per_turn,
    )
    assert res["action"] == "appended"
    assert res["type"] == "agent"


def test_hook_dispatch_empty_stdin_returns_skipped(
    hist: Path, settings_enabled: Path, monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(hist))
    res = ch.hook_dispatch("claude", "", settings_path=settings_enabled)
    assert res["action"] == "skipped_unmapped_event"


def test_hook_dispatch_augment_dual_emit(
    hist: Path, settings_per_turn: Path, monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(hist))
    payload = {
        "hook_event_name": "Stop",
        "session_id": "augment-1",
        "conversation": {
            "userPrompt": "hello",
            "agentTextResponse": "hi back",
        },
    }
    ch.hook_dispatch(
        "augment", json.dumps(payload), settings_path=settings_per_turn,
    )
    entries = ch.read_entries(path=hist)
    types = [e["t"] for e in entries]
    texts = [e.get("text") for e in entries]
    assert "user" in types
    assert "agent" in types
    assert "hello" in texts
    assert "hi back" in texts



# ---------------------------------------------------------------------------
# _extract_claude_transcript_response
# ---------------------------------------------------------------------------


def _write_jsonl(p: Path, *objs: dict) -> None:
    p.write_text(
        "\n".join(json.dumps(o) for o in objs) + "\n",
        encoding="utf-8",
    )


def test_extract_claude_transcript_empty_path():
    assert ch._extract_claude_transcript_response("") == ""


def test_extract_claude_transcript_missing_file(tmp_path: Path):
    p = tmp_path / "missing.jsonl"
    assert ch._extract_claude_transcript_response(str(p)) == ""


def test_extract_claude_transcript_string_content(tmp_path: Path):
    p = tmp_path / "t.jsonl"
    _write_jsonl(p, {
        "type": "assistant",
        "message": {"content": "hello there"},
    })
    assert ch._extract_claude_transcript_response(str(p)) == "hello there"


def test_extract_claude_transcript_block_list_content(tmp_path: Path):
    p = tmp_path / "t.jsonl"
    _write_jsonl(p, {
        "type": "assistant",
        "message": {"content": [
            {"type": "text", "text": "first line"},
            {"type": "tool_use", "name": "view"},
            {"type": "text", "text": "second line"},
        ]},
    })
    out = ch._extract_claude_transcript_response(str(p))
    assert out == "first line\nsecond line"


def test_extract_claude_transcript_returns_last_assistant(tmp_path: Path):
    p = tmp_path / "t.jsonl"
    _write_jsonl(
        p,
        {"type": "user", "message": {"content": "ignored"}},
        {"type": "assistant", "message": {"content": "first"}},
        {"type": "user", "message": {"content": "ignored"}},
        {"type": "assistant", "message": {"content": "latest"}},
    )
    assert ch._extract_claude_transcript_response(str(p)) == "latest"


def test_extract_claude_transcript_skips_malformed_lines(tmp_path: Path):
    p = tmp_path / "t.jsonl"
    p.write_text(
        "{not json\n"
        + json.dumps({"type": "assistant",
                      "message": {"content": "ok"}}) + "\n"
        + "\n"
        + "[]\n",  # not a dict
        encoding="utf-8",
    )
    assert ch._extract_claude_transcript_response(str(p)) == "ok"


def test_extract_claude_transcript_no_assistant(tmp_path: Path):
    p = tmp_path / "t.jsonl"
    _write_jsonl(p, {"type": "user", "message": {"content": "hi"}})
    assert ch._extract_claude_transcript_response(str(p)) == ""


def test_extract_claude_transcript_strips_whitespace(tmp_path: Path):
    p = tmp_path / "t.jsonl"
    _write_jsonl(p, {
        "type": "assistant",
        "message": {"content": "   spaced   \n"},
    })
    assert ch._extract_claude_transcript_response(str(p)) == "spaced"


def test_extract_claude_transcript_unknown_message_shape(tmp_path: Path):
    p = tmp_path / "t.jsonl"
    _write_jsonl(p, {"type": "assistant", "message": "not a dict"})
    assert ch._extract_claude_transcript_response(str(p)) == ""



# ---------------------------------------------------------------------------
# Cursor / Cline / Gemini / Windsurf — docs-verified extractor branches
# ---------------------------------------------------------------------------


def test_extract_cursor_text_uses_transcript_path(tmp_path: Path):
    tp = tmp_path / "cursor.jsonl"
    _write_jsonl(tp, {"type": "assistant", "message": {"content": "from cursor"}})
    out = ch._extract_cursor_text(
        {"transcript_path": str(tp)}, "agent_response",
    )
    assert out == "from cursor"


def test_extract_cursor_text_ignores_non_response_event(tmp_path: Path):
    tp = tmp_path / "cursor.jsonl"
    _write_jsonl(tp, {"type": "assistant", "message": {"content": "ignored"}})
    # beforeSubmitPrompt → user_prompt; the Cursor branch only handles
    # agent_response/stop. Returns "" so the top-level fallback can
    # take over (it will pick up the `prompt` field).
    out = ch._extract_cursor_text(
        {"transcript_path": str(tp), "prompt": "hi"}, "user_prompt",
    )
    assert out == ""


def test_hook_dispatch_cursor_after_agent_response(
    hist: Path, settings_per_turn: Path, tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(hist))
    tp = tmp_path / "cursor.jsonl"
    _write_jsonl(tp, {"type": "assistant", "message": {"content": "hi from cursor"}})
    payload = {
        "hook_event_name": "afterAgentResponse",
        "session_id": "cursor-1",
        "transcript_path": str(tp),
    }
    res = ch.hook_dispatch(
        "cursor", json.dumps(payload), settings_path=settings_per_turn,
    )
    assert res["action"] == "appended"
    assert res["type"] == "agent"
    e = ch.read_entries(path=hist)[-1]
    assert e["text"] == "hi from cursor"
    assert e.get("agent") == "cursor"
    assert e["s"] == ch.derive_session_tag("cursor-1")


def test_hook_dispatch_cursor_before_submit_prompt(
    hist: Path, settings_enabled: Path, monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(hist))
    payload = {
        "hook_event_name": "beforeSubmitPrompt",
        "session_id": "cursor-2",
        "prompt": "what time is it?",
    }
    res = ch.hook_dispatch(
        "cursor", json.dumps(payload), settings_path=settings_enabled,
    )
    assert res["action"] == "appended"
    assert res["type"] == "user"
    e = ch.read_entries(path=hist)[-1]
    assert e["text"] == "what time is it?"
    assert e.get("agent") == "cursor"


def test_extract_cline_text_user_prompt_camelcase():
    assert ch._extract_cline_text(
        {"userPrompt": "hi from cline"}, "user_prompt",
    ) == "hi from cline"


def test_extract_cline_text_user_prompt_snakecase():
    assert ch._extract_cline_text(
        {"prompt": "hello"}, "user_prompt",
    ) == "hello"


def test_extract_cline_text_returns_empty_on_other_events():
    assert ch._extract_cline_text(
        {"prompt": "ignored"}, "session_end",
    ) == ""


def test_hook_dispatch_cline_user_prompt(
    hist: Path, settings_enabled: Path, monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(hist))
    payload = {
        "hook_event_name": "UserPromptSubmit",
        "session_id": "cline-task-1",
        "prompt": "refactor this",
    }
    res = ch.hook_dispatch(
        "cline", json.dumps(payload), settings_path=settings_enabled,
    )
    assert res["action"] == "appended"
    assert res["type"] == "user"
    e = ch.read_entries(path=hist)[-1]
    assert e["text"] == "refactor this"
    assert e.get("agent") == "cline"
    assert e["s"] == ch.derive_session_tag("cline-task-1")


def test_extract_gemini_text_prompt_response_direct():
    assert ch._extract_gemini_text(
        {"prompt_response": "from gemini"}, "agent_response",
    ) == "from gemini"


def test_extract_gemini_text_falls_back_to_transcript(tmp_path: Path):
    tp = tmp_path / "gemini.jsonl"
    _write_jsonl(tp, {"type": "assistant", "message": {"content": "ts text"}})
    out = ch._extract_gemini_text(
        {"transcript_path": str(tp)}, "agent_response",
    )
    assert out == "ts text"


def test_hook_dispatch_gemini_after_agent(
    hist: Path, settings_per_turn: Path, monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(hist))
    payload = {
        "hook_event_name": "AfterAgent",
        "session_id": "gemini-1",
        "prompt_response": "the time is now",
    }
    res = ch.hook_dispatch(
        "gemini", json.dumps(payload), settings_path=settings_per_turn,
    )
    assert res["action"] == "appended"
    assert res["type"] == "agent"
    e = ch.read_entries(path=hist)[-1]
    assert e["text"] == "the time is now"
    assert e.get("agent") == "gemini"


def test_extract_windsurf_text_tool_info_response():
    assert ch._extract_windsurf_text(
        {"tool_info": {"response": "from windsurf"}}, "agent_response",
    ) == "from windsurf"


def test_extract_windsurf_text_transcript_variant(tmp_path: Path):
    tp = tmp_path / "ws.jsonl"
    _write_jsonl(tp, {"type": "assistant", "message": {"content": "ws ts"}})
    out = ch._extract_windsurf_text(
        {"transcript_path": str(tp)}, "agent_response",
    )
    assert out == "ws ts"


def test_hook_dispatch_windsurf_post_cascade_response(
    hist: Path, settings_per_turn: Path, monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(hist))
    payload = {
        "hook_event_name": "post_cascade_response",
        "session_id": "ws-1",
        "tool_info": {"response": "**Done.**"},
    }
    res = ch.hook_dispatch(
        "windsurf", json.dumps(payload), settings_path=settings_per_turn,
    )
    assert res["action"] == "appended"
    assert res["type"] == "agent"
    e = ch.read_entries(path=hist)[-1]
    assert e["text"] == "**Done.**"
    assert e.get("agent") == "windsurf"


def test_hook_dispatch_windsurf_pre_user_prompt(
    hist: Path, settings_enabled: Path, monkeypatch: pytest.MonkeyPatch,
):
    monkeypatch.setenv("AGENT_CHAT_HISTORY_FILE", str(hist))
    payload = {
        "hook_event_name": "pre_user_prompt",
        "session_id": "ws-2",
        "prompt": "open a PR",
    }
    res = ch.hook_dispatch(
        "windsurf", json.dumps(payload), settings_path=settings_enabled,
    )
    assert res["action"] == "appended"
    assert res["type"] == "user"
    e = ch.read_entries(path=hist)[-1]
    assert e["text"] == "open a PR"
    assert e.get("agent") == "windsurf"



# ---------------------------------------------------------------------------
# overflow_handle
# ---------------------------------------------------------------------------


def test_overflow_handle_invalid_mode_raises(hist: Path):
    with pytest.raises(ValueError):
        ch.overflow_handle(1, mode="nope", path=hist)


def test_overflow_handle_missing_file_is_noop(hist: Path):
    res = ch.overflow_handle(1, mode="rotate", path=hist)
    assert res["action"] == "noop"
    assert res["dropped"] == 0


def test_overflow_handle_under_budget_is_noop(hist: Path):
    ch.init(path=hist)
    ch.append({"t": "user", "text": "hi"}, path=hist)
    # File is way below 1MB.
    res = ch.overflow_handle(1024, mode="rotate", path=hist)
    assert res["action"] == "noop"


def test_overflow_handle_rotate_drops_oldest_keeps_header(hist: Path):
    ch.init(path=hist)
    a = ch.derive_session_tag("sess-A")
    # Pad each entry with a sizeable text so a 1KB cap forces a drop.
    big = "x" * 400
    for i in range(10):
        ch.append({"t": "user", "text": f"{i}-{big}"},
                  path=hist, session=a)
    size_before = hist.stat().st_size
    assert size_before > 1024
    res = ch.overflow_handle(1, mode="rotate", path=hist)
    assert res["action"] == "rotate"
    assert res["dropped"] > 0
    assert res["kept"] == 10 - res["dropped"]
    # Header survives and stays at v4.
    header = ch.read_header(hist)
    assert header is not None
    assert header["v"] == 4
    # File is now within budget.
    assert hist.stat().st_size <= 1 * 1024
    # Surviving entries are the most recent ones (suffix-ordered).
    surviving = ch.read_entries(path=hist)
    nums = [int(e["text"].split("-", 1)[0]) for e in surviving]
    assert nums == sorted(nums)
    assert nums[-1] == 9  # newest entry must survive


def test_overflow_handle_compress_appends_marker(hist: Path):
    ch.init(path=hist)
    big = "x" * 400
    for i in range(5):
        ch.append({"t": "user", "text": f"{i}-{big}"}, path=hist)
    res = ch.overflow_handle(1, mode="compress", path=hist)
    assert res["action"] == "compress_marked"
    assert res["dropped"] == 0
    entries = ch.read_entries(path=hist)
    # Original entries intact; a marker is the trailing entry.
    assert any(e.get("t") == "needs_compress" for e in entries)
    assert entries[-1]["t"] == "needs_compress"
    assert "1 KB" in entries[-1]["reason"]


def test_overflow_handle_rotate_empty_body_returns_zero_kept(
    hist: Path, tmp_path: Path,
):
    # Header-only file is already a noop because body fits in budget — make
    # the file exceed the cap with an oversized header to drive the
    # `if not lines` / empty-entries path.
    ch.init(path=hist)
    # Bloat the header line directly so the file exceeds 1 byte total.
    raw = hist.read_text(encoding="utf-8")
    bloated = raw.rstrip("\n") + " " * 5000 + "\n"
    hist.write_text(bloated, encoding="utf-8")
    res = ch.overflow_handle(1, mode="rotate", path=hist)
    # Only the header remains; nothing to drop.
    assert res["action"] == "rotate"
    assert res["kept"] == 0
    assert res["dropped"] == 0
