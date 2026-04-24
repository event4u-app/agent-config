"""Tests for scripts/update_roadmap_progress.py — phase ID parsing.

Covers the three supported ID conventions (numeric, roman, letter) plus
a regression guard for headings that must NOT be picked up as phases.
The bug fixed here: upstream consumers (agent-memory) use `Phase A` /
`Phase I` headings; the old `\\d+`-only regex silently returned 0/0.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

# Import the source-of-truth copy; .agent-src/ is a regenerated mirror.
SRC = Path(__file__).resolve().parent.parent / ".agent-src.uncompressed" / "scripts"
sys.path.insert(0, str(SRC))
import update_roadmap_progress as urp  # noqa: E402


NUMERIC_FIXTURE = """\
# Roadmap — Numeric

## Phase 0 — Setup
- [x] done
- [ ] open
"""

ROMAN_FIXTURE = """\
# Roadmap — Roman

## Phase I — First
- [x] done

## Phase II — Second
- [ ] open
"""

LETTER_FIXTURE = """\
# Roadmap — Letter

## Phase A — Track A
- [x] done

### A1 · Sub · [Must]
- [x] sub-item

## Phase B — Track B
- [ ] open
"""


@pytest.fixture
def roadmaps_dir(tmp_path: Path) -> Path:
    root = tmp_path / "agents" / "roadmaps"
    root.mkdir(parents=True)
    (root / "numeric.md").write_text(NUMERIC_FIXTURE, encoding="utf-8")
    (root / "roman.md").write_text(ROMAN_FIXTURE, encoding="utf-8")
    (root / "letter.md").write_text(LETTER_FIXTURE, encoding="utf-8")
    return root


def test_numeric_ids_still_work(roadmaps_dir: Path):
    stats = urp.parse_roadmap(roadmaps_dir / "numeric.md", roadmaps_dir)
    assert stats is not None
    assert [p.id for p in stats.phases] == ["0"]
    assert stats.done == 1
    assert stats.open_ == 1


def test_roman_ids_parsed(roadmaps_dir: Path):
    stats = urp.parse_roadmap(roadmaps_dir / "roman.md", roadmaps_dir)
    assert stats is not None, "roman phase headings must parse"
    assert [p.id for p in stats.phases] == ["I", "II"]
    assert [p.name for p in stats.phases] == ["First", "Second"]
    assert stats.done == 1
    assert stats.open_ == 1


def test_letter_ids_parsed(roadmaps_dir: Path):
    stats = urp.parse_roadmap(roadmaps_dir / "letter.md", roadmaps_dir)
    assert stats is not None, "letter-track phase headings must parse"
    assert [p.id for p in stats.phases] == ["A", "B"]
    # H3 sub-heading `### A1 · Sub · [Must]` must NOT be promoted to a
    # phase — it has no "Phase " prefix.
    assert stats.done == 2  # one under Phase A, plus the A1 sub-item
    assert stats.open_ == 1


def test_collect_picks_up_all_three_styles(roadmaps_dir: Path):
    roadmaps = urp.collect(roadmaps_dir)
    assert len(roadmaps) == 3
    total_done = sum(r.done for r in roadmaps)
    total_open = sum(r.open_ for r in roadmaps)
    assert total_done == 4
    assert total_open == 3


@pytest.mark.parametrize(
    "heading, want_id",
    [
        ("## Phase 0 — Setup", "0"),
        ("## Phase 10 — Big", "10"),
        ("## Phase I — First", "I"),
        ("## Phase III — Third", "III"),
        ("## Phase XXXIX — boundary", "XXXIX"),
        ("## Phase A — Track A", "A"),
        ("## Phase A1 — Sub-track", "A1"),
        ("### Phase B: concurrent", "B"),
        ("## Phase 0: colon separator", "0"),
    ],
)
def test_regex_matches_supported_styles(heading: str, want_id: str):
    m = urp.PHASE_RE.match(heading)
    assert m is not None, f"expected match for {heading!r}"
    assert m.group(2) == want_id


@pytest.mark.parametrize(
    "heading",
    [
        # Anchor headings used as non-phase navigation inside real roadmaps.
        "## Phase overview",
        "## Phase — summary",
        # All-caps words starting with a roman letter must NOT match;
        # this is why the roman branch is [IVX]+ and not [IVXLCDM]+.
        "## Phase LIVE — not a phase",
        # Wrong heading levels.
        "# Phase 0 — too shallow",
        "#### Phase 0 — too deep",
        # Lowercase letter — reserved for non-phase content.
        "## Phase abc — lowercase",
    ],
)
def test_regex_rejects_non_phase_headings(heading: str):
    assert urp.PHASE_RE.match(heading) is None, (
        f"regex must NOT match {heading!r}"
    )


def test_render_emits_string_ids_in_table(roadmaps_dir: Path):
    """`p.id` is interpolated directly into the phase breakdown table;
    no `int(...)` cast on the roadmap-progress render path."""
    roadmaps = urp.collect(roadmaps_dir)
    output = urp.render(roadmaps)
    # Letter-track roadmap must surface its string IDs in the breakdown.
    assert "| A | Track A |" in output
    assert "| B | Track B |" in output
    # Roman-track roadmap too.
    assert "| I | First |" in output
    assert "| II | Second |" in output
