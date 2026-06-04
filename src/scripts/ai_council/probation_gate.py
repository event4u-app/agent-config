"""Probation promote-and-prune for ``agents/decisions/low-impact-decisions.md``.

Phase 12 § Step 3. Runs at council startup AND after every intake
append. Idempotent — a second run on an unchanged corpus is a no-op.

Rules:

- **Prune.** For each ``## On Probation`` entry, drop any ``seen``
  timestamp older than ``WINDOW_DAYS`` (default 30) from ``today``
  (UTC). If the ``seen`` array empties, drop the whole entry.
- **Promote.** If the trimmed ``seen`` array has ≥ ``PROMOTION_THRESHOLD``
  entries (default 3), move the entry to ``## Validated`` — strip the
  ``seen`` array, add ``validated <today>`` marker. One-way: a
  Validated entry never falls back.
- **Log.** Returns :class:`GateRun` with the counts, suitable for
  one-line session-artefact logging.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path

WINDOW_DAYS = 30
PROMOTION_THRESHOLD = 3

_PROBATION_HEADER = "## On Probation"
_VALIDATED_HEADER = "## Validated"
_TERMINAL_HEADERS = (
    "## Anti-Examples",
    "## Security",
    "## Provenance",
)


@dataclass(frozen=True)
class GateRun:
    pruned_timestamps: int
    dropped_entries: int
    promoted_entries: int

    def log_line(self) -> str:
        return (
            f"probation-gate: pruned {self.pruned_timestamps} stale "
            f"timestamps; promoted {self.promoted_entries} entries; "
            f"dropped {self.dropped_entries} expired entries"
        )

    @property
    def is_noop(self) -> bool:
        return (self.pruned_timestamps == 0
                and self.dropped_entries == 0
                and self.promoted_entries == 0)


def _today() -> datetime:
    return datetime.now(timezone.utc)


def _section_span(text: str, header: str) -> tuple[int, int] | None:
    i = text.find(header)
    if i < 0:
        return None
    body_start = text.find("\n", i) + 1
    end = len(text)
    for other in (_PROBATION_HEADER, _VALIDATED_HEADER) + _TERMINAL_HEADERS:
        if other == header:
            continue
        j = text.find("\n" + other, body_start)
        if 0 <= j < end:
            end = j
    return body_start, end


def _parse_probation_line(line: str) -> tuple[str, str, list[str]] | None:
    m = re.match(
        r'^(\s*-\s*"[^"]+")\s*—\s*first-seen\s+(\d{4}-\d{2}-\d{2})'
        r'\s*·\s*seen\s*\[([^\]]*)\]\s*$',
        line,
    )
    if not m:
        return None
    prefix = m.group(1)
    first_seen = m.group(2)
    seen_raw = m.group(3).strip()
    seen = [s.strip() for s in seen_raw.split(",") if s.strip()] if seen_raw else []
    return prefix, first_seen, seen


def _parse_date(s: str) -> datetime | None:
    try:
        return datetime.strptime(s, "%Y-%m-%d").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def run_gate(corpus_path: Path, *, today: datetime | None = None) -> GateRun:
    """Promote-and-prune pass. Writes corpus only when state changes."""
    today = today or _today()
    cutoff = today - timedelta(days=WINDOW_DAYS)
    text = corpus_path.read_text(encoding="utf-8")
    prob = _section_span(text, _PROBATION_HEADER)
    val = _section_span(text, _VALIDATED_HEADER)
    if not prob or not val:
        return GateRun(0, 0, 0)

    prob_body = text[prob[0]:prob[1]]
    promoted: list[str] = []
    pruned_ts = 0
    dropped = 0
    out_lines: list[str] = []
    for line in prob_body.splitlines():
        parsed = _parse_probation_line(line)
        if parsed is None:
            out_lines.append(line)
            continue
        prefix, first_seen, seen = parsed
        original_len = len(seen)
        fresh = [
            s for s in seen
            if (d := _parse_date(s)) is not None and d >= cutoff
        ]
        pruned_ts += original_len - len(fresh)
        if len(fresh) >= PROMOTION_THRESHOLD:
            today_str = today.strftime("%Y-%m-%d")
            promoted.append(
                f'{prefix} — domain: low-impact · validated {today_str}'
            )
            continue
        if not fresh:
            dropped += 1
            continue
        out_lines.append(
            f'{prefix} — first-seen {first_seen} · seen [{", ".join(fresh)}]'
        )

    new_prob_body = "\n".join(out_lines)
    if not new_prob_body.endswith("\n"):
        new_prob_body += "\n"

    new_text = text[:prob[0]] + new_prob_body + text[prob[1]:]
    if promoted:
        v_start, v_end = _section_span(new_text, _VALIDATED_HEADER)  # type: ignore[misc]
        insertion = "\n".join(promoted) + "\n"
        new_text = new_text[:v_end].rstrip() + "\n\n" + insertion + new_text[v_end:]

    result = GateRun(pruned_ts, dropped, len(promoted))
    if not result.is_noop:
        corpus_path.write_text(new_text, encoding="utf-8")
    return result
