"""Phase 2.3 outcome scorer — Iron-Law shape check on locked replies.

≤ 50 LOC stdlib only (Phase 2.3a Sonnet binding rev). Reads a JSON
fixture with `expected_patterns` (must match) + `forbidden_patterns`
(must not match) and applies them line-by-line to `baseline_reply`.
No AST, no third-party regex engine, no external model calls.

CI entry: `tests/test_outcome_baselines.py`. Adding a 4th rule needs
the criteria in `tests/golden/outcomes/README.md`.
"""
from __future__ import annotations

import json
import re
from pathlib import Path


def score(fixture_path: Path) -> tuple[bool, list[str]]:
    fx = json.loads(fixture_path.read_text(encoding="utf-8"))
    reply = fx["baseline_reply"]
    failures: list[str] = []
    for pat in fx.get("expected_patterns", []):
        if not re.search(pat, reply, re.MULTILINE):
            failures.append(f"missing required pattern: {pat!r}")
    for pat in fx.get("forbidden_patterns", []):
        m = re.search(pat, reply, re.MULTILINE)
        if m:
            failures.append(
                f"forbidden pattern matched at offset {m.start()}: {pat!r}"
            )
    counters = fx.get("counters", {})
    for name, spec in counters.items():
        pat, op, target = spec["pattern"], spec["op"], spec["target"]
        n = len(re.findall(pat, reply, re.MULTILINE))
        ok = (op == "==" and n == target) or (op == "<=" and n <= target) \
            or (op == ">=" and n >= target)
        if not ok:
            failures.append(
                f"counter {name!r} ({pat!r}): got {n}, expected {op} {target}"
            )
    return (not failures), failures
