"""Drift gate for CHANGELOG.md era discipline.

Enforces the conventions documented in
``docs/contracts/CHANGELOG-conventions.md``:

* ``CHANGELOG.md`` MUST contain at least one ``# Era: X.Y.x — current``
  header and the body of that current era MUST stay under 200 lines.
* Every era declared in ``CHANGELOG.md`` other than ``current`` MUST
  point at an archive file under ``docs/archive/`` that exists.
* The conventions doc MUST be linked from the CHANGELOG header so the
  contract is discoverable from the file it governs.
"""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CHANGELOG = ROOT / "CHANGELOG.md"
CONVENTIONS = ROOT / "docs" / "contracts" / "CHANGELOG-conventions.md"
ARCHIVE_DIR = ROOT / "docs" / "archive"

CURRENT_ERA_BODY_CAP = 200

ERA_HEADER_RE = re.compile(r"^# Era: (?P<label>[^\n]+?)(?: — (?P<state>current|archived))?\s*$")
ARCHIVE_LINK_RE = re.compile(r"\(docs/archive/(CHANGELOG-pre-[^)\s]+\.md)\)")


def _read_lines() -> list[str]:
    return CHANGELOG.read_text(encoding="utf-8").splitlines()


def _era_spans(lines: list[str]) -> list[tuple[int, str, str]]:
    """Return list of (line_index, label, state) for every era header."""
    spans: list[tuple[int, str, str]] = []
    for i, line in enumerate(lines):
        m = ERA_HEADER_RE.match(line)
        if m:
            spans.append((i, m.group("label"), m.group("state") or ""))
    return spans


def test_changelog_has_current_era() -> None:
    lines = _read_lines()
    spans = _era_spans(lines)
    current = [s for s in spans if s[2] == "current"]
    assert current, (
        "CHANGELOG.md must declare exactly one '# Era: X.Y.x — current' "
        "section. See docs/contracts/CHANGELOG-conventions.md § Era splits."
    )
    assert len(current) == 1, (
        f"CHANGELOG.md must declare exactly ONE current era, found {len(current)}: "
        f"{[c[1] for c in current]}"
    )


def test_current_era_body_under_cap() -> None:
    lines = _read_lines()
    spans = _era_spans(lines)
    current_idx = next(i for i, _, state in spans if state == "current")
    # Find the next era header after the current one (era ordering is
    # current first, archived eras follow).
    next_era_line = len(lines)
    for i, _, _ in spans:
        if i > current_idx:
            next_era_line = i
            break
    body_size = next_era_line - current_idx - 1
    assert body_size <= CURRENT_ERA_BODY_CAP, (
        f"Current era body is {body_size} lines (cap {CURRENT_ERA_BODY_CAP}). "
        "Split a new era per docs/contracts/CHANGELOG-conventions.md § Era splits."
    )


def test_archived_eras_point_at_existing_files() -> None:
    lines = _read_lines()
    text = "\n".join(lines)
    spans = _era_spans(lines)
    archived = [(i, label) for i, label, state in spans if state == "archived"]
    for line_idx, label in archived:
        # Look ahead a small window after the era header for the archive
        # link in the form (docs/archive/CHANGELOG-pre-X.Y.Z.md).
        window = "\n".join(lines[line_idx : line_idx + 8])
        matches = ARCHIVE_LINK_RE.findall(window)
        assert matches, (
            f"Archived era '{label}' at line {line_idx + 1} must link to a "
            "file under docs/archive/CHANGELOG-pre-*.md within the next few "
            "lines of its header."
        )
        for archive_name in matches:
            archive_path = ARCHIVE_DIR / archive_name
            assert archive_path.exists(), (
                f"Era '{label}' links to {archive_path} but the archive "
                "file does not exist. Create the archive or update the link."
            )


def test_conventions_doc_linked_from_changelog() -> None:
    lines = _read_lines()
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
