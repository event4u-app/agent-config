"""Tests for scripts/compress_memory.py (Phase 2 of step-16-caveman-substance)."""
from __future__ import annotations

import hashlib
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "scripts"))

from compress_memory import (  # noqa: E402
    CompressionRefused,
    compress_file,
    compress_text,
    decompress_file,
)
from validate_safe_paths import SensitivePathError  # noqa: E402


def test_drops_articles_and_auxiliaries():
    out = compress_text("The agent is a tool that helps the user.\n")
    assert "The" not in out and " the " not in out
    assert " is " not in out
    assert "agent" in out and "tool" in out and "user" in out


def test_preserves_code_fences_byte_for_byte():
    src = "Prose is here.\n\n```python\nx = the value\n```\n\nMore prose.\n"
    out = compress_text(src)
    assert "x = the value" in out
    assert "```python\n" in out


def test_preserves_numbered_options():
    src = "Body prose is here.\n\n1. The first option\n2. The second option\n"
    out = compress_text(src)
    assert "1. The first option\n" in out
    assert "2. The second option\n" in out


def test_preserves_status_markers():
    src = "Body prose is here.\n\n\u274c The error happened\n\u2705 The success\n"
    out = compress_text(src)
    assert "\u274c The error happened\n" in out
    assert "\u2705 The success\n" in out


def test_preserves_iron_law_allcaps():
    src = "Body prose is here.\n\nNEVER COMMIT WITHOUT PERMISSION\n"
    out = compress_text(src)
    assert "NEVER COMMIT WITHOUT PERMISSION\n" in out


def test_preserves_backtick_spans():
    out = compress_text("The file `the/path.md` is the target.\n")
    assert "`the/path.md`" in out


def test_idempotent_on_clean_compressed_text():
    once = compress_text("The agent is a helper.\n")
    twice = compress_text(once)
    assert once == twice


def test_compress_file_writes_backup_and_frontmatter(tmp_path: Path):
    target = tmp_path / "AGENTS.md"
    body = "The agent is a tool.\n"
    target.write_text(body, encoding="utf-8")
    backup = compress_file(target)
    assert backup.is_file()
    assert backup.read_text() == body
    out = target.read_text()
    assert out.startswith("---\n")
    expected_sha = hashlib.sha256(body.encode()).hexdigest()
    assert f"original_sha256: {expected_sha}" in out
    assert "compressed_at:" in out


def test_compress_file_refuses_sensitive(tmp_path: Path):
    target = tmp_path / ".env.local"
    target.write_text("SECRET=x\n")
    with pytest.raises(SensitivePathError):
        compress_file(target)


def test_compress_file_idempotent_no_op(tmp_path: Path):
    target = tmp_path / "AGENTS.md"
    target.write_text("The agent is a tool.\n", encoding="utf-8")
    compress_file(target)
    first = target.read_text()
    # Re-run: should return target (no-op), file unchanged because body hash matches
    compress_file(target)
    assert target.read_text() == first


def test_compress_file_refuses_on_body_drift(tmp_path: Path):
    target = tmp_path / "AGENTS.md"
    target.write_text("The agent is a tool.\n", encoding="utf-8")
    compress_file(target)
    # Simulate manual edit that changes the compressed body to non-idempotent form
    current = target.read_text()
    target.write_text(current + "\nThe extra paragraph is added.\n", encoding="utf-8")
    with pytest.raises(CompressionRefused):
        compress_file(target)


def test_decompress_restores_original(tmp_path: Path):
    target = tmp_path / "AGENTS.md"
    body = "The agent is a tool.\n"
    target.write_text(body, encoding="utf-8")
    compress_file(target)
    decompress_file(target)
    assert target.read_text() == body
    assert not (tmp_path / "AGENTS.md.original.md").exists()
