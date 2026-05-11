"""Tests for scripts/sync_gitignore.py — .gitignore block sync helper."""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts"))
import sync_gitignore as sg  # noqa: E402


# Minimal template used throughout; matches sub-group shape of real template
TEMPLATE_CONTENT = """\
# Agent config — symlinked
.augment/skills/
.augment/commands/

# Agent config — CLI wrapper
/agent-config

# Agent config — chat history
/agents/.agent-chat-history
/agents/.agent-chat-history.bak
"""


@pytest.fixture
def template(tmp_path: Path) -> Path:
    p = tmp_path / "gitignore-block.txt"
    p.write_text(TEMPLATE_CONTENT, encoding="utf-8")
    return p


@pytest.fixture
def gitignore(tmp_path: Path) -> Path:
    return tmp_path / ".gitignore"


def _run(args: list[str]) -> int:
    return sg.main(args)


def test_template_entries_extracts_paths_only(template: Path):
    lines = sg.load_template(template)
    entries = sg.template_entries(lines)
    assert entries == [
        ".augment/skills/", ".augment/commands/",
        "/agent-config",
        "/agents/.agent-chat-history", "/agents/.agent-chat-history.bak",
    ]


def test_block_entries_ignores_comments_and_blanks():
    block = [
        "# event4u/agent-config",
        "# Agent config — X",
        ".foo",
        "",
        ".bar",
        "# event4u/agent-config — END",
    ]
    assert sg.block_entries(block) == [".foo", ".bar"]


def test_find_block_missing_returns_none():
    assert sg.find_block(["/vendor/", "/node_modules/"]) is None


def test_find_block_with_explicit_footer():
    lines = [
        "/vendor/",
        "",
        "# event4u/agent-config",
        ".foo",
        "# event4u/agent-config — END",
        "",
        "# user stuff",
    ]
    loc = sg.find_block(lines)
    assert loc == (2, 5)
    assert lines[loc[0]:loc[1]] == [
        "# event4u/agent-config",
        ".foo",
        "# event4u/agent-config — END",
    ]


def test_find_block_legacy_no_footer_extends_to_eof():
    lines = [
        "/vendor/",
        "",
        "# event4u/agent-config",
        "# Agent config — X",
        ".foo",
        ".bar",
    ]
    loc = sg.find_block(lines)
    assert loc == (2, 6)


def test_find_block_legacy_stops_at_foreign_section():
    lines = [
        "# event4u/agent-config",
        "# Agent config — X",
        ".foo",
        "",
        "# Some user block",
        "user-stuff/",
    ]
    loc = sg.find_block(lines)
    assert loc == (0, 3)


def test_sync_appends_fresh_block_when_missing(gitignore: Path,
                                               template: Path):
    gitignore.write_text("/vendor/\n/node_modules/\n", encoding="utf-8")
    rc = _run(["--path", str(gitignore), "--template", str(template)])
    assert rc == 0
    text = gitignore.read_text(encoding="utf-8")
    assert "/vendor/" in text
    assert sg.SECTION_HEADER in text
    assert sg.SECTION_FOOTER in text
    assert ".agent-chat-history" in text
    # Exactly one trailing newline
    assert text.endswith("\n") and not text.endswith("\n\n")


def test_sync_no_changes_when_already_complete(gitignore: Path,
                                               template: Path,
                                               capsys):
    # First run to establish block
    _run(["--path", str(gitignore), "--template", str(template)])
    mtime_before = gitignore.stat().st_mtime_ns
    text_before = gitignore.read_text(encoding="utf-8")
    # Second run is a no-op
    capsys.readouterr()
    rc = _run(["--path", str(gitignore), "--template", str(template)])
    assert rc == 0
    assert gitignore.read_text(encoding="utf-8") == text_before
    # File not rewritten when in sync
    assert gitignore.stat().st_mtime_ns == mtime_before
    out = capsys.readouterr().out
    assert "already in sync" in out


def test_sync_appends_missing_entry_to_legacy_block(gitignore: Path,
                                                    template: Path):
    # Legacy block without END marker, missing /agent-config
    existing = (
        "/vendor/\n\n"
        "# event4u/agent-config\n"
        "# Agent config — symlinked\n"
        ".augment/skills/\n"
        ".augment/commands/\n"
        "# Agent config — chat history\n"
        ".agent-chat-history\n"
        ".agent-chat-history.bak\n"
    )
    gitignore.write_text(existing, encoding="utf-8")
    rc = _run(["--path", str(gitignore), "--template", str(template)])
    assert rc == 0
    text = gitignore.read_text(encoding="utf-8")
    assert "/agent-config" in text
    # END marker added on migration
    assert sg.SECTION_FOOTER in text
    # Pre-existing user content untouched
    assert text.startswith("/vendor/\n")


