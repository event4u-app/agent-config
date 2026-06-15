#!/usr/bin/env python3
"""
Engineering Memory validator.

Validates YAML files under `agents/memory/<type>/**/*.yml` against the
schema documented in `guidelines/agent-infra/engineering-memory-data-format`.

Checks:
  * Required shared frontmatter: id, status, confidence, source, owner,
    last_validated, review_after_days.
  * Duplicate `id` within the same type.
  * Basic redaction: obvious secrets, private URLs with credentials,
    IP addresses tied to internal ranges.
  * Staleness: entries where (today - last_validated) > review_after_days
    are reported (informational, never hard fail).

  * Append-only (--append-only): inspects `git diff` against a ref to
    ensure intake JSONL files (`agents/memory/intake/*.jsonl`) only gained
    lines at EOF. In-place edits, deletions, or reorderings fail the check.
    See `road-to-memory-merge-safety.md` Phase 0.

Exit codes: 0 = clean, 1 = violations, 2 = PyYAML missing, 3 = internal error.

Usage:
    python3 scripts/check_memory.py                     # validate templates + agents/memory
    python3 scripts/check_memory.py --path agents/memory
    python3 scripts/check_memory.py --format json
    python3 scripts/check_memory.py --append-only       # CI: diff vs origin/main
    python3 scripts/check_memory.py --append-only --base HEAD~1
"""

from __future__ import annotations

import argparse
import datetime as _dt
import json
import re
import subprocess
import sys
from dataclasses import dataclass, asdict
from pathlib import Path
from typing import List, Literal, Optional, Tuple

Severity = Literal["error", "warning", "info"]

REQUIRED_KEYS = {
    "id", "status", "confidence", "source",
    "owner", "last_validated", "review_after_days",
}
VALID_STATUS = {"active", "deprecated", "archived", "superseded"}
VALID_CONFIDENCE = {"low", "medium", "high"}
# `priority` is optional (default `normal`); enum is the smallest set that
# solves the tier-0 surfacing use case. See the Phase 2 council brief for why
# the `high` tier was rejected.
VALID_PRIORITY = {"critical", "normal", "low"}
# Soft-cap on `priority: critical` entries per memory type. Tier-0 inflation
# is the failure mode: when too many entries claim "always surface", the
# slice loses signal. Warn (not fail) when the cap is exceeded so curators
# notice without being blocked.
CRITICAL_WARN_THRESHOLD = 10
# Stale-critical guard: a `priority: critical` entry that hasn't been
# re-validated in this many days emits a warning. Surfaced separately
# from the generic `stale:` info so reviewers see it before merge.
CRITICAL_STALE_DAYS = 90
KNOWN_TYPES = {
    "domain-invariants", "incident-learnings", "product-rules",
}

# Per-type soft entry cap (size-bounding without a decay engine). Over-cap →
# warning, never a hard fail: the right answer to bloat is a consolidation pass
# (prune archived, merge duplicates), not CI failure. See
# road-to-memory-pipeline-consolidation.md Phase 7.
PER_TYPE_CAPS = {
    "ownership": 50,
    "domain-invariants": 150,
    "product-rules": 100,
    "incident-learnings": 150,
    "historical-patterns": 150,
}
DEFAULT_TYPE_CAP = 150
# One-durable-fact-per-entry: a content field longer than this reads as a
# transcript / narrative blob, not a single durable fact → warning.
ONE_FACT_MAX_CHARS = 600
ONE_FACT_FIELDS = ("rule", "pattern", "statement", "observation",
                   "body", "decision", "note")
# Per-type entry tally, populated during validation, consumed by main().
_TYPE_COUNTS: dict = {}

# Redaction heuristics — plain-regex, deliberately conservative.
# False positives are fixed by quoting the line differently; false
# negatives are a curator responsibility.
REDACTION_PATTERNS = [
    # Key=value secret with a clear credential-word prefix. The value must
    # be a single token (no spaces, no "/" — skips filepaths and URLs).
    (re.compile(r"(?i)\b(api[_-]?key|auth[_-]?token|access[_-]?token|bearer|"
                r"secret|password|passwd|private[_-]?key)\b\s*[:=]\s*"
                r"[A-Za-z0-9+/=_\-]{8,}(?![/.\w])"),
     "inline credential"),
    (re.compile(r"https?://[^\s\"'/]*:[^\s\"'/]*@"), "url with credentials"),
    (re.compile(r"\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b"), "internal ipv4 range"),
    (re.compile(r"\b192\.168\.\d{1,3}\.\d{1,3}\b"), "internal ipv4 range"),
]

