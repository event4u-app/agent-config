"""Engagement report renderer (Phase 4 Step 2).

Two output formats sharing one quartile-bucketing pass:

- **markdown** — human-friendly table grouped into Essential (top 20 %),
  Useful (mid 60 %), Retirement candidates (bottom 20 %).
- **json** — machine-readable summary; the same buckets, plus the
  raw aggregate metadata, so downstream tooling never re-parses
  the JSONL.

The bucketing is rank-based on ``applied`` count (the signal we care
about). Ties keep the deterministic order from
``aggregator.rank_artefacts``. Empty inputs yield an empty-but-valid
report — the renderer never raises on an empty log.
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any, Sequence

from .aggregator import AggregateResult, ArtefactStat, rank_artefacts
from .engagement import check_id_redaction

QUARTILE_TOP_RATIO = 0.20
QUARTILE_BOTTOM_RATIO = 0.20

BUCKET_TOP = "essential"
BUCKET_MID = "useful"
BUCKET_BOTTOM = "retirement_candidate"


@dataclass(frozen=True)
class BucketedStat:
    stat: ArtefactStat
    bucket: str


def bucketise(stats: Sequence[ArtefactStat]) -> list[BucketedStat]:
    """Assign each stat to a quartile bucket.

    Rank-based: indices ``[0, top_cut)`` → essential,
    ``[top_cut, bottom_cut)`` → useful, ``[bottom_cut, n)`` →
    retirement-candidate. Ranking from ``rank_artefacts`` is assumed.

    For very small samples the cuts collapse:
    n <= 1   → everything is essential
    n <= 4   → top 1 essential, rest useful, none retirement
    n  >= 5  → at least 1 in each bucket
    """
    n = len(stats)
    if n == 0:
        return []
    if n <= 1:
        return [BucketedStat(stat=stats[0], bucket=BUCKET_TOP)]
    top_cut = max(1, int(round(n * QUARTILE_TOP_RATIO)))
    bottom_cut = n - max(1, int(round(n * QUARTILE_BOTTOM_RATIO))) if n >= 5 else n
    if bottom_cut <= top_cut:
        bottom_cut = n  # mid takes the rest, no retirement bucket
    out: list[BucketedStat] = []
    for idx, stat in enumerate(stats):
        if idx < top_cut:
            bucket = BUCKET_TOP
        elif idx < bottom_cut:
            bucket = BUCKET_MID
        else:
            bucket = BUCKET_BOTTOM
        out.append(BucketedStat(stat=stat, bucket=bucket))
    return out


def render_markdown(
    aggregate: AggregateResult,
    *,
    top: int | None = None,
    since_label: str | None = None,
) -> str:
    """Render a markdown report. ``top`` truncates each bucket; ``None`` keeps all."""
    ranked = rank_artefacts(aggregate.stats())
    bucketed = bucketise(ranked)
    grouped: dict[str, list[BucketedStat]] = {BUCKET_TOP: [], BUCKET_MID: [], BUCKET_BOTTOM: []}
    for entry in bucketed:
        grouped[entry.bucket].append(entry)

    lines: list[str] = []
    lines.append("# Artefact Engagement Report")
    lines.append("")
    lines.append(f"- events parsed: **{aggregate.parsed_events}**")
    lines.append(f"- events skipped (malformed): **{aggregate.skipped_lines}**")
    if since_label:
        lines.append(f"- window: **{since_label}**")
    if aggregate.earliest_ts and aggregate.latest_ts:
        lines.append(f"- ts range: `{aggregate.earliest_ts}` → `{aggregate.latest_ts}`")
    lines.append("")

    titles = {
        BUCKET_TOP: "Essential (top 20 %)",
        BUCKET_MID: "Useful (mid 60 %)",
        BUCKET_BOTTOM: "Retirement candidates (bottom 20 %)",
    }
    for bucket in (BUCKET_TOP, BUCKET_MID, BUCKET_BOTTOM):
        rows = grouped[bucket]
        if top is not None:
            rows = rows[:top]
        lines.append(f"## {titles[bucket]}")
        lines.append("")
        if not rows:
            lines.append("_(none)_")
            lines.append("")
            continue
        lines.append("| kind | id | consulted | applied | applied/consulted | last seen |")
        lines.append("|---|---|---:|---:|---:|---|")
        for entry in rows:
            s = entry.stat
            # Phase 5 export gate — applies to markdown too, not just JSON.
            check_id_redaction(f"buckets.{s.kind}.id", s.artefact_id)
            lines.append(
                f"| {s.kind} | `{s.artefact_id}` | {s.consulted} | {s.applied} "
                f"| {s.applied_ratio:.2f} | `{s.last_seen_ts}` |"
            )
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def render_json(
    aggregate: AggregateResult,
    *,
    top: int | None = None,
    since_label: str | None = None,
) -> str:
    ranked = rank_artefacts(aggregate.stats())
    bucketed = bucketise(ranked)
    grouped: dict[str, list[dict[str, Any]]] = {BUCKET_TOP: [], BUCKET_MID: [], BUCKET_BOTTOM: []}
    for entry in bucketed:
        grouped[entry.bucket].append(_stat_to_dict(entry.stat))
    if top is not None:
        for bucket in grouped:
            grouped[bucket] = grouped[bucket][:top]
    payload = {
        "schema_version": 1,
        "summary": {
            "parsed_events": aggregate.parsed_events,
            "skipped_lines": aggregate.skipped_lines,
            "total_events": aggregate.total_events,
            "earliest_ts": aggregate.earliest_ts,
            "latest_ts": aggregate.latest_ts,
            "since_label": since_label,
        },
        "buckets": grouped,
    }
    return json.dumps(payload, sort_keys=True, indent=2) + "\n"


def _stat_to_dict(stat: ArtefactStat) -> dict[str, Any]:
    # Phase 5 export gate: every id leaving the renderer is re-validated
    # against the same redaction floor that the schema enforces on
    # write. A pre-validator log (or one hand-edited offline) can never
    # leak path-shaped or free-text content into a shared report.
    check_id_redaction(f"buckets.{stat.kind}.id", stat.artefact_id)
    return {
        "kind": stat.kind,
        "id": stat.artefact_id,
        "consulted": stat.consulted,
        "applied": stat.applied,
        "applied_ratio": round(stat.applied_ratio, 4),
        "last_seen_ts": stat.last_seen_ts,
    }


__all__ = ["BucketedStat", "bucketise", "render_markdown", "render_json"]
