"""Tests for scripts/condense_memory.py (Phase 2 of step-16-telegraph-substance)."""
from __future__ import annotations

import hashlib
import sys
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO_ROOT / "src" / "scripts"))

from condense_memory import (  # noqa: E402
    CondensationRefused,
    condense_file,
    condense_text,
    decondense_file,
)
from validate_safe_paths import SensitivePathError  # noqa: E402


def test_drops_articles_and_auxiliaries():
    out = condense_text("The agent is a tool that helps the user.\n")
    assert "The" not in out and " the " not in out
    assert " is " not in out
    assert "agent" in out and "tool" in out and "user" in out


def test_preserves_code_fences_byte_for_byte():
    src = "Prose is here.\n\n```python\nx = the value\n```\n\nMore prose.\n"
    out = condense_text(src)
    assert "x = the value" in out
    assert "```python\n" in out


def test_preserves_numbered_options():
    src = "Body prose is here.\n\n1. The first option\n2. The second option\n"
    out = condense_text(src)
    assert "1. The first option\n" in out
    assert "2. The second option\n" in out


def test_preserves_status_markers():
    src = "Body prose is here.\n\n\u274c The error happened\n\u2705 The success\n"
    out = condense_text(src)
    assert "\u274c The error happened\n" in out
    assert "\u2705 The success\n" in out


def test_preserves_iron_law_allcaps():
    src = "Body prose is here.\n\nNEVER COMMIT WITHOUT PERMISSION\n"
    out = condense_text(src)
    assert "NEVER COMMIT WITHOUT PERMISSION\n" in out


def test_preserves_backtick_spans():
    out = condense_text("The file `the/path.md` is the target.\n")
    assert "`the/path.md`" in out


def test_preserves_markdown_link_target():
    # Link TARGET must survive byte-for-byte even when a path segment
    # collides with a drop-token (`is`, `the`, `a`).
    out = condense_text("See [the guide](docs/what-is-this.md) for the details.\n")
    assert "docs/what-is-this.md" in out


def test_preserves_bare_url():
    out = condense_text("Read the doc at https://example.com/the/answer/is-here now.\n")
    assert "https://example.com/the/answer/is-here" in out


def test_preserves_bare_path_with_slashes():
    out = condense_text(
        "The path docs/is-the-thing/a-file.md is the target that we use.\n"
    )
    assert "docs/is-the-thing/a-file.md" in out


def test_condenses_link_text_but_not_target():
    # Prose link text still loses articles; only the slash-bearing target is frozen.
    out = condense_text("See [the guide](docs/the-guide.md) here.\n")
    assert "docs/the-guide.md" in out
    assert "[ guide]" in out  # "the" dropped from link text


def test_idempotent_on_clean_condensed_text():
    once = condense_text("The agent is a helper.\n")
    twice = condense_text(once)
    assert once == twice


def test_condense_file_writes_backup_and_frontmatter(tmp_path: Path):
    target = tmp_path / "AGENTS.md"
    body = "The agent is a tool.\n"
    target.write_text(body, encoding="utf-8")
    backup = condense_file(target)
    assert backup.is_file()
    assert backup.read_text() == body
    out = target.read_text()
    assert out.startswith("---\n")
    expected_sha = hashlib.sha256(body.encode()).hexdigest()
    assert f"original_sha256: {expected_sha}" in out
    assert "condensed_at:" in out


def test_condense_file_refuses_sensitive(tmp_path: Path):
    target = tmp_path / ".env.local"
    target.write_text("SECRET=x\n")
    with pytest.raises(SensitivePathError):
        condense_file(target)


def test_condense_file_idempotent_no_op(tmp_path: Path):
    target = tmp_path / "AGENTS.md"
    target.write_text("The agent is a tool.\n", encoding="utf-8")
    condense_file(target)
    first = target.read_text()
    # Re-run: should return target (no-op), file unchanged because body hash matches
    condense_file(target)
    assert target.read_text() == first


def test_condense_file_refuses_on_body_drift(tmp_path: Path):
    target = tmp_path / "AGENTS.md"
    target.write_text("The agent is a tool.\n", encoding="utf-8")
    condense_file(target)
    # Simulate manual edit that changes the condensed body to non-idempotent form
    current = target.read_text()
    target.write_text(current + "\nThe extra paragraph is added.\n", encoding="utf-8")
    with pytest.raises(CondensationRefused):
        condense_file(target)


def test_decondense_restores_original(tmp_path: Path):
    target = tmp_path / "AGENTS.md"
    body = "The agent is a tool.\n"
    target.write_text(body, encoding="utf-8")
    condense_file(target)
    decondense_file(target)
    assert target.read_text() == body
    assert not (tmp_path / "AGENTS.md.original.md").exists()