def test_sync_preserves_user_added_lines_inside_block(gitignore: Path,
                                                      template: Path):
    existing = (
        "# event4u/agent-config\n"
        "# Agent config — symlinked\n"
        ".augment/skills/\n"
        ".augment/commands/\n"
        "my-custom-entry.local\n"
        "# event4u/agent-config — END\n"
    )
    gitignore.write_text(existing, encoding="utf-8")
    rc = _run(["--path", str(gitignore), "--template", str(template)])
    assert rc == 0
    text = gitignore.read_text(encoding="utf-8")
    # User-added line survives
    assert "my-custom-entry.local" in text
    # New managed entries appended
    assert "/agent-config" in text
    assert ".agent-chat-history" in text


def test_sync_replace_mode_rewrites_block_fully(gitignore: Path,
                                                template: Path):
    existing = (
        "# event4u/agent-config\n"
        "# Agent config — symlinked\n"
        ".augment/skills/\n"
        "my-custom-entry.local\n"
        "stale-entry\n"
        "# event4u/agent-config — END\n"
    )
    gitignore.write_text(existing, encoding="utf-8")
    rc = _run(["--path", str(gitignore), "--template", str(template),
               "--replace"])
    assert rc == 0
    text = gitignore.read_text(encoding="utf-8")
    # User-added + stale lines gone in replace mode
    assert "my-custom-entry.local" not in text
    assert "stale-entry" not in text
    # All managed entries present
    assert "/agent-config" in text
    assert ".agent-chat-history" in text


def test_sync_dry_run_prints_diff_without_writing(gitignore: Path,
                                                  template: Path,
                                                  capsys):
    gitignore.write_text("/vendor/\n", encoding="utf-8")
    mtime_before = gitignore.stat().st_mtime_ns
    rc = _run(["--path", str(gitignore), "--template", str(template),
               "--dry-run"])
    assert rc == 0
    assert gitignore.stat().st_mtime_ns == mtime_before
    out = capsys.readouterr()
    assert "# event4u/agent-config" in out.out
    assert "+/agents/.agent-chat-history" in out.out
    assert "(dry-run)" in out.err


def test_sync_creates_gitignore_when_missing(gitignore: Path,
                                             template: Path):
    assert not gitignore.exists()
    rc = _run(["--path", str(gitignore), "--template", str(template)])
    assert rc == 0
    assert gitignore.is_file()
    text = gitignore.read_text(encoding="utf-8")
    assert sg.SECTION_HEADER in text
    assert sg.SECTION_FOOTER in text


def test_sync_missing_template_returns_2(gitignore: Path, tmp_path: Path,
                                         capsys):
    bogus = tmp_path / "nope.txt"
    rc = _run(["--path", str(gitignore), "--template", str(bogus)])
    assert rc == 2
    assert "template not found" in capsys.readouterr().err


def test_sync_trims_trailing_newlines(gitignore: Path, template: Path):
    gitignore.write_text("/vendor/\n\n\n", encoding="utf-8")
    _run(["--path", str(gitignore), "--template", str(template)])
    text = gitignore.read_text(encoding="utf-8")
    assert text.endswith("\n") and not text.endswith("\n\n")


def test_sync_real_config_template_works_on_package_repo():
    """Smoke test: the shipped template parses and produces entries."""
    default = sg.DEFAULT_TEMPLATE
    assert default.is_file(), f"missing shipped template: {default}"
    lines = sg.load_template(default)
    entries = sg.template_entries(lines)
    assert len(entries) >= 5
    assert "/agents/.agent-chat-history" in entries


# ---------- --cleanup-legacy ----------------------------------------------

def test_cleanup_legacy_removes_root_level_entries_outside_block():
    """Legacy patterns sitting outside the managed block are stripped."""
    lines = [
        "/vendor/",
        ".agent-chat-history",
        ".agent-chat-history.bak",
        ".agent-prices.md",
        "user-stuff/",
    ]
    new_lines, removed = sg.cleanup_legacy(lines)
    assert new_lines == ["/vendor/", "user-stuff/"]
    assert set(removed) == {
        ".agent-chat-history", ".agent-chat-history.bak", ".agent-prices.md",
    }


def test_cleanup_legacy_removes_entries_with_leading_slash():
    """Defensive: leading `/` variant is treated as legacy too."""
    lines = ["/.agent-chat-history", "/.agent-prices.md", "/vendor/"]
    new_lines, removed = sg.cleanup_legacy(lines)
    assert new_lines == ["/vendor/"]
    assert set(removed) == {"/.agent-chat-history", "/.agent-prices.md"}


def test_cleanup_legacy_preserves_current_managed_paths():
    """Current canonical /agents/ paths are NOT legacy."""
    lines = [
        "/agents/.agent-chat-history",
        "/agents/.agent-chat-history.bak",
        "/agents/.agent-prices.md",
    ]
    new_lines, removed = sg.cleanup_legacy(lines)
    assert new_lines == lines
    assert removed == []


