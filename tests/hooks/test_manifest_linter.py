"""Tests for `scripts/lint_hook_manifest.py` (roadmap step 7.10)."""
from __future__ import annotations

import sys
import textwrap
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO_ROOT / "scripts"))

import lint_hook_manifest as linter  # noqa: E402


VALID_BODY = textwrap.dedent("""\
    schema_version: 1
    concerns:
      chat-history:
        script: scripts/chat_history.py
        args: [hook-dispatch]
        fail_closed: false
    platforms:
      augment:
        session_start: [chat-history]
      cursor:
        session_start: [chat-history]
      cline:
        session_start: [chat-history]
      windsurf:
        session_start: [chat-history]
      gemini:
        session_start: [chat-history]
      copilot:
        fallback_only: true
    native_event_aliases:
      augment:
        SessionStart: session_start
""")


def _write(tmp_path: Path, body: str) -> Path:
    p = tmp_path / "manifest.yaml"
    p.write_text(body, encoding="utf-8")
    return p


def test_clean_manifest_returns_zero(tmp_path: Path, capsys) -> None:
    rc = linter.lint(_write(tmp_path, VALID_BODY), strict=False)
    assert rc == 0
    captured = capsys.readouterr()
    assert "error:" not in captured.err


def test_unknown_concern_in_platform_block_fails(tmp_path: Path, capsys) -> None:
    body = VALID_BODY.replace("[chat-history]", "[ghost-concern]")
    rc = linter.lint(_write(tmp_path, body), strict=False)
    assert rc == 1
    assert "unknown concern 'ghost-concern'" in capsys.readouterr().err


def test_missing_concern_script_fails(tmp_path: Path, capsys) -> None:
    body = VALID_BODY.replace(
        "scripts/chat_history.py", "scripts/does_not_exist.py")
    rc = linter.lint(_write(tmp_path, body), strict=False)
    assert rc == 1
    err = capsys.readouterr().err
    assert "script not found" in err


def test_unknown_event_fails(tmp_path: Path, capsys) -> None:
    body = VALID_BODY.replace("session_start:", "made_up_event:")
    rc = linter.lint(_write(tmp_path, body), strict=False)
    assert rc == 1
    err = capsys.readouterr().err
    assert "unknown event" in err


def test_unknown_platform_fails(tmp_path: Path, capsys) -> None:
    body = VALID_BODY + "  alien-platform:\n    session_start: [chat-history]\n"
    rc = linter.lint(_write(tmp_path, body), strict=False)
    assert rc == 1
    assert "unknown platform" in capsys.readouterr().err


def test_alias_target_must_be_in_vocabulary(tmp_path: Path, capsys) -> None:
    body = VALID_BODY.replace("SessionStart: session_start",
                              "SessionStart: bogus_target")
    rc = linter.lint(_write(tmp_path, body), strict=False)
    assert rc == 1
    err = capsys.readouterr().err
    assert "not in vocabulary" in err


_BODY_WITH_DEAD_CONCERN = textwrap.dedent("""\
    schema_version: 1
    concerns:
      chat-history:
        script: scripts/chat_history.py
        args: [hook-dispatch]
        fail_closed: false
      orphaned:
        script: scripts/chat_history.py
        args: []
        fail_closed: false
    platforms:
      augment:
        session_start: [chat-history]
      cursor:
        session_start: [chat-history]
      cline:
        session_start: [chat-history]
      windsurf:
        session_start: [chat-history]
      gemini:
        session_start: [chat-history]
    native_event_aliases:
      augment:
        SessionStart: session_start
""")


def test_dead_concern_warns_only(tmp_path: Path, capsys) -> None:
    rc = linter.lint(_write(tmp_path, _BODY_WITH_DEAD_CONCERN), strict=False)
    assert rc == 0
    err = capsys.readouterr().err
    assert "concerns.orphaned: declared but not bound" in err


