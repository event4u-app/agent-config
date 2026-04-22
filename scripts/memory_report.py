#!/usr/bin/env python3
"""One-shot memory observability report.

Shows:
  - Backend status (via `memory_status.status()`)
  - Intake counts per entry type and per month
  - Curated file staleness (files with `last_validated` older than
    `review_after_days` for any entry)
  - Supersede-chain totals

Exit code: 0 = report printed (green or otherwise); 2 = PyYAML missing.
`task memory:status` is the expected entry point, but the script is
usable standalone.

Usage:
    python3 scripts/memory_report.py
    python3 scripts/memory_report.py --format json
"""

from __future__ import annotations

import argparse
import datetime as dt
import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent))
import memory_status  # noqa: E402

MEMORY_ROOT = Path("agents/memory")
INTAKE_ROOT = MEMORY_ROOT / "intake"
CURATED_TYPES = (
    "ownership", "historical-patterns", "domain-invariants",
    "architecture-decisions", "incident-learnings", "product-rules",
)

# Role-mode marker grepped from session captures / reports / handoffs.
# Matches `<!-- role-mode: <slug> | contract: ... -->` on any single line.
# See guidelines/agent-infra/role-contracts.md "Structured mode markers".
import re  # noqa: E402

_MODE_MARKER_PATTERN = re.compile(
    r"<!--\s*role-mode:\s*([a-z0-9][a-z0-9-]*)\s*\|"
    r"\s*contract:[^>]*-->"
)
_MODE_SCAN_DIRS = (
    Path("agents/sessions"),
    Path("agents/reports"),
    Path("agents/handoffs"),
    Path("agents/learnings"),
)
_KNOWN_MODES = (
    "developer", "reviewer", "tester", "po", "incident", "planner",
)


def _load_yaml(path: Path) -> dict:
    try:
        import yaml
    except ImportError:
        print("error: PyYAML not installed. `pip install pyyaml`.",
              file=sys.stderr)
        sys.exit(2)
    with path.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh) or {}


def _iter_curated_entries() -> list[tuple[Path, str, dict]]:
    """Yield (file, type, entry) across both curated layouts."""
    out: list[tuple[Path, str, dict]] = []
    for mtype in CURATED_TYPES:
        single = MEMORY_ROOT / f"{mtype}.yml"
        if single.is_file():
            data = _load_yaml(single)
            for e in data.get("entries") or []:
                if isinstance(e, dict):
                    out.append((single, mtype, e))
        type_dir = MEMORY_ROOT / mtype
        if type_dir.is_dir():
            for yml in sorted(type_dir.rglob("*.yml")):
                data = _load_yaml(yml) or {}
                entries = data.get("entries")
                if isinstance(entries, list):
                    for e in entries:
                        if isinstance(e, dict):
                            out.append((yml, mtype, e))
                elif isinstance(data, dict) and data.get("id"):
                    out.append((yml, mtype, data))
    return out


def _intake_stats() -> dict:
    total = 0
    by_type: Counter = Counter()
    by_month: Counter = Counter()
    superseded = 0
    if INTAKE_ROOT.is_dir():
        for jsonl in sorted(INTAKE_ROOT.glob("*.jsonl")):
            month = jsonl.stem.replace("signals-", "")
            with jsonl.open(encoding="utf-8") as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                    except ValueError:
                        continue
                    if obj.get("type") == "supersede":
                        superseded += 1
                        continue
                    total += 1
                    t = obj.get("entry_type")
                    if isinstance(t, str):
                        by_type[t] += 1
                    by_month[month] += 1
    return {
        "total_active": total,
        "superseded": superseded,
        "by_type": dict(by_type),
        "by_month": dict(by_month),
    }


def _staleness_report() -> list[dict]:
    today = dt.date.today()
    stale: list[dict] = []
    for path, mtype, entry in _iter_curated_entries():
        lv = entry.get("last_validated")
        review_after = entry.get("review_after_days")
        if not isinstance(lv, (str, dt.date)) \
                or not isinstance(review_after, int):
            continue
        try:
            last = lv if isinstance(lv, dt.date) \
                else dt.date.fromisoformat(str(lv))
        except ValueError:
            continue
        due = last + dt.timedelta(days=review_after)
        if due < today:
            stale.append({
                "file": str(path),
                "type": mtype,
                "id": entry.get("id", "?"),
                "overdue_days": (today - due).days,
            })
    stale.sort(key=lambda r: r["overdue_days"], reverse=True)
    return stale


def _quarter_of(d: dt.date | str) -> str:
    if isinstance(d, str):
        try:
            d = dt.date.fromisoformat(d[:10])
        except ValueError:
            return "unknown"
    if not isinstance(d, dt.date):
        return "unknown"
    return f"{d.year}Q{(d.month - 1) // 3 + 1}"