def test_cleanup_legacy_preserves_comments_and_blanks():
    lines = [
        "# event4u/agent-config",
        "",
        "# Agent config — chat history",
        ".agent-chat-history",
        "",
        "# event4u/agent-config — END",
    ]
    new_lines, removed = sg.cleanup_legacy(lines)
    assert new_lines == [
        "# event4u/agent-config",
        "",
        "# Agent config — chat history",
        "",
        "# event4u/agent-config — END",
    ]
    assert removed == [".agent-chat-history"]


def test_cleanup_legacy_noop_when_no_legacy_present():
    lines = ["/vendor/", "/node_modules/", "/agents/.agent-chat-history"]
    new_lines, removed = sg.cleanup_legacy(lines)
    assert new_lines == lines
    assert removed == []


def test_main_cleanup_legacy_strips_outside_block_and_syncs(
    gitignore: Path, template: Path,
):
    """End-to-end: legacy outside block removed AND managed block synced."""
    existing = (
        "/vendor/\n"
        ".agent-chat-history\n"
        ".agent-chat-history.bak\n"
        ".agent-prices.md\n"
        "user-stuff/\n"
    )
    gitignore.write_text(existing, encoding="utf-8")
    rc = _run([
        "--path", str(gitignore), "--template", str(template),
        "--cleanup-legacy",
    ])
    assert rc == 0
    text = gitignore.read_text(encoding="utf-8")
    # Legacy root-level entries gone
    assert "\n.agent-chat-history\n" not in text
    assert "\n.agent-chat-history.bak\n" not in text
    assert "\n.agent-prices.md\n" not in text
    # Managed block present with new /agents/ paths
    assert "/agents/.agent-chat-history" in text
    assert sg.SECTION_HEADER in text
    assert sg.SECTION_FOOTER in text
    # User content survives
    assert "/vendor/" in text
    assert "user-stuff/" in text


def test_main_cleanup_legacy_strips_inside_block(
    gitignore: Path, template: Path,
):
    """Legacy entries inside an old managed block are removed."""
    existing = (
        "# event4u/agent-config\n"
        "# Agent config — chat history\n"
        ".agent-chat-history\n"
        ".agent-chat-history.bak\n"
        ".agent-chat-history.*.bak\n"
        "# event4u/agent-config — END\n"
    )
    gitignore.write_text(existing, encoding="utf-8")
    rc = _run([
        "--path", str(gitignore), "--template", str(template),
        "--cleanup-legacy",
    ])
    assert rc == 0
    text = gitignore.read_text(encoding="utf-8")
    # Legacy paths gone from block
    assert "\n.agent-chat-history\n" not in text
    assert "\n.agent-chat-history.bak\n" not in text
    # Current canonical paths added by sync step
    assert "/agents/.agent-chat-history" in text


def test_main_cleanup_legacy_preserves_user_added_lines(
    gitignore: Path, template: Path,
):
    """Non-legacy user-added lines survive cleanup."""
    existing = (
        "/vendor/\n"
        ".agent-chat-history\n"
        "my-custom-ignore.local\n"
    )
    gitignore.write_text(existing, encoding="utf-8")
    rc = _run([
        "--path", str(gitignore), "--template", str(template),
        "--cleanup-legacy",
    ])
    assert rc == 0
    text = gitignore.read_text(encoding="utf-8")
    assert "my-custom-ignore.local" in text
    assert "\n.agent-chat-history\n" not in text


def test_main_cleanup_legacy_dry_run_shows_removed_in_diff(
    gitignore: Path, template: Path, capsys,
):
    """Dry-run prints the diff AND a summary line listing removed legacy."""
    gitignore.write_text(".agent-chat-history\n.agent-prices.md\n",
                         encoding="utf-8")
    mtime_before = gitignore.stat().st_mtime_ns
    rc = _run([
        "--path", str(gitignore), "--template", str(template),
        "--cleanup-legacy", "--dry-run",
    ])
    assert rc == 0
    # File untouched
    assert gitignore.stat().st_mtime_ns == mtime_before
    captured = capsys.readouterr()
    assert "-.agent-chat-history" in captured.out
    assert "would remove 2 legacy" in captured.err


def test_main_cleanup_legacy_noop_when_clean(
    gitignore: Path, template: Path,
):
    """No legacy + block already in sync → no rewrite."""
    # Establish block first
    _run(["--path", str(gitignore), "--template", str(template)])
    mtime_before = gitignore.stat().st_mtime_ns
    rc = _run([
        "--path", str(gitignore), "--template", str(template),
        "--cleanup-legacy",
    ])
    assert rc == 0
    assert gitignore.stat().st_mtime_ns == mtime_before
