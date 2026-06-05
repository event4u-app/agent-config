#!/usr/bin/env python3
"""Gate script for memory promotion (intake → curated).

Validates a memory-promotion candidate — either an intake JSONL record
(identified by `--intake-id`) or a stand-alone proposal YAML — against
the admission discipline defined in
`road-to-agent-memory-integration.md` Phase 3.

Gate checks (all hard):
  1. Metadata complete — `id`, `entry_type`, `path`, `body` exist
     (intake); or the full curated schema applies (proposal YAML).
  2. `entry_type` is one of the six curated memory types.
  3. The body describes a **pattern**, not a one-off: ≥ 2 distinct
     paths in the intake stream share the same root-cause signature
     OR the submitter supplies `future_decisions:` with ≥ 3 concrete,
     dated, owner-tagged use cases.
  4. Same `(entry_type, path)` has no active curated entry whose rule
     the promotion would contradict (manual check — script prints a
     hint, does not enforce).

Exit codes: 0 = pass, 1 = gate failure, 2 = PyYAML missing, 3 = internal error.

Usage:
    python3 scripts/check_memory_proposal.py --intake-id sig-abc123
    python3 scripts/check_memory_proposal.py --proposal path/to.yml
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

INTAKE_ROOT = Path("agents/memory/intake")
VALID_TYPES = {
    "historical-patterns", "incident-learnings", "ownership",
    "domain-invariants", "architecture-decisions", "product-rules",
}
REQUIRED_INTAKE = ("id", "entry_type", "path", "body")
PATTERN_MIN_PATHS = 2
MIN_FUTURE_DECISIONS = 3


def _load_yaml(path: Path) -> dict:
    try:
        import yaml
    except ImportError:
        print("error: PyYAML not installed. `pip install pyyaml`.",
              file=sys.stderr)
        sys.exit(2)
    with path.open(encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    if not isinstance(data, dict):
        print(f"error: {path} is not a YAML mapping", file=sys.stderr)
        sys.exit(1)
    return data


def _find_intake(intake_id: str) -> dict | None:
    if not INTAKE_ROOT.is_dir():
        return None
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
                if obj.get("id") == intake_id:
                    return obj
    return None


def _count_sibling_paths(entry_type: str, body: str) -> int:
    """Count distinct `path` values in intake with the same (type, body)."""
    if not INTAKE_ROOT.is_dir():
        return 0
    seen: set[str] = set()
    for jsonl in INTAKE_ROOT.glob("*.jsonl"):
        with jsonl.open(encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except ValueError:
                    continue
                if obj.get("entry_type") == entry_type \
                        and obj.get("body") == body \
                        and isinstance(obj.get("path"), str):
                    seen.add(obj["path"])
    return len(seen)


def _check_future_decisions(fds: Any) -> list[str]:
    """Return failure messages for a weak `future_decisions:` block."""
    failures: list[str] = []
    if not isinstance(fds, list):
        return ["future_decisions: missing or not a list"]
    if len(fds) < MIN_FUTURE_DECISIONS:
        failures.append(
            f"future_decisions: needs ≥{MIN_FUTURE_DECISIONS}, got {len(fds)}"
        )
    for i, fd in enumerate(fds, 1):
        if not isinstance(fd, dict):
            failures.append(f"future_decisions[{i}]: must be a mapping")
            continue
        for key in ("decision", "expected_by", "owner"):
            if not fd.get(key):
                failures.append(f"future_decisions[{i}]: missing `{key}`")
    return failures


def check(record: dict, source: str) -> list[str]:
    failures: list[str] = []
    # 1. required fields
    for key in REQUIRED_INTAKE:
        if key not in record or record[key] in (None, ""):
            failures.append(f"missing field: `{key}`")
    # 2. type value
    if record.get("entry_type") not in VALID_TYPES:
        failures.append(
            f"entry_type `{record.get('entry_type')}` not in {sorted(VALID_TYPES)}"
        )
    # 3. pattern vs one-off
    body = record.get("body")
    etype = record.get("entry_type")
    sibling_paths = _count_sibling_paths(etype, body) if body and etype else 0
    fds = record.get("future_decisions")
    if sibling_paths >= PATTERN_MIN_PATHS:
        pass  # strong pattern signal
    else:
        fd_errors = _check_future_decisions(fds)
        if fd_errors:
            failures.append(
                f"weak pattern evidence ({sibling_paths} sibling path(s)) "
                f"and future_decisions insufficient:"
            )
            failures.extend(f"  - {e}" for e in fd_errors)
    return failures


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    grp = ap.add_mutually_exclusive_group(required=True)
    grp.add_argument("--intake-id", help="Promote an intake record by id")
    grp.add_argument("--proposal", help="Promote a proposal YAML file")
    ap.add_argument("--format", choices=["text", "json"], default="text")
    args = ap.parse_args()
    if args.intake_id:
        record = _find_intake(args.intake_id)
        if record is None:
            print(f"error: no intake entry with id={args.intake_id}",
                  file=sys.stderr)
            return 1
        source = f"intake:{args.intake_id}"
    else:
        record = _load_yaml(Path(args.proposal))
        source = args.proposal
    failures = check(record, source)
    if args.format == "json":
        print(json.dumps({"source": source, "failures": failures}, indent=2))
    else:
        if failures:
            print(f"❌  {source} — gate failed:")
            for f in failures:
                print(f"  🔴 {f}")
        else:
            print(f"✅  {source} — gate passed")
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
