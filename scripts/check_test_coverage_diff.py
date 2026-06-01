#!/usr/bin/env python3
"""Coverage forcing-function — WARN-only (R3 of road-to-test-and-gate-integrity).

A lightweight coverage-governance nudge: warn (never block) when a PR adds a
new gate script without a matching test, so the +0-tests pattern (three
releases shipped behaviour with no coverage) becomes visible at PR time. This
is partly a *social* problem — R3 is a nudge, not a cure.

Honest framing (per the roadmap critique): R3 IS a lightweight coverage-
governance layer, NOT pure hardening. It ships WARN-only, is calibrated from
the REAL Phase 2 backfill experience (not guessed up front), and carries a
sunset clause. The hard-fail flip is a SEPARATE, later decision gated on
warn-phase data.

----------------------------------------------------------------------------
TRIGGER SURFACE — calibrated from Phase 2 evidence + AI council
(claude-sonnet-4-5 + gpt-4o, analysis, 2026-06-02):

  WARN when a NEW `scripts/check_*.py` or `scripts/lint_*.py` gate is added
  with no matching new/changed test in the same diff (`tests/**/test_*.py`
  or `tests/**/*_test.py` whose stem matches the gate's stem).

What is DELIBERATELY excluded (the council killed these to avoid
pragma-spam / signal-to-noise collapse — "over-broad triggers train people
to bypass it"):
  - Edits to EXISTING gate scripts. Phase 2 migrated 4 gates with one-line
    path-constant swaps that legitimately needed NO test; a trigger that
    fired on edits would be pure noise. KNOWN RECALL LIMIT: a behaviour
    change to an existing gate ships untracked in this warn-only phase —
    accepted on purpose; revisit only if the warn-phase data justifies it.
  - New skills with `requires_skills`. Skills are markdown capability docs,
    usually test-less by design → would fire constantly. Dropped for Phase 1
    (council: "no Phase 2 evidence; immediate pragma-spam").
  - Taskfile wiring, docs/`*.md`, `agents/**`, `config/**`, logging/path-
    constant edits.

PRAGMA — `# coverage-diff-ignore: <reason>` (reason mandatory) in the new
gate file suppresses its warning. Because the trigger is NEW files only, the
pragma lives in the added lines (it IS the diff), so it is naturally
commit-scoped — it cannot silently silence FUTURE edits to the file (those
do not trigger). Mirrors the `check-refs` `<!-- ref-ignore -->` allowlist.

SUCCESS METRIC + SUNSET (the fail-mode flip is a separate later decision):
  - Track warn-rate and pragma-rate over the next release cycle (this script
    emits `coverage-diff: warned=N suppressed=M` so the data is in CI logs —
    no new telemetry surface).
  - Consider fail-mode only at >= 3 legitimate catches per cycle AND
    pragma-rate < 10%.
  - If precision is poor after one cycle, REMOVE the check rather than
    escalate it. A noisy nudge people route around is worse than none.
----------------------------------------------------------------------------

Usage:
  python3 scripts/check_test_coverage_diff.py [--base-ref REF] [--files-status "A\tpath" ...]
Exit code: always 0 (warn-only by contract this phase).
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

GATE_RE = re.compile(r"^scripts/(?:check_|lint_)[A-Za-z0-9_]+\.py$")
PRAGMA_RE = re.compile(r"#\s*coverage-diff-ignore:\s*(\S.*?)\s*$")
_PRAGMA_SCAN_LINES = 60


def _is_test_file(path: str) -> bool:
    if not (path.startswith("tests/") and path.endswith(".py")):
        return False
    stem = Path(path).stem
    return stem.startswith("test_") or stem.endswith("_test")


def _test_matches_gate(gate_path: str, test_paths: list[str]) -> bool:
    """A test covers a gate when its stem shares the gate's stem.

    Accepts naming variance: `tests/test_check_foo.py`, `tests/foo_test.py`,
    `tests/sub/test_foo.py` all match gate `scripts/check_foo.py`.
    """
    gate_stem = Path(gate_path).stem  # e.g. check_foo
    short = gate_stem.removeprefix("check_").removeprefix("lint_")  # foo
    for t in test_paths:
        tstem = Path(t).stem.removeprefix("test_").removesuffix("_test")
        if gate_stem in Path(t).stem or short and short in tstem:
            return True
    return False


def evaluate(changed, pragma_reason):
    """Pure core (no git, no I/O): classify the changed-file set.

    `changed` is a list of (status, path) where status is the git
    name-status code ('A' added, 'M' modified, …). `pragma_reason(path)`
    returns the in-file opt-out reason or None. Returns
    `(warnings, suppressed)` where warnings is a list of new gate paths
    with no matching test and no pragma, suppressed is [(path, reason)].
    """
    new_gates = [p for (s, p) in changed if s == "A" and GATE_RE.match(p)]
    test_changes = [p for (_s, p) in changed if _is_test_file(p)]
    warnings: list[str] = []
    suppressed: list[tuple[str, str]] = []
    for gate in new_gates:
        if _test_matches_gate(gate, test_changes):
            continue
        reason = pragma_reason(gate)
        if reason:
            suppressed.append((gate, reason))
        else:
            warnings.append(gate)
    return warnings, suppressed


def _pragma_reason_from_tree(path: str) -> str | None:
    f = REPO_ROOT / path
    try:
        head = f.read_text(encoding="utf-8", errors="ignore").splitlines()[:_PRAGMA_SCAN_LINES]
    except OSError:
        return None
    for line in head:
        m = PRAGMA_RE.search(line)
        if m:
            return m.group(1)
    return None


def _resolve_base_ref(explicit: str | None) -> str:
    if explicit:
        return explicit
    for candidate in ("origin/main", "origin/master", "main", "master"):
        try:
            subprocess.check_output(
                ["git", "rev-parse", "--verify", candidate], stderr=subprocess.DEVNULL,
            )
            return candidate
        except subprocess.CalledProcessError:
            continue
    return "HEAD~1"


def _git_name_status(base_ref: str) -> list[tuple[str, str]]:
    try:
        out = subprocess.check_output(
            ["git", "diff", "--name-status", f"{base_ref}...HEAD"],
            stderr=subprocess.STDOUT, text=True,
        )
    except subprocess.CalledProcessError as exc:
        print(f"⚠️  coverage-diff: git diff failed ({exc.output.strip()}); skipping.", file=sys.stderr)
        return []
    rows: list[tuple[str, str]] = []
    for line in out.splitlines():
        parts = line.split("\t")
        if len(parts) >= 2:
            rows.append((parts[0][:1], parts[-1]))
    return rows


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-ref", default=None)
    opts = ap.parse_args(argv)
    changed = _git_name_status(_resolve_base_ref(opts.base_ref))
    warnings, suppressed = evaluate(changed, _pragma_reason_from_tree)
    if warnings:
        print("⚠️  coverage-diff: new gate(s) added with no matching test (warn-only):")
        for g in warnings:
            print(f"    {g} — add tests/test_{Path(g).stem}.py, or a "
                  f"`# coverage-diff-ignore: <reason>` line if no test is warranted.")
    for g, reason in suppressed:
        print(f"    (suppressed: {g} — {reason})")
    print(f"coverage-diff: warned={len(warnings)} suppressed={len(suppressed)}")
    return 0  # warn-only by contract this phase


if __name__ == "__main__":
    raise SystemExit(main())