def test_dead_concern_strict_mode_fails(tmp_path: Path) -> None:
    rc = linter.lint(_write(tmp_path, _BODY_WITH_DEAD_CONCERN), strict=True)
    assert rc == 1


def test_missing_file_returns_two(tmp_path: Path) -> None:
    assert linter.lint(tmp_path / "nope.yaml", strict=False) == 2


def test_real_manifest_passes_default_lint(capsys) -> None:
    """The shipping manifest must always be clean (warnings allowed)."""
    rc = linter.lint(linter.DEFAULT_MANIFEST, strict=False)
    assert rc == 0


def test_agent_error_event_accepted(tmp_path: Path) -> None:
    """`agent_error` is part of the vocabulary (Round 2 — Q3) and a
    platform binding to it MUST lint clean."""
    body = VALID_BODY.replace(
        "session_start: [chat-history]\n      cursor:",
        "session_start: [chat-history]\n        agent_error: [chat-history]\n      cursor:",
        1,
    )
    rc = linter.lint(_write(tmp_path, body), strict=False)
    assert rc == 0
    assert "agent_error" in linter.EVENT_VOCABULARY


def test_cursor_null_with_trampoline_on_disk_fails(tmp_path: Path, capsys) -> None:
    """Phase 7.5 — cursor-dispatcher.sh on disk MUST have a non-empty
    cursor block in the manifest. A null block is the silent-no-op
    failure mode the orphan check is built to catch."""
    body = VALID_BODY.replace(
        "  cursor:\n    session_start: [chat-history]\n",
        "  cursor: null\n",
    )
    assert "cursor: null" in body, "fixture replace did not match"
    rc = linter.lint(_write(tmp_path, body), strict=False)
    assert rc == 1
    err = capsys.readouterr().err
    assert "orphan trampoline cursor-dispatcher.sh" in err



def test_cline_null_with_trampoline_on_disk_fails(tmp_path: Path, capsys) -> None:
    """Phase 7.6 — cline-dispatcher.sh on disk MUST have a non-empty
    cline block in the manifest, mirroring the cursor orphan check."""
    body = VALID_BODY.replace(
        "  cline:\n    session_start: [chat-history]\n",
        "  cline: null\n",
    )
    assert "cline: null" in body, "fixture replace did not match"
    rc = linter.lint(_write(tmp_path, body), strict=False)
    assert rc == 1
    err = capsys.readouterr().err
    assert "orphan trampoline cline-dispatcher.sh" in err


def test_windsurf_null_with_trampoline_on_disk_fails(tmp_path: Path, capsys) -> None:
    """Phase 7.7 — windsurf-dispatcher.sh on disk MUST have a non-empty
    windsurf block in the manifest, mirroring the cursor/cline orphan
    checks. Windsurf has no generic post-tool-use surface so concerns
    that gate on it simply don't fire — but the platform block itself
    must still bind something or the trampoline runs to no-op."""
    body = VALID_BODY.replace(
        "  windsurf:\n    session_start: [chat-history]\n",
        "  windsurf: null\n",
    )
    assert "windsurf: null" in body, "fixture replace did not match"
    rc = linter.lint(_write(tmp_path, body), strict=False)
    assert rc == 1
    err = capsys.readouterr().err
    assert "orphan trampoline windsurf-dispatcher.sh" in err


def test_gemini_null_with_trampoline_on_disk_fails(tmp_path: Path, capsys) -> None:
    """Phase 7.8 — gemini-dispatcher.sh on disk MUST have a non-empty
    gemini block in the manifest, mirroring the cursor/cline/windsurf
    orphan checks."""
    body = VALID_BODY.replace(
        "  gemini:\n    session_start: [chat-history]\n",
        "  gemini: null\n",
    )
    assert "gemini: null" in body, "fixture replace did not match"
    rc = linter.lint(_write(tmp_path, body), strict=False)
    assert rc == 1
    err = capsys.readouterr().err
    assert "orphan trampoline gemini-dispatcher.sh" in err
