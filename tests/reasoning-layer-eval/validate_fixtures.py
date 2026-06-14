#!/usr/bin/env python3
"""Cost-free structural validator for the RDP trigger fixtures.

No model calls — this only checks that trigger-fixtures.json is well-formed and
that the load-bearing cost-gating invariants (L10/L12/L13) are actually exercised
by at least one fixture. Live scoring (precision/recall against a real host
model) is a separate, billable step run via src/scripts/skill_trigger_eval.py in
Phase 7.

Usage:  python3 tests/reasoning-layer-eval/validate_fixtures.py
Exit 0 = fixtures valid + invariants covered; non-zero = a problem to fix.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

FIXTURES = Path(__file__).resolve().parent / "trigger-fixtures.json"
REQUIRED = {"q", "trigger", "discipline", "note"}
KNOWN_DISCIPLINES = {
    "grounding", "intent", "complexity_first", "notes_first",
    "verifier", "prediction", "decision", "orchestrator",
}


def fail(msg: str) -> None:
    print(f"❌  {msg}", file=sys.stderr)
    sys.exit(1)


def main() -> int:
    if not FIXTURES.is_file():
        fail(f"missing {FIXTURES}")
    data = json.loads(FIXTURES.read_text(encoding="utf-8"))
    queries = data.get("queries")
    if not isinstance(queries, list) or not queries:
        fail("`queries` must be a non-empty list")

    seen_q: set[str] = set()
    for i, row in enumerate(queries):
        missing = REQUIRED - row.keys()
        if missing:
            fail(f"query #{i} missing keys: {sorted(missing)}")
        if not isinstance(row["trigger"], bool):
            fail(f"query #{i} `trigger` must be bool")
        if row["discipline"] not in KNOWN_DISCIPLINES:
            fail(f"query #{i} unknown discipline: {row['discipline']!r}")
        key = (row["q"], row["discipline"], row.get("host"))
        if key in seen_q:
            fail(f"duplicate fixture: {key}")
        seen_q.add(key)

    # Per-discipline: must have BOTH a should-fire and a should-not-fire case,
    # otherwise the fixture can't distinguish signal from noise.
    by_disc: dict[str, list[bool]] = {}
    for row in queries:
        by_disc.setdefault(row["discipline"], []).append(row["trigger"])
    for disc, labels in sorted(by_disc.items()):
        if True not in labels:
            fail(f"discipline {disc!r} has no should-fire (trigger:true) fixture")
        if False not in labels:
            fail(f"discipline {disc!r} has no should-not-fire (trigger:false) fixture")

    # Load-bearing cost-gating invariants must be exercised (host = agent
    # self-assessed reasoning strength, table-free per ADR-035 — NOT model_tier):
    def has(pred) -> bool:
        return any(pred(r) for r in queries)

    invariants = {
        "L10 strong-host auto-gate light/off (host:strong + trigger:false)":
            has(lambda r: r.get("host") == "strong" and r["trigger"] is False),
        "L10 trivial-task OFF (a trigger:false grounding/orchestrator case)":
            has(lambda r: r["discipline"] in {"grounding", "orchestrator"} and r["trigger"] is False),
        "L12 verifier fires on structural complexity (verifier + trigger:true)":
            has(lambda r: r["discipline"] == "verifier" and r["trigger"] is True),
        "L12 verifier does NOT fire on long-but-linear (verifier + trigger:false)":
            has(lambda r: r["discipline"] == "verifier" and r["trigger"] is False),
        "L13 intent standard-host only (standard true, strong false)":
            has(lambda r: r["discipline"] == "intent" and r.get("host") == "standard" and r["trigger"] is True)
            and has(lambda r: r["discipline"] == "intent" and r.get("host") == "strong" and r["trigger"] is False),
    }
    missing_inv = [name for name, ok in invariants.items() if not ok]
    if missing_inv:
        for name in missing_inv:
            print(f"❌  invariant not exercised: {name}", file=sys.stderr)
        sys.exit(1)

    fire = sum(1 for r in queries if r["trigger"])
    print(
        f"✅  {len(queries)} fixtures valid · {len(by_disc)} disciplines "
        f"· {fire} should-fire / {len(queries) - fire} should-not-fire "
        f"· all {len(invariants)} cost-gating invariants exercised"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
