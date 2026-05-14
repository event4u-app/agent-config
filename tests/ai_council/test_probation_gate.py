"""Probation gate contract (Phase 12, Step 3)."""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from scripts.ai_council.probation_gate import (  # noqa: E402
    PROMOTION_THRESHOLD,
    WINDOW_DAYS,
    run_gate,
)


_BASE = """# Low-Impact Decisions Corpus

## On Probation

{probation}

## Validated

{validated}

## Anti-Examples (Always Ask User)

- "irrelevant" — placeholder

## Security & Privacy Floor

floor text.

## Provenance

last-upstreamed: 0000000000000000000000000000000000000000
"""


def _corpus(tmp_path: Path, probation: str = "", validated: str = "") -> Path:
    p = tmp_path / "low-impact-decisions.md"
    p.write_text(
        _BASE.format(probation=probation, validated=validated),
        encoding="utf-8",
    )
    return p


def _d(s: str) -> datetime:
    return datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=timezone.utc)


def test_noop_on_empty_sections(tmp_path: Path) -> None:
    corpus = _corpus(tmp_path)
    res = run_gate(corpus, today=_d("2026-05-14"))
    assert res.is_noop


def test_prunes_stale_timestamp(tmp_path: Path) -> None:
    body = '- "X?" — first-seen 2026-01-01 · seen [2026-01-01, 2026-05-10]'
    corpus = _corpus(tmp_path, probation=body)
    res = run_gate(corpus, today=_d("2026-05-14"))
    assert res.pruned_timestamps == 1
    assert res.promoted_entries == 0
    assert res.dropped_entries == 0
    txt = corpus.read_text(encoding="utf-8")
    # first-seen marker is preserved by design; only the seen[] array is pruned.
    assert "seen [2026-05-10]" in txt
    assert "seen [2026-01-01" not in txt


def test_drops_fully_expired_entry(tmp_path: Path) -> None:
    body = '- "X?" — first-seen 2025-01-01 · seen [2025-01-01]'
    corpus = _corpus(tmp_path, probation=body)
    res = run_gate(corpus, today=_d("2026-05-14"))
    assert res.dropped_entries == 1
    txt = corpus.read_text(encoding="utf-8")
    assert '"X?"' not in txt


def test_promotes_at_threshold(tmp_path: Path) -> None:
    body = (
        '- "X?" — first-seen 2026-05-01 · '
        'seen [2026-05-01, 2026-05-05, 2026-05-10]'
    )
    corpus = _corpus(tmp_path, probation=body)
    res = run_gate(corpus, today=_d("2026-05-14"))
    assert res.promoted_entries == 1
    txt = corpus.read_text(encoding="utf-8")
    val_section = txt.split("## Validated")[1].split("## Anti-Examples")[0]
    assert '"X?"' in val_section
    assert "validated 2026-05-14" in val_section
    # probation section no longer carries it
    prob_section = txt.split("## On Probation")[1].split("## Validated")[0]
    assert '"X?"' not in prob_section


def test_does_not_promote_below_threshold(tmp_path: Path) -> None:
    body = (
        '- "X?" — first-seen 2026-05-01 · seen [2026-05-01, 2026-05-05]'
    )
    corpus = _corpus(tmp_path, probation=body)
    res = run_gate(corpus, today=_d("2026-05-14"))
    assert res.promoted_entries == 0


def test_stale_timestamps_do_not_count_toward_promotion(tmp_path: Path) -> None:
    # 4 seens but 2 are outside the 30-day window → only 2 count → no promote.
    body = (
        '- "X?" — first-seen 2026-01-01 · '
        'seen [2026-01-01, 2026-02-01, 2026-05-05, 2026-05-10]'
    )
    corpus = _corpus(tmp_path, probation=body)
    res = run_gate(corpus, today=_d("2026-05-14"))
    assert res.promoted_entries == 0
    assert res.pruned_timestamps == 2


def test_idempotent_second_run(tmp_path: Path) -> None:
    body = '- "X?" — first-seen 2026-05-01 · seen [2026-05-05, 2026-05-10]'
    corpus = _corpus(tmp_path, probation=body)
    first = run_gate(corpus, today=_d("2026-05-14"))
    second = run_gate(corpus, today=_d("2026-05-14"))
    assert first.is_noop or second.is_noop
    assert second.is_noop


def test_log_line_format() -> None:
    from scripts.ai_council.probation_gate import GateRun
    line = GateRun(2, 1, 1).log_line()
    assert "pruned 2" in line
    assert "promoted 1" in line
    assert "dropped 1" in line


def test_constants() -> None:
    assert WINDOW_DAYS == 30
    assert PROMOTION_THRESHOLD == 3
