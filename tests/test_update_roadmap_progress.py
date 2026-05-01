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



COMPLETE_FIXTURE = """\
# Roadmap — All Done

## Phase 1 — Wrap-up
- [x] one
- [x] two
"""

EMPTY_FIXTURE = """\
# Roadmap — Stub

## Phase 1 — TBD
"""

SKIPPED_ONLY_FIXTURE = """\
# Roadmap — Skipped Only

## Phase 1 — Decisions
- [~] deferred
- [-] cancelled
"""


def test_unarchived_complete_flags_only_done_roadmaps(tmp_path: Path):
    root = tmp_path / "agents" / "roadmaps"
    root.mkdir(parents=True)
    (root / "complete.md").write_text(COMPLETE_FIXTURE, encoding="utf-8")
    (root / "stub.md").write_text(EMPTY_FIXTURE, encoding="utf-8")
    (root / "skipped-only.md").write_text(SKIPPED_ONLY_FIXTURE, encoding="utf-8")
    (root / "numeric.md").write_text(NUMERIC_FIXTURE, encoding="utf-8")
    roadmaps = urp.collect(root)
    flagged = urp.unarchived_complete(roadmaps)
    rels = sorted(r.rel for r in flagged)
    # Only the truly-complete roadmap is flagged: stubs and skipped-only
    # have total_active == 0, partial roadmaps still have open items.
    assert rels == ["complete.md"]


def test_unarchived_complete_ignores_archive_dir(tmp_path: Path):
    root = tmp_path / "agents" / "roadmaps"
    archive = root / "archive"
    archive.mkdir(parents=True)
    (archive / "complete.md").write_text(COMPLETE_FIXTURE, encoding="utf-8")
    roadmaps = urp.collect(root)
    # collect() already excludes archive/, so the archived roadmap is not
    # in the list and unarchived_complete() returns nothing.
    assert urp.collect(root) == []
    assert urp.unarchived_complete(roadmaps) == []


def _run_main(monkeypatch: pytest.MonkeyPatch, repo_root: Path, *args: str) -> int:
    monkeypatch.setattr(sys, "argv", ["update_roadmap_progress.py",
                                       "--repo-root", str(repo_root), *args])
    return urp.main()


def test_check_mode_fails_on_unarchived_complete(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture
):
    root = tmp_path / "agents" / "roadmaps"
    root.mkdir(parents=True)
    (root / "complete.md").write_text(COMPLETE_FIXTURE, encoding="utf-8")
    # Pre-write a fresh dashboard so staleness alone can't be the reason
    # for the failure.
    rc = _run_main(monkeypatch, tmp_path)
    assert rc == 0
    rc = _run_main(monkeypatch, tmp_path, "--check")
    captured = capsys.readouterr()
    assert rc == 1
    assert "Completed roadmaps are still in" in captured.err
    assert "complete.md" in captured.err


def test_check_mode_passes_when_complete_is_archived(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
):
    root = tmp_path / "agents" / "roadmaps"
    archive = root / "archive"
    archive.mkdir(parents=True)
    (archive / "complete.md").write_text(COMPLETE_FIXTURE, encoding="utf-8")
    rc = _run_main(monkeypatch, tmp_path)
    assert rc == 0
    rc = _run_main(monkeypatch, tmp_path, "--check")
    assert rc == 0


def test_write_mode_warns_but_does_not_fail(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture
):
    root = tmp_path / "agents" / "roadmaps"
    root.mkdir(parents=True)
    (root / "complete.md").write_text(COMPLETE_FIXTURE, encoding="utf-8")
    rc = _run_main(monkeypatch, tmp_path)
    captured = capsys.readouterr()
    assert rc == 0  # warn-only on write path
    assert "not yet archived" in captured.err
    assert "complete.md" in captured.err


# ---------------------------------------------------------------------------
# Column semantics — `Steps` must include deferred + cancelled, and the
# overall-table column order must be `Steps | Open | Done | Deferred |
# Cancelled` so each row's arithmetic adds up:
#     Steps − Done − Deferred − Cancelled = Open
# Regression guard for the dashboard rewrite that flipped Steps from
# `done + open_` (active subset) to `total_all`.
# ---------------------------------------------------------------------------

MIXED_FIXTURE = """\
# Roadmap — Mixed states

## Phase 1 — Spread
- [x] one done
- [x] two done
- [ ] three open
- [~] four deferred
- [-] five cancelled
"""


def test_total_all_includes_deferred_and_cancelled():
    stats = urp.parse_roadmap.__wrapped__ if hasattr(urp.parse_roadmap, "__wrapped__") else urp.parse_roadmap
    p = urp.PhaseStats(id="1", name="Spread",
                       done=2, open_=1, deferred=1, cancelled=1)
    assert p.total_active == 3
    assert p.total_all == 5  # 2 + 1 + 1 + 1
    r = urp.RoadmapStats(path=Path("x.md"), rel="x.md", title="x",
                         phases=[p])
    assert r.total_all == 5
    assert r.total_active == 3


def test_overall_table_column_order_and_arithmetic(tmp_path: Path):
    root = tmp_path / "agents" / "roadmaps"
    root.mkdir(parents=True)
    (root / "mixed.md").write_text(MIXED_FIXTURE, encoding="utf-8")
    roadmaps = urp.collect(root)
    assert len(roadmaps) == 1
    output = urp.render(roadmaps)
    # Header order must be Steps | Open | Done | Deferred | Cancelled.
    assert "| # | Roadmap | Phases | Steps | Open | Done | Deferred | Cancelled | Progress |" in output
    # Row arithmetic: Steps=5, Open=1, Done=2, Deferred=1, Cancelled=1.
    assert "| 1 | [mixed.md](roadmaps/mixed.md) | 1 | 5 | 1 | 2 | 1 | 1 |" in output


def test_per_phase_breakdown_column_order(tmp_path: Path):
    root = tmp_path / "agents" / "roadmaps"
    root.mkdir(parents=True)
    (root / "mixed.md").write_text(MIXED_FIXTURE, encoding="utf-8")
    roadmaps = urp.collect(root)
    output = urp.render(roadmaps)
    # Phase breakdown header — Open before Done, same as overall.
    assert "| # | Phase | State | Open | Done | Deferred | Cancelled | % |" in output
    # Row: id=1, name=Spread, state=in progress, Open=1, Done=2, Def=1, Can=1.
    assert "| 1 | Spread | 🟡 in progress | 1 | 2 | 1 | 1 |" in output
