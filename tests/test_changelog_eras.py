"""Drift gate for CHANGELOG.md era discipline.

Enforces the conventions documented in
``docs/contracts/CHANGELOG-conventions.md``:

* ``CHANGELOG.md`` MUST contain at least one ``# Era: X.Y.x — current``
  header and the body of that current era MUST stay under 250 lines.
* Every era declared in ``CHANGELOG.md`` other than ``current`` MUST
  point at an archive file under ``docs/archive/`` that exists.
* The conventions doc MUST be linked from the CHANGELOG header so the
  contract is discoverable from the file it governs.

The cap, regex, and span helpers live in
``scripts/_lib/changelog_eras.py`` so this gate and
``scripts/release.py`` cannot drift apart (Phase 3 Step 2 of
``agents/roadmaps/road-to-changelog-era-auto-split.md``).
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from scripts._lib.changelog_eras import (  # noqa: E402
    ARCHIVE_DIR,
    ARCHIVE_LINK_RE,
    CHANGELOG,
    CONVENTIONS,
    CURRENT_ERA_BODY_CAP,
    current_era_body_size,
    era_spans,
    read_changelog_lines,
)


def test_changelog_has_current_era() -> None:
    lines = read_changelog_lines()
    spans = era_spans(lines)
    current = [s for s in spans if s.state == "current"]
    assert current, (
        "CHANGELOG.md must declare exactly one '# Era: X.Y.x — current' "
        "section. See docs/contracts/CHANGELOG-conventions.md § Era splits."
    )
    assert len(current) == 1, (
        f"CHANGELOG.md must declare exactly ONE current era, found {len(current)}: "
        f"{[c.label for c in current]}"
    )


def test_current_era_body_under_cap() -> None:
    lines = read_changelog_lines()
    body_size = current_era_body_size(lines)
    assert body_size <= CURRENT_ERA_BODY_CAP, (
        f"Current era body is {body_size} lines (cap {CURRENT_ERA_BODY_CAP}). "
        "Run `task release` — `scripts/release.py` will split the era "
        "automatically before bumping. If you hit this from a non-release "
        "edit (Unreleased section, hotfix entry), pick the boundary "
        "manually per `docs/contracts/CHANGELOG-conventions.md` § Era "
        "splits and re-run."
    )


def test_archived_eras_point_at_existing_files() -> None:
    lines = read_changelog_lines()
    spans = era_spans(lines)
    archived = [s for s in spans if s.state == "archived"]
    for span in archived:
        # Look ahead a small window after the era header for the archive
        # link in the form (docs/archive/CHANGELOG-pre-X.Y.Z.md).
        window = "\n".join(lines[span.line_index : span.line_index + 8])
        matches = ARCHIVE_LINK_RE.findall(window)
        assert matches, (
            f"Archived era '{span.label}' at line {span.line_index + 1} must "
            "link to a file under docs/archive/CHANGELOG-pre-*.md within "
            "the next few lines of its header."
        )
        for archive_name in matches:
            archive_path = ARCHIVE_DIR / archive_name
            assert archive_path.exists(), (
                f"Era '{span.label}' links to {archive_path} but the archive "
                "file does not exist. Create the archive or update the link."
            )


def test_conventions_doc_linked_from_changelog() -> None:
    lines = read_changelog_lines()
    header = "\n".join(lines[:30])
    assert "docs/contracts/CHANGELOG-conventions.md" in header, (
        "CHANGELOG.md header (first 30 lines) must link to "
        "docs/contracts/CHANGELOG-conventions.md so the entry-shape "
        "contract is discoverable from the file it governs."
    )


def test_conventions_doc_exists() -> None:
    assert CONVENTIONS.exists(), (
        f"{CONVENTIONS.relative_to(ROOT)} must exist — it is the "
        "normative source for CHANGELOG.md entry shape and era discipline."
    )
