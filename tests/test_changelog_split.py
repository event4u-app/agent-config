"""Unit tests for ``scripts/_lib/changelog_eras`` split machinery.

The drift gate in ``test_changelog_eras.py`` reads the live
``CHANGELOG.md``; this module instead patches the module-level
``CHANGELOG`` / ``ARCHIVE_DIR`` constants against a tmpdir so the
split logic can be exercised in isolation across boundaries the live
file would never reach (minor bump · major bump · backwards refusal
· patch-within-era · resume-with-existing-archive).
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts._lib import changelog_eras as eras  # noqa: E402


def _write_changelog(tmp_path: Path, body: str) -> Path:
    """Stage a CHANGELOG.md inside ``tmp_path`` and rewire module paths."""
    changelog = tmp_path / "CHANGELOG.md"
    changelog.write_text(body, encoding="utf-8")
    archive_dir = tmp_path / "docs" / "archive"
    archive_dir.mkdir(parents=True, exist_ok=True)
    eras.CHANGELOG = changelog
    eras.ARCHIVE_DIR = archive_dir
    return changelog


@pytest.fixture(autouse=True)
def _restore_module_paths():
    """Snapshot + restore the rewired module constants."""
    saved = (eras.CHANGELOG, eras.ARCHIVE_DIR)
    yield
    eras.CHANGELOG, eras.ARCHIVE_DIR = saved


def _era_3_2_body(extra_entry_lines: int = 0) -> str:
    extra = "\n".join(f"- entry line {i}" for i in range(extra_entry_lines))
    return (
        "# Changelog\n\n"
        "Conventions live in [`docs/contracts/CHANGELOG-conventions.md`]"
        "(docs/contracts/CHANGELOG-conventions.md).\n\n"
        "# Era: 3.2.x — current\n\n"
        "> Started at `3.2.0`. Full entries live inline below.\n"
        "> Cap 250 lines.\n\n"
        "## [3.2.5](https://example/compare/3.2.4...3.2.5) (2026-05-20)\n\n"
        "### Bug Fixes\n\n* fix something\n"
        f"{extra}\n\n"
        "# Era: pre-3.2.0 — archived\n\n"
        "> All entries before `3.2.0` live in\n"
        "> [`docs/archive/CHANGELOG-pre-3.2.0.md`](docs/archive/CHANGELOG-pre-3.2.0.md).\n"
    )


def test_plan_split_minor_bump_crosses_boundary(tmp_path: Path) -> None:
    _write_changelog(tmp_path, _era_3_2_body())
    plan = eras.plan_split("3.3.0")
    assert plan is not None
    assert plan.boundary == "3.3.0"
    assert plan.new_era_label == "3.3.x"
    assert plan.old_era_label == "3.2.x"
    assert plan.archive_path.name == "CHANGELOG-pre-3.3.0.md"
    assert "split era 3.2.x → pre-3.3.0" in plan.commit_subject


def test_plan_split_major_bump_crosses_boundary(tmp_path: Path) -> None:
    _write_changelog(tmp_path, _era_3_2_body())
    plan = eras.plan_split("4.0.0")
    assert plan is not None
    assert plan.boundary == "4.0.0"
    assert plan.new_era_label == "4.0.x"


def test_plan_split_patch_within_era_returns_none(tmp_path: Path) -> None:
    _write_changelog(tmp_path, _era_3_2_body())
    assert eras.plan_split("3.2.6") is None


def test_plan_split_backwards_release_refuses(tmp_path: Path) -> None:
    _write_changelog(tmp_path, _era_3_2_body())
    with pytest.raises(ValueError, match="older than current era"):
        eras.plan_split("3.1.0")


def test_plan_split_rejects_non_semver(tmp_path: Path) -> None:
    _write_changelog(tmp_path, _era_3_2_body())
    with pytest.raises(ValueError, match="not a bare semver"):
        eras.plan_split("3.3.0-rc1")


def test_perform_split_moves_entries_and_collapses_era(tmp_path: Path) -> None:
    _write_changelog(tmp_path, _era_3_2_body(extra_entry_lines=5))
    plan = eras.plan_split("3.3.0")
    assert plan is not None

    eras.perform_split(plan)

    assert plan.archive_path.exists()
    archive_text = plan.archive_path.read_text(encoding="utf-8")
    assert "Changelog Archive — pre-3.3.0" in archive_text
    assert "## [3.2.5]" in archive_text
    assert "entry line 0" in archive_text

    changelog = eras.CHANGELOG.read_text(encoding="utf-8")
    assert "# Era: 3.3.x — current" in changelog
    assert "# Era: pre-3.3.0 — archived" in changelog
    assert "## [3.2.5]" not in changelog  # moved to archive
    # Pre-existing pre-3.2.0 pointer must survive the split.
    assert "# Era: pre-3.2.0 — archived" in changelog


def test_perform_split_refuses_existing_archive(tmp_path: Path) -> None:
    _write_changelog(tmp_path, _era_3_2_body())
    plan = eras.plan_split("3.3.0")
    assert plan is not None
    plan.archive_path.parent.mkdir(parents=True, exist_ok=True)
    plan.archive_path.write_text("already here\n", encoding="utf-8")
    with pytest.raises(FileExistsError, match="archive already exists"):
        eras.perform_split(plan)


def test_current_era_insertion_point_with_existing_heading(tmp_path: Path) -> None:
    changelog = _write_changelog(tmp_path, _era_3_2_body())
    lines = changelog.read_text(encoding="utf-8").splitlines()
    idx = eras.current_era_insertion_point(lines)
    assert idx is not None
    assert lines[idx].startswith("## [3.2.5]")


def test_current_era_insertion_point_in_fresh_era(tmp_path: Path) -> None:
    body = (
        "# Changelog\n\n"
        "# Era: 3.3.x — current\n\n"
        "> Started at `3.3.0`. Full entries live inline below.\n"
        "> Cap 250 lines.\n\n"
        "# Era: pre-3.3.0 — archived\n\n"
        "> Pointer.\n"
    )
    changelog = _write_changelog(tmp_path, body)
    lines = changelog.read_text(encoding="utf-8").splitlines()
    idx = eras.current_era_insertion_point(lines)
    assert idx is not None
    next_era_idx = next(i for i, ln in enumerate(lines) if "pre-3.3.0" in ln)
    # Insertion point lands AT-OR-BEFORE the next era header so the new
    # entry slots into the current era block (insertion is before lines[idx]).
    assert idx <= next_era_idx
    # Insertion point must NOT land inside the intro blockquote.
    assert not lines[idx - 1].startswith(">") or lines[idx - 1] == ""
