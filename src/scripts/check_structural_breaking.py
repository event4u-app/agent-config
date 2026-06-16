#!/usr/bin/env python3
"""Structural breaking-change detector (road-to-contract-integrity F3).

`release.py` infers the version bump from the *commit annotation*
(`feat!` / `BREAKING CHANGE`). That is only as honest as the author's
discipline — the exact 6.1.0 failure was a pack/layer removal shipped as
a plain `feat:` commit, so it slipped the gate. This detector closes the
loop: it inspects the *diff* against the trunk and FAILS when a
structurally breaking change is present **without** a breaking annotation
(or an explicit override). It does not decide the bump; it forces the
annotation to exist when the diff is structurally breaking.

Two structural-break classes (deterministic, no semantic analysis):

  1. **Artifact deletion / rename.** A tracked artifact *source* file
     (skill `SKILL.md`, rule, command `command.md`, pack manifest, or a
     contract schema) is Deleted or Renamed in the diff.
  2. **Schema change without a version bump.** A contract schema under
     `src/scripts/schemas/` is modified but its `x-schemaVersion` is
     unchanged — an enum/type/validation change is breaking-for-consumers
     yet invisible to a name-status diff, so the author must either bump
     `x-schemaVersion` or annotate the commit.

Escapes (any one clears the gate):
  * The commit range carries a breaking annotation (`<type>!:` bang or a
    `BREAKING CHANGE` line).
  * A commit body carries `ci-override: structural-breaking-ok`
    (intentional deprecation-cycle completion).

Accepts ~20% false-negatives on purely *semantic* breaks (behaviour
change with no artifact/schema delta) — structural + schema + commit
cross-check reaches ~95% per the 2026-06-16 council. Stdlib only,
≤150 LOC. Hooked into `task ci-fast` via `task check-structural-breaking`.
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

QUIET = "--quiet" in sys.argv
REPO_ROOT = Path(__file__).resolve().parent.parent.parent
BASE_REF = "origin/main"

# Source artifact files whose deletion/rename is a breaking change.
ARTIFACT_RE = re.compile(
    r"^src/(?:"
    r"skills/[^/]+/SKILL\.md"
    r"|rules/[^/]+\.md"
    r"|domains/[^/]+/[^/]+/command\.md"
    r"|scripts/schemas/[^/]+\.schema\.json"
    r"|config/packs\.yml"
    r")$"
)
SCHEMA_RE = re.compile(r"^src/scripts/schemas/[^/]+\.schema\.json$")
SCHEMA_VERSION_RE = re.compile(r'"x-schemaVersion"\s*:\s*"([^"]+)"')
BANG_RE = re.compile(r"^[a-z]+(\([^)]+\))?!:", re.MULTILINE)
OVERRIDE = "ci-override: structural-breaking-ok"


def _git(*args: str) -> str:
    return subprocess.run(
        ["git", *args], cwd=REPO_ROOT, capture_output=True, text=True
    ).stdout


def _base() -> str:
    mb = _git("merge-base", BASE_REF, "HEAD").strip()
    return mb or BASE_REF


def _schema_version_at(ref: str, path: str) -> str | None:
    blob = _git("show", f"{ref}:{path}")
    m = SCHEMA_VERSION_RE.search(blob)
    return m.group(1) if m else None


def main() -> int:
    base = _base()
    if not base:
        return 0  # no trunk to diff against (e.g. shallow CI) → no-op
    names = _git("diff", "--name-status", f"{base}...HEAD")
    if not names.strip():
        return 0  # nothing changed vs trunk

    breaks: list[str] = []
    for line in names.splitlines():
        parts = line.split("\t")
        status = parts[0]
        if status.startswith("D") and ARTIFACT_RE.match(parts[1]):
            breaks.append(f"deleted artifact: {parts[1]}")
        elif status.startswith("R") and ARTIFACT_RE.match(parts[1]):
            breaks.append(f"renamed artifact: {parts[1]} -> {parts[2]}")
        elif status.startswith("M") and SCHEMA_RE.match(parts[1]):
            old = _schema_version_at(base, parts[1])
            new = _schema_version_at("HEAD", parts[1])
            if old is not None and old == new:
                breaks.append(
                    f"schema changed without x-schemaVersion bump "
                    f"(still {old}): {parts[1]}"
                )

    if not breaks:
        if not QUIET:
            print("✅ check-structural-breaking: no structural breaks vs trunk")
        return 0

    log = _git("log", "--format=%B", f"{base}..HEAD")
    annotated = bool(BANG_RE.search(log)) or "BREAKING CHANGE" in log
    overridden = OVERRIDE in log
    if annotated or overridden:
        if not QUIET:
            why = "breaking annotation" if annotated else "ci-override"
            print(f"✅ check-structural-breaking: {len(breaks)} break(s), "
                  f"cleared by {why}")
        return 0

    print("❌ check-structural-breaking: structural break(s) without a "
          "breaking annotation:", file=sys.stderr)
    for b in breaks:
        print(f"   - {b}", file=sys.stderr)
    print(
        "\nResolve by either:\n"
        "  • annotating the commit (`<type>!: …` or a `BREAKING CHANGE` line)\n"
        "    so release.py infers a major bump, or\n"
        "  • adding `ci-override: structural-breaking-ok` to a commit body\n"
        "    for an intentional deprecation-cycle completion.",
        file=sys.stderr,
    )
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
