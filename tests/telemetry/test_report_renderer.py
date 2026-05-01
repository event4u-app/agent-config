"""Phase 4 Step 4 — report renderer tests.

Coverage:

- Empty aggregate → both formats render without error; markdown shows
  ``_(none)_`` per bucket; json contains empty bucket arrays.
- Bucketing edge cases: n=1, n=4 (no retirement bucket), n=5 (all
  three buckets populated), n=10 (deterministic 20/60/20 split).
- ``top`` truncates each bucket independently.
- ``since_label`` is propagated into both renderers.
"""
from __future__ import annotations

import json

from telemetry.aggregator import AggregateResult, ArtefactStat
from telemetry.report_renderer import (
    BUCKET_BOTTOM,
    BUCKET_MID,
    BUCKET_TOP,
    bucketise,
    render_json,
    render_markdown,
)


def _stat(name: str, *, applied: int = 1, consulted: int = 1) -> ArtefactStat:
    return ArtefactStat(
        kind="skills",
        artefact_id=name,
        consulted=consulted,
        applied=applied,
        last_seen_ts="2026-04-30T12:00:00Z",
    )


def _result_with(stats: list[ArtefactStat]) -> AggregateResult:
    res = AggregateResult(parsed_events=len(stats), total_events=len(stats))
    for s in stats:
        res.artefacts[(s.kind, s.artefact_id)] = {
            "consulted": s.consulted,
            "applied": s.applied,
            "last_seen_ts": s.last_seen_ts,
        }
    return res


def test_bucketise_empty_returns_empty() -> None:
    assert bucketise([]) == []


def test_bucketise_single_entry_is_essential() -> None:
    bucketed = bucketise([_stat("a")])
    assert [b.bucket for b in bucketed] == [BUCKET_TOP]


def test_bucketise_small_sample_no_retirement() -> None:
    # n=4 → top=1, rest mid, no retirement bucket (n < 5 collapses bottom)
    stats = [_stat(c) for c in "abcd"]
    bucketed = bucketise(stats)
    buckets = [b.bucket for b in bucketed]
    assert buckets[0] == BUCKET_TOP
    assert all(b == BUCKET_MID for b in buckets[1:])
    assert BUCKET_BOTTOM not in buckets


def test_bucketise_n5_populates_all_three_buckets() -> None:
    stats = [_stat(c) for c in "abcde"]
    bucketed = bucketise(stats)
    buckets = [b.bucket for b in bucketed]
    assert buckets.count(BUCKET_TOP) >= 1
    assert buckets.count(BUCKET_MID) >= 1
    assert buckets.count(BUCKET_BOTTOM) >= 1


def test_bucketise_n10_is_20_60_20() -> None:
    stats = [_stat(str(i)) for i in range(10)]
    bucketed = bucketise(stats)
    counts = {BUCKET_TOP: 0, BUCKET_MID: 0, BUCKET_BOTTOM: 0}
    for b in bucketed:
        counts[b.bucket] += 1
    assert counts[BUCKET_TOP] == 2
    assert counts[BUCKET_MID] == 6
    assert counts[BUCKET_BOTTOM] == 2


def test_render_markdown_empty_aggregate_shows_none_per_bucket() -> None:
    output = render_markdown(AggregateResult())
    assert "# Artefact Engagement Report" in output
    assert "events parsed: **0**" in output
    assert output.count("_(none)_") == 3


def test_render_markdown_includes_since_label() -> None:
    output = render_markdown(AggregateResult(), since_label="last 7d")
    assert "window: **last 7d**" in output


def test_render_markdown_top_truncates_each_bucket() -> None:
    stats = [_stat(str(i), applied=10 - i) for i in range(10)]
    res = _result_with(stats)
    output = render_markdown(res, top=1)
    # 1 row per bucket → 3 data rows in total across 3 tables
    rows = [line for line in output.splitlines() if line.startswith("| skills")]
    assert len(rows) == 3


def test_render_json_empty_is_valid_and_has_buckets() -> None:
    payload = json.loads(render_json(AggregateResult()))
    assert payload["schema_version"] == 1
    assert payload["summary"]["parsed_events"] == 0
    assert payload["buckets"] == {
        BUCKET_TOP: [],
        BUCKET_MID: [],
        BUCKET_BOTTOM: [],
    }


def test_render_json_includes_ratio_rounded() -> None:
    stats = [_stat("a", applied=1, consulted=3)]
    payload = json.loads(render_json(_result_with(stats)))
    entry = payload["buckets"][BUCKET_TOP][0]
    assert entry["id"] == "a"
    assert entry["consulted"] == 3
    assert entry["applied"] == 1
    assert entry["applied_ratio"] == 0.3333


def test_render_json_propagates_since_label() -> None:
    payload = json.loads(render_json(AggregateResult(), since_label="last 30d"))
    assert payload["summary"]["since_label"] == "last 30d"
