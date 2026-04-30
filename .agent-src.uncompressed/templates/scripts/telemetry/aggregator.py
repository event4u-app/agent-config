"""Engagement-log aggregator (Phase 4).

Pure-stdlib reader: streams ``.agent-engagement.jsonl``, groups events by
``(kind, id)``, and returns per-artefact statistics. The renderer in
``report_renderer.py`` consumes the dataclasses produced here.

Design contract:

- **Skip, don't crash.** Malformed JSONL lines are counted in
  ``AggregateResult.skipped_lines`` and dropped. Phase 4 Step 4 locks
  this behaviour: a single corrupt line in a 10k-line log must not
  block the report.
- **No IO besides the log read.** No network, no settings reads, no
  log creation. Caller (CLI) is responsible for feeding a real path.
- **``since`` is exclusive on the lower bound** — ``since`` of
  ``2026-04-01T00:00:00Z`` keeps events with ``ts > since``. ``None``
  means "include everything".
- **Stats are sort-stable.** ``rank_artefacts`` returns a list ordered
  by ``applied`` desc, ``consulted`` desc, then ``(kind, id)`` asc, so
  two reports over the same log render byte-identical.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, Iterator

from .engagement import EngagementEvent, EngagementSchemaError, parse_event


@dataclass(frozen=True)
class ArtefactStat:
    kind: str
    artefact_id: str
    consulted: int
    applied: int
    last_seen_ts: str

    @property
    def applied_ratio(self) -> float:
        """Applied / consulted. ``0.0`` when never consulted (impossible
        in practice — applied is a strict subset of consulted — but the
        guard keeps the division safe for malformed inputs)."""
        return (self.applied / self.consulted) if self.consulted else 0.0


@dataclass
class AggregateResult:
    total_events: int = 0
    parsed_events: int = 0
    skipped_lines: int = 0
    earliest_ts: str | None = None
    latest_ts: str | None = None
    artefacts: dict[tuple[str, str], dict[str, object]] = field(default_factory=dict)

    def stats(self) -> list[ArtefactStat]:
        """Materialise the accumulated buckets as immutable stats."""
        out: list[ArtefactStat] = []
        for (kind, art_id), bucket in self.artefacts.items():
            out.append(
                ArtefactStat(
                    kind=kind,
                    artefact_id=art_id,
                    consulted=int(bucket["consulted"]),
                    applied=int(bucket["applied"]),
                    last_seen_ts=str(bucket["last_seen_ts"]),
                )
            )
        return out


def _parse_iso(ts: str) -> datetime | None:
    """Parse a ``%Y-%m-%dT%H:%M:%SZ`` stamp into UTC. Returns ``None``
    for malformed stamps so the caller can skip the comparison cleanly.
    """
    if not isinstance(ts, str) or not ts:
        return None
    try:
        # strptime with literal Z handles the ``now_utc_iso`` format.
        return datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _iter_events(log_path: Path) -> Iterator[tuple[int, EngagementEvent | None]]:
    """Yield ``(line_number, event_or_None)``. ``None`` signals a skip."""
    if not log_path.is_file():
        return
    with log_path.open("r", encoding="utf-8") as fh:
        for line_no, line in enumerate(fh, start=1):
            stripped = line.strip()
            if not stripped:
                continue
            try:
                event = parse_event(stripped + "\n")
            except EngagementSchemaError:
                yield line_no, None
                continue
            yield line_no, event


def aggregate(
    log_path: Path,
    *,
    since: datetime | None = None,
) -> AggregateResult:
    """Stream the JSONL log and compute per-artefact stats."""
    result = AggregateResult()
    for _line_no, event in _iter_events(log_path):
        result.total_events += 1
        if event is None:
            result.skipped_lines += 1
            continue
        ts = _parse_iso(event.ts)
        if since is not None and ts is not None and ts <= since:
            continue
        result.parsed_events += 1
        if result.earliest_ts is None or event.ts < result.earliest_ts:
            result.earliest_ts = event.ts
        if result.latest_ts is None or event.ts > result.latest_ts:
            result.latest_ts = event.ts
        _accumulate(result.artefacts, event.consulted, event.applied, event.ts)
    return result


def _accumulate(
    bucket: dict[tuple[str, str], dict[str, object]],
    consulted: dict[str, list[str]],
    applied: dict[str, list[str]],
    ts: str,
) -> None:
    for kind, ids in consulted.items():
        for art_id in ids:
            entry = bucket.setdefault((kind, art_id), {"consulted": 0, "applied": 0, "last_seen_ts": ""})
            entry["consulted"] = int(entry["consulted"]) + 1  # type: ignore[operator]
            if ts > str(entry["last_seen_ts"]):
                entry["last_seen_ts"] = ts
    for kind, ids in applied.items():
        for art_id in ids:
            entry = bucket.setdefault((kind, art_id), {"consulted": 0, "applied": 0, "last_seen_ts": ""})
            entry["applied"] = int(entry["applied"]) + 1  # type: ignore[operator]
            if ts > str(entry["last_seen_ts"]):
                entry["last_seen_ts"] = ts


def rank_artefacts(stats: Iterable[ArtefactStat]) -> list[ArtefactStat]:
    return sorted(
        stats,
        key=lambda s: (-s.applied, -s.consulted, s.kind, s.artefact_id),
    )


__all__ = ["ArtefactStat", "AggregateResult", "aggregate", "rank_artefacts"]