def _quarterly_stats() -> dict:
    """Per-quarter breakdown: accepted curated entries, retired (supersede)
    entries, and the curated-file staleness rate.

    Feeds the Q2 outcome measurement for `road-to-agent-outcomes.md` /
    `road-to-project-memory.md` Phase 5.
    """
    accepted: Counter = Counter()
    for _, _, entry in _iter_curated_entries():
        created = entry.get("created") or entry.get("last_validated")
        if created is not None:
            accepted[_quarter_of(created)] += 1
    retired: Counter = Counter()
    if INTAKE_ROOT.is_dir():
        for jsonl in sorted(INTAKE_ROOT.glob("*.jsonl")):
            with jsonl.open(encoding="utf-8") as fh:
                for line in fh:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                    except ValueError:
                        continue
                    if obj.get("type") != "supersede":
                        continue
                    ts = obj.get("ts")
                    if isinstance(ts, str):
                        retired[_quarter_of(ts)] += 1
    # Staleness rate = overdue / total curated entries (0..1).
    total = sum(1 for _ in _iter_curated_entries())
    overdue = len(_staleness_report())
    rate = (overdue / total) if total else 0.0
    return {
        "accepted_by_quarter": dict(accepted),
        "retired_by_quarter": dict(retired),
        "staleness_rate": round(rate, 3),
        "curated_total": total,
        "curated_overdue": overdue,
    }


def _operational_store_stats(backend_status: str) -> dict | None:
    """Optional operational-store stats when the backend reports `present`.

    Detection-only for now: the `agent-memory` CLI adapter is the owner
    of real counts. We surface the status and a clear stub marker so a
    future PR can replace the stub with CLI output without changing the
    report schema shape.
    """
    if backend_status != "present":
        return None
    return {
        "enabled": True,
        "counts": {"entries": None, "recent_writes": None},
        "note": "full operational-store probing is owned by the "
                "agent-memory CLI adapter; stats stubbed here",
    }


def _role_mode_stats() -> dict:
    """Count structured mode markers across session/report/handoff dirs.

    Feeds `road-to-role-modes` Phase 4 (contract-conformance signal)
    and `road-to-curated-self-improvement` Phase 3 (outcome measurement).
    Missing directories are silently skipped — the repo may not have
    session captures yet.
    """
    counts: Counter[str] = Counter()
    files_scanned = 0
    unknown_modes: set[str] = set()
    for root in _MODE_SCAN_DIRS:
        if not root.exists():
            continue
        for md in root.rglob("*.md"):
            try:
                text = md.read_text(encoding="utf-8", errors="replace")
            except OSError:
                continue
            files_scanned += 1
            for match in _MODE_MARKER_PATTERN.finditer(text):
                slug = match.group(1).lower()
                counts[slug] += 1
                if slug not in _KNOWN_MODES:
                    unknown_modes.add(slug)
    total = sum(counts.values())
    return {
        "total_markers": total,
        "files_scanned": files_scanned,
        "by_mode": dict(counts),
        "unknown_modes": sorted(unknown_modes),
    }


def build_report() -> dict:
    status = memory_status.status()
    return {
        "backend": {
            "status": status.status,
            "backend": status.backend,
            "reason": status.reason,
            "cli_path": status.cli_path,
        },
        "intake": _intake_stats(),
        "staleness": _staleness_report(),
        "quarterly": _quarterly_stats(),
        "role_modes": _role_mode_stats(),
        "operational_store": _operational_store_stats(status.status),
    }


def _print_text(report: dict) -> None:
    b = report["backend"]
    print(f"Backend:   {b['status']} (backend={b['backend']})")
    if b["reason"]:
        print(f"           reason: {b['reason']}")
    intake = report["intake"]
    print(f"Intake:    {intake['total_active']} active, "
          f"{intake['superseded']} superseded")
    for t, n in sorted(intake["by_type"].items()):
        print(f"  - {t}: {n}")
    stale = report["staleness"]
    if not stale:
        print("Staleness: no curated entries past review_after_days")
    else:
        print(f"Staleness: {len(stale)} entrie(s) overdue")
        for row in stale[:5]:
            print(f"  - {row['id']} ({row['type']})  "
                  f"+{row['overdue_days']}d  {row['file']}")
        if len(stale) > 5:
            print(f"  (+{len(stale) - 5} more)")
    q = report["quarterly"]
    print(f"Quarterly: staleness-rate={q['staleness_rate']:.1%} "
          f"({q['curated_overdue']}/{q['curated_total']})")
    if q["accepted_by_quarter"]:
        acc = ", ".join(f"{k}:{v}" for k, v in
                        sorted(q["accepted_by_quarter"].items()))
        print(f"  accepted: {acc}")
    if q["retired_by_quarter"]:
        ret = ", ".join(f"{k}:{v}" for k, v in
                        sorted(q["retired_by_quarter"].items()))
        print(f"  retired:  {ret}")
    rm = report.get("role_modes") or {}
    if rm.get("files_scanned"):
        total = rm.get("total_markers", 0)
        print(f"Role modes: {total} marker(s) in "
              f"{rm['files_scanned']} file(s)")
        if rm.get("by_mode"):
            modes = ", ".join(f"{k}:{v}" for k, v in
                              sorted(rm["by_mode"].items()))
            print(f"  by mode: {modes}")
        if rm.get("unknown_modes"):
            print(f"  unknown: {', '.join(rm['unknown_modes'])} "
                  "(not in the six reserved slugs)")
    if report["operational_store"]:
        print("Operational-store: present (stats via agent-memory CLI)")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--format", choices=["text", "json"], default="text")
    args = ap.parse_args()
    report = build_report()
    if args.format == "json":
        print(json.dumps(report, indent=2, default=str))
    else:
        _print_text(report)
    return 0


if __name__ == "__main__":
    sys.exit(main())