# Date-discipline — relative-date phrases without an ISO YYYY-MM-DD anchor
# within ±20 chars are rejected. Memory entries that say "yesterday" or
# "last week" rot the moment the file is re-read on another day; the
# anchor pins meaning.
RELATIVE_DATE_PATTERN = re.compile(
    r"(?i)\b(yesterday|today|tomorrow|"
    r"last\s+(?:week|month|year)|"
    r"next\s+(?:week|month|year)|"
    r"this\s+(?:week|month|year))\b"
)
ISO_DATE_PATTERN = re.compile(r"\b\d{4}-\d{2}-\d{2}\b")
DATE_ANCHOR_WINDOW = 20


@dataclass
class Finding:
    file: str
    line: int
    severity: Severity
    message: str
    entry_id: str = ""


def _load_yaml(path: Path):
    try:
        import yaml
    except ImportError:
        print(
            "error: PyYAML not installed. Run `pip install pyyaml` to use check_memory.",
            file=sys.stderr,
        )
        sys.exit(2)
    with path.open(encoding="utf-8") as fh:
        return yaml.safe_load(fh)


def _memory_type(path: Path) -> str:
    # Supports `memory/<type>.yml`, `memory/<type>/<hash>.yml`, and
    # `memory/<type>.example.yml` template filenames.
    parts = path.parts
    if "memory" not in parts:
        return path.stem
    idx = parts.index("memory")
    nxt = parts[idx + 1] if idx + 1 < len(parts) else ""
    stem = Path(nxt).stem
    # Strip `.example` suffix used in template files.
    return stem[:-len(".example")] if stem.endswith(".example") else stem


def _validate_entry(
    entry: dict,
    path: Path,
    seen_ids: set,
    findings: List[Finding],
    critical_counts: Optional[dict] = None,
):
    eid = entry.get("id", "")
    missing = REQUIRED_KEYS - set(entry.keys())
    for key in sorted(missing):
        findings.append(Finding(str(path), 0, "error", f"missing required field: {key}", eid))
    if entry.get("status") and entry["status"] not in VALID_STATUS:
        findings.append(Finding(str(path), 0, "error",
                                f"invalid status '{entry['status']}'", eid))
    if entry.get("confidence") and entry["confidence"] not in VALID_CONFIDENCE:
        findings.append(Finding(str(path), 0, "error",
                                f"invalid confidence '{entry['confidence']}'", eid))
    # Priority is optional (defaults to `normal` at read time). When present
    # it MUST be one of the three-tier enum — see VALID_PRIORITY for the
    # rationale on rejecting a fourth `high` tier.
    priority = entry.get("priority")
    if priority is not None and priority not in VALID_PRIORITY:
        findings.append(Finding(str(path), 0, "error",
                                f"invalid priority '{priority}' "
                                f"(expected one of {sorted(VALID_PRIORITY)})", eid))
    sources = entry.get("source") or []
    if not isinstance(sources, list) or len(sources) < 1:
        findings.append(Finding(str(path), 0, "error",
                                "source must be a list with ≥1 entry", eid))
    if eid and eid in seen_ids:
        findings.append(Finding(str(path), 0, "error", f"duplicate id '{eid}'", eid))
    seen_ids.add(eid)
    # Staleness.
    lv = entry.get("last_validated")
    days = entry.get("review_after_days")
    if isinstance(lv, _dt.date) and isinstance(days, int):
        age = (_dt.date.today() - lv).days
        if age > days and entry.get("status") == "active":
            findings.append(Finding(str(path), 0, "info",
                                    f"stale: last_validated {age} days ago (limit {days})", eid))
    # Critical-stale guard: a `priority: critical` entry that has not been
    # re-validated within CRITICAL_STALE_DAYS surfaces as a warning, even
    # when the entry's own `review_after_days` is more lenient. Critical
    # entries surface on every /memory:load — they have a tighter SLA.
    if (
        priority == "critical"
        and entry.get("status") == "active"
        and isinstance(lv, _dt.date)
    ):
        crit_age = (_dt.date.today() - lv).days
        if crit_age > CRITICAL_STALE_DAYS:
            findings.append(Finding(
                str(path), 0, "warning",
                f"critical-stale: last_validated {crit_age} days ago "
                f"(critical SLA is {CRITICAL_STALE_DAYS} days)", eid))
    # One-durable-fact-per-entry: reject transcript/narrative blobs. A single
    # content field over ONE_FACT_MAX_CHARS is the bloat signal.
    for fld in ONE_FACT_FIELDS:
        val = entry.get(fld)
        if isinstance(val, str) and len(val) > ONE_FACT_MAX_CHARS:
            findings.append(Finding(
                str(path), 0, "warning",
                f"one-fact: `{fld}` is {len(val)} chars (limit "
                f"{ONE_FACT_MAX_CHARS}) — split into separate durable facts, "
                f"not a narrative blob", eid))
            break
    # Tier-0 inflation tracking — increment per memory type. The aggregate
    # warning is emitted in main() after all files are validated.
    if critical_counts is not None and priority == "critical" and entry.get("status") == "active":
        mtype = _memory_type(path)
        critical_counts[mtype] = critical_counts.get(mtype, 0) + 1
    # Per-type entry-count tracking — aggregate cap warning in main().
    if critical_counts is not None:
        mt = _memory_type(path)
        _TYPE_COUNTS[mt] = _TYPE_COUNTS.get(mt, 0) + 1


