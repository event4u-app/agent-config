"""Redaction matrix + size guard + manifest correctness."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council.bundler import (  # noqa: E402
    MAX_BUNDLE_BYTES,
    BundleTooLarge,
    bundle_diff,
    bundle_files,
    bundle_prompt,
    bundle_roadmap,
    redact,
)


# ── redaction matrix ────────────────────────────────────────────────────────

REDACTION_CASES = [
    ("api_key = sk-abc123", "secret-like assignment"),
    ("token = somevalue", "secret-like assignment"),
    ("password: hunter2", "secret-like assignment"),
    ("Authorization: Bearer xyz", "Authorization header"),
    ("path = ~/.config/agent-config/anthropic.key", "agent-config key path"),
    ("/Users/me/.config/agent-config/openai.key was used", "agent-config key path"),
    ("found sk-ant-AAAAAAAAAAAAAAAAA in log", "anthropic-key-like token"),
]


@pytest.mark.parametrize("line,marker", REDACTION_CASES)
def test_redact_strips_sensitive_lines(line: str, marker: str) -> None:
    out = redact(line)
    assert "[redacted:" in out
    assert marker in out


def test_redact_preserves_innocent_lines() -> None:
    text = "def hello():\n    return 42\n\nclass Foo:\n    pass"
    assert redact(text) == text


def test_redact_handles_multiple_lines_independently() -> None:
    src = "ok line\napi_key = sk-bad\nstill ok"
    out = redact(src).splitlines()
    assert out[0] == "ok line"
    assert "[redacted:" in out[1]
    assert out[2] == "still ok"


# ── size guard ──────────────────────────────────────────────────────────────


def test_bundle_prompt_below_ceiling() -> None:
    ctx = bundle_prompt("hello council")
    assert ctx.mode == "prompt"
    assert "hello council" in ctx.text
    assert ctx.manifest == ["<inline prompt>"]


def test_bundle_prompt_raises_on_oversize() -> None:
    big = "x" * (MAX_BUNDLE_BYTES + 1)
    with pytest.raises(BundleTooLarge, match="hard ceiling"):
        bundle_prompt(big)


# ── roadmap ─────────────────────────────────────────────────────────────────


def test_bundle_roadmap_reads_file_and_redacts(tmp_path: Path) -> None:
    p = tmp_path / "rm.md"
    p.write_text("# Roadmap\n\napi_key = sk-leak\n\n- step 1\n", encoding="utf-8")
    ctx = bundle_roadmap(p)
    assert ctx.mode == "roadmap"
    assert "[redacted:" in ctx.text
    assert "step 1" in ctx.text
    assert str(p) in ctx.manifest
    assert ctx.excluded  # excluded list documents what was NOT included


def test_bundle_roadmap_missing_file_raises(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        bundle_roadmap(tmp_path / "nope.md")


# ── files ───────────────────────────────────────────────────────────────────


def test_bundle_files_emits_per_file_section(tmp_path: Path) -> None:
    a = tmp_path / "a.py"
    a.write_text("print('a')\n", encoding="utf-8")
    b = tmp_path / "b.py"
    b.write_text("print('b')\n", encoding="utf-8")
    ctx = bundle_files([a, b])
    assert ctx.mode == "files"
    assert str(a) in ctx.text and str(b) in ctx.text
    assert ctx.manifest == [str(a), str(b)]
    assert ctx.excluded == []


def test_bundle_files_records_missing_in_excluded(tmp_path: Path) -> None:
    a = tmp_path / "a.py"
    a.write_text("ok\n", encoding="utf-8")
    ctx = bundle_files([a, tmp_path / "missing.py"])
    assert any("missing.py" in e for e in ctx.excluded)
    assert ctx.manifest == [str(a)]


# ── diff ────────────────────────────────────────────────────────────────────


def test_bundle_diff_uses_git(monkeypatch: pytest.MonkeyPatch) -> None:
    captured: dict[str, object] = {}

    def fake_run(cmd, **kw):  # type: ignore[no-untyped-def]
        captured["cmd"] = cmd
        captured["kw"] = kw

        class _R:
            stdout = "diff --git a/x b/x\n+api_key = sk-bad\n"
            stderr = ""
            returncode = 0

        return _R()

    monkeypatch.setattr("scripts.ai_council.bundler.subprocess.run", fake_run)
    ctx = bundle_diff("main", "HEAD")
    assert ctx.mode == "diff"
    assert "[redacted:" in ctx.text
    assert captured["cmd"] == ["git", "diff", "main..HEAD"]
    assert ctx.manifest == ["git diff main..HEAD"]


def test_bundle_diff_propagates_git_errors(monkeypatch: pytest.MonkeyPatch) -> None:
    def boom(cmd, **kw):  # type: ignore[no-untyped-def]
        raise subprocess.CalledProcessError(1, cmd, output="", stderr="bad ref")

    monkeypatch.setattr("scripts.ai_council.bundler.subprocess.run", boom)
    with pytest.raises(RuntimeError, match="git diff"):
        bundle_diff("nope", "HEAD")
