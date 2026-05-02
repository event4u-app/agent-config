"""Per-day rolling cost-budget guard for the council (D3).

Adds a 24h-rolling-window USD limit on top of the per-session caps in
`orchestrator.CostBudget`. Persists a small JSONL ledger in
``~/.config/agent-config/council-spend.jsonl`` (mode 0600, same
permission discipline as the API keys).

Contract
- The ledger is **append-only**. Each line is ``{"ts": ISO-8601 UTC,
  "usd": float, "provider": str, "model": str}``.
- ``today_spend_usd()`` sums entries within the last 24h from "now"
  (true rolling window — not midnight UTC, never resets at boundary
  surprise).
- ``would_exceed(limit_usd, next_call_usd)`` returns True iff the next
  call would push the rolling window past the limit.
- ``record_spend(usd, provider, model)`` appends a single entry; never
  raises on disk failure (logs to stderr, returns False).

The guard is **advisory** to the orchestrator: it provides a check
function the host agent can call before each council member; the
orchestrator's per-session cost gate stays the primary defence.
"""

from __future__ import annotations

import datetime as _dt
import json
import os
import stat
import sys
from dataclasses import dataclass
from pathlib import Path

LEDGER_PATH = Path.home() / ".config" / "agent-config" / "council-spend.jsonl"
ROLLING_WINDOW_HOURS = 24


@dataclass
class SpendEntry:
    ts: _dt.datetime  # UTC, tz-aware
    usd: float
    provider: str
    model: str


def _now_utc() -> _dt.datetime:
    return _dt.datetime.now(_dt.timezone.utc)


def _ensure_ledger_dir(path: Path) -> bool:
    """Create the ledger's parent directory mode 0700 if missing."""
    try:
        path.parent.mkdir(parents=True, exist_ok=True)
        if (path.parent.stat().st_mode & 0o777) != 0o700:
            try:
                os.chmod(path.parent, 0o700)
            except OSError:
                # On macOS ~/.config may inherit umask perms; do not block.
                pass
        return True
    except OSError as exc:  # noqa: BLE001 - never block the orchestrator
        print(f"[council:budget_guard] mkdir failed: {exc}", file=sys.stderr)
        return False


def _ensure_ledger_file_mode(path: Path) -> None:
    """Make sure an existing ledger file is mode 0600. Best-effort."""
    if not path.exists():
        return
    current = path.stat().st_mode & 0o777
    if current != 0o600:
        try:
            os.chmod(path, 0o600)
        except OSError:
            pass


def _parse_iso(ts: str) -> _dt.datetime | None:
    try:
        # `fromisoformat` accepts "+00:00"; we always write with "+00:00".
        return _dt.datetime.fromisoformat(ts)
    except ValueError:
        return None


def read_entries(path: Path | None = None) -> list[SpendEntry]:
    """Read every well-formed entry from the ledger.

    Malformed lines are skipped silently. Empty/missing ledger → [].
    """
    p = path or LEDGER_PATH
    if not p.exists():
        return []
    out: list[SpendEntry] = []
    for line in p.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        ts = _parse_iso(str(obj.get("ts", "")))
        if ts is None:
            continue
        try:
            usd = float(obj.get("usd", 0))
        except (TypeError, ValueError):
            continue
        out.append(SpendEntry(
            ts=ts, usd=usd,
            provider=str(obj.get("provider", "")),
            model=str(obj.get("model", "")),
        ))
    return out


def today_spend_usd(
    *,
    path: Path | None = None,
    now: _dt.datetime | None = None,
    window_hours: int = ROLLING_WINDOW_HOURS,
) -> float:
    """Sum of USD spent in the last `window_hours` (rolling window)."""
    cutoff = (now or _now_utc()) - _dt.timedelta(hours=window_hours)
    return sum(e.usd for e in read_entries(path) if e.ts >= cutoff)


def would_exceed(
    limit_usd: float,
    next_call_usd: float,
    *,
    path: Path | None = None,
    now: _dt.datetime | None = None,
    window_hours: int = ROLLING_WINDOW_HOURS,
) -> bool:
    """True iff appending `next_call_usd` would push the window past `limit_usd`.

    `limit_usd <= 0` disables the guard (returns False). Mirrors the
    `CostBudget.max_total_usd` convention.
    """
    if limit_usd <= 0:
        return False
    spent = today_spend_usd(path=path, now=now, window_hours=window_hours)
    return (spent + next_call_usd) > limit_usd


def record_spend(
    usd: float,
    provider: str,
    model: str,
    *,
    path: Path | None = None,
    now: _dt.datetime | None = None,
) -> bool:
    """Append one entry to the ledger. Returns True on success."""
    if usd <= 0:
        return True  # zero-cost calls (manual mode) skip the ledger
    p = path or LEDGER_PATH
    if not _ensure_ledger_dir(p):
        return False
    ts = (now or _now_utc()).isoformat()
    entry = json.dumps({"ts": ts, "usd": round(usd, 6),
                        "provider": provider, "model": model}) + "\n"
    try:
        with p.open("a", encoding="utf-8") as fh:
            fh.write(entry)
    except OSError as exc:  # noqa: BLE001 - never block the orchestrator
        print(f"[council:budget_guard] write failed: {exc}", file=sys.stderr)
        return False
    _ensure_ledger_file_mode(p)
    return True