def _check_redaction(path: Path, findings: List[Finding]):
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        # Skip comments — redaction warnings in example/commentary lines are noise.
        if line.lstrip().startswith("#"):
            continue
        for pattern, label in REDACTION_PATTERNS:
            if pattern.search(line):
                findings.append(Finding(str(path), line_no, "error",
                                        f"possible leak: {label}"))


def _check_date_discipline(path: Path, findings: List[Finding]):
    """Reject relative-date phrases without an ISO YYYY-MM-DD anchor.

    A curated memory entry that says "fixed yesterday" rots silently
    the moment the file is re-read on a different day. We require an
    ISO date within ±20 chars of every relative phrase so the meaning
    survives the calendar.
    """
    for line_no, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        # Skip comments and the YAML key for `last_validated` itself.
        stripped = line.lstrip()
        if stripped.startswith("#") or stripped.startswith("last_validated"):
            continue
        for match in RELATIVE_DATE_PATTERN.finditer(line):
            start = max(0, match.start() - DATE_ANCHOR_WINDOW)
            end = min(len(line), match.end() + DATE_ANCHOR_WINDOW)
            window = line[start:end]
            if ISO_DATE_PATTERN.search(window):
                continue
            phrase = match.group(0)
            findings.append(Finding(
                str(path), line_no, "error",
                f"relative date '{phrase}' without an ISO YYYY-MM-DD anchor "
                f"within ±{DATE_ANCHOR_WINDOW} chars (re-anchor before commit)"))


def _validate_file(
    path: Path,
    findings: List[Finding],
    critical_counts: Optional[dict] = None,
):
    mtype = _memory_type(path)
    if mtype not in KNOWN_TYPES:
        findings.append(Finding(str(path), 0, "warning",
                                f"unknown memory type '{mtype}'"))
    _check_redaction(path, findings)
    _check_date_discipline(path, findings)
    try:
        data = _load_yaml(path) or {}
    except Exception as exc:  # yaml.YAMLError or anything else
        findings.append(Finding(str(path), 0, "error",
                                f"YAML parse error: {exc.__class__.__name__}"))
        return
    if not isinstance(data, dict) or "entries" not in data:
        findings.append(Finding(str(path), 0, "error",
                                "missing top-level 'entries' key"))
        return
    seen_ids: set = set()
    for entry in data.get("entries") or []:
        if isinstance(entry, dict):
            _validate_entry(entry, path, seen_ids, findings, critical_counts)


INTAKE_GLOB = "agents/memory/intake/*.jsonl"


def _git(cmd: List[str]) -> Tuple[int, str]:
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, check=False)
        return out.returncode, (out.stdout or "") + (out.stderr or "")
    except FileNotFoundError:
        return 127, "git not found"


def _resolve_base(explicit: Optional[str]) -> Optional[str]:
    # CI: GITHUB_BASE_REF is set on PRs → origin/<base>.
    import os
    if explicit:
        return explicit
    base_ref = os.environ.get("GITHUB_BASE_REF")
    if base_ref:
        return f"origin/{base_ref}"
    # Local fallback: origin/main if it exists.
    rc, _ = _git(["git", "rev-parse", "--verify", "origin/main"])
    if rc == 0:
        return "origin/main"
    return None


def _check_append_only(base: Optional[str], findings: List[Finding]) -> None:
    """Verify that every intake JSONL file only grew at EOF vs `base`.

    A safe change adds lines at the end. Any hunk that removes or modifies
    an existing line is a violation — it breaks the `merge=union` contract
    and can cause silent conflict resolution errors.
    """
    ref = _resolve_base(base)
    if ref is None:
        findings.append(Finding(INTAKE_GLOB, 0, "warning",
                                "append-only: no base ref resolved (set --base or GITHUB_BASE_REF)"))
        return
    rc, diff = _git(["git", "diff", "--unified=0", "--no-color",
                     ref, "--", "agents/memory/intake/"])
    if rc != 0:
        findings.append(Finding(INTAKE_GLOB, 0, "warning",
                                f"append-only: git diff failed vs {ref}"))
        return
    if not diff.strip():
        return  # nothing changed, nothing to check
    current_file = ""
    old_path = ""
    for line in diff.splitlines():
        if line.startswith("diff --git"):
            parts = line.split()
            current_file = parts[-1][2:] if len(parts) >= 4 else ""
            old_path = ""
        elif line.startswith("--- "):
            old_path = line[4:].strip()
        elif line.startswith("@@"):
            # Hunk header: @@ -oldStart,oldCount +newStart,newCount @@
            m = re.match(r"^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@", line)
            if not m:
                continue
            old_start = int(m.group(1))
            old_count = int(m.group(2) or "1")
            # Any hunk that removes >0 lines from the old file = in-place edit.
            if old_count > 0 and old_path != "/dev/null":
                findings.append(Finding(current_file or INTAKE_GLOB, old_start, "error",
                                        f"append-only violation: {old_count} existing "
                                        f"line(s) removed or modified (ref={ref})"))


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--path", default="agents/memory", help="Root path to scan")
    ap.add_argument("--format", choices=["text", "json"], default="text")
    ap.add_argument("--append-only", action="store_true",
                    help="Enforce append-only JSONL contract for agents/memory/intake/*.jsonl "
                         "via git diff against the base ref")
    ap.add_argument("--base", default=None,
                    help="Base ref for --append-only (default: GITHUB_BASE_REF or origin/main)")
    args = ap.parse_args()
    root = Path(args.path)
    findings: List[Finding] = []
    if args.append_only:
        _check_append_only(args.base, findings)
        # Append-only mode is standalone by design: it inspects git state, not files
        # on disk, and is meant to run as a fast CI gate. Skip YAML validation.
        return _emit(findings, args.format)
    if not root.exists():
        if args.format == "json":
            print(json.dumps({"findings": [], "note": f"{root} not found"}))
        else:
            print(f"ℹ️  {root} not found — nothing to validate")
        return 0
    critical_counts: dict = {}
    _TYPE_COUNTS.clear()
    for yml in sorted(root.rglob("*.yml")):
        _validate_file(yml, findings, critical_counts)
    # Tier-0 inflation warning — soft cap on `priority: critical` per type.
    # Council convergence (Phase 2 B2): warn rather than block, because the
    # right answer to "too many criticals" is curator review, not CI failure.
    for mtype, count in sorted(critical_counts.items()):
        if count > CRITICAL_WARN_THRESHOLD:
            findings.append(Finding(
                f"agents/memory/{mtype}", 0, "warning",
                f"tier-0 inflation: {count} active 'priority: critical' "
                f"entries (threshold {CRITICAL_WARN_THRESHOLD}) — review "
                f"whether all still warrant always-surface treatment"))
    # Per-type entry-count cap (size-bounding, Phase 7). Warn, never block —
    # over-cap signals a consolidation pass is due (prune archived, merge dups).
    for mtype, count in sorted(_TYPE_COUNTS.items()):
        cap = PER_TYPE_CAPS.get(mtype, DEFAULT_TYPE_CAP)
        if count > cap:
            findings.append(Finding(
                f"agents/memory/{mtype}", 0, "warning",
                f"entry-cap: {count} entries (soft cap {cap}) — run a "
                f"consolidation pass (prune archived, merge duplicates)"))
    return _emit(findings, args.format)


def _emit(findings: List[Finding], fmt: str) -> int:
    errors = [f for f in findings if f.severity == "error"]
    if fmt == "json":
        print(json.dumps({"findings": [asdict(f) for f in findings]}, indent=2))
    else:
        for f in findings:
            icon = {"error": "❌", "warning": "⚠️", "info": "ℹ️"}[f.severity]
            loc = f"{f.file}:{f.line}" if f.line else f.file
            suffix = f" [{f.entry_id}]" if f.entry_id else ""
            print(f"  {icon}  {loc}{suffix}  {f.message}")
        print(f"\nSummary: {len(errors)} error(s), "
              f"{sum(1 for f in findings if f.severity == 'warning')} warning(s), "
              f"{sum(1 for f in findings if f.severity == 'info')} info")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
