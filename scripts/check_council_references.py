#!/usr/bin/env python3
"""CI guard for the council clause of the `no-roadmap-references` rule.

Council artefacts under `agents/runtime/council/{questions,responses,sessions}/`
are gitignored, local-only, and auto-pruned. A link to a specific
council file rots three ways: gitignored (not in cloned repo),
pruned after the retention window (gone even locally), and the
installed `.augment/` projection cannot follow a path that does not
exist in the consumer.

This linter scans durable artefacts for forbidden links to specific
council files. Directory mentions and placeholder paths
(`<timestamp>`, `<topic-slug>`) are allowed — they document the
output-path convention, not a live reference.

Forbidden hits in this codebase exist today (kernel-membership ADRs
cite real session JSONs as decision traces). Two source/target shapes
are exempt structurally — see STRUCTURAL_CARVEOUTS below — because
they encode immutable decision provenance, not transient drafting
state. Anything else needs an inline pragma at the end of the line:

    `agents/runtime/council/sessions/...json` <!-- council-ref-allowed: <reason> -->

Exit codes:
  0 — no forbidden references.
  1 — at least one forbidden reference found.

Invocation (from project root):
  python3 scripts/check_council_references.py
"""

from __future__ import annotations

import re
import sys
from pathlib import Path
from typing import Iterable

QUIET = "--quiet" in sys.argv

ROOT = Path(".")
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib.agent_src import artefact_roots, strip_source_prefix  # noqa: E402

# A specific file inside a council dir: must end with .md or .json,
# must NOT contain `<` or `>` (placeholders), must NOT contain backticks
# or quotes (those are line delimiters, not path content).
PATTERN = re.compile(
    r"agents/runtime/council/(?:questions|responses|sessions)/"
    r"([^\s\"'<>)\]`]+\.(?:md|json))"
)

# Only these durable surfaces are scanned. Archive, analysis, and the
# council dirs themselves are excluded by design.
#
# Source roots (legacy `.agent-src.uncompressed/` and every
# `packages/*/.agent-src.uncompressed/`) are discovered at runtime via
# `artefact_roots()` so the linter follows the monorepo physical layout.
FIXED_SCAN_ROOTS = (
    "agents/roadmaps",
    "agents/settings/contexts",
    "agents/reference/docs",
    "docs/contracts",
    "docs/decisions",
    "docs/guidelines",
)


def _scan_roots() -> tuple[str, ...]:
    cwd = Path(".").resolve()
    roots: list[str] = []
    for r in artefact_roots():
        try:
            roots.append(r.relative_to(cwd).as_posix() if r.is_absolute() else r.as_posix())
        except ValueError:
            # Root lives outside the current working directory (e.g. tests
            # chdir into a tmp tree). Skip — the test isolates its own
            # source tree.
            continue
    roots.extend(FIXED_SCAN_ROOTS)
    return tuple(roots)


SCAN_EXTS = (".md", ".yml", ".yaml", ".json", ".py")

# Files (or directory prefixes) that legitimately document the output
# convention or are scratch / archived. Paths are POSIX-style, repo-relative.
ALLOWLIST_PREFIXES: tuple[str, ...] = (
    # Archived roadmaps — historical evidence trail.
    "agents/roadmaps/archive/",
    # Working comparison docs — forward-refs to planned artefacts (mirrors
    # the SKIP_DIRS contract in scripts/check_references.py).
    "agents/evidence/analysis/",
    # The rule itself documents forbidden vs. allowed forms.
    ".agent-src.uncompressed/rules/no-roadmap-references.md",
    # ai-council skill documents the output-path schema.
    ".agent-src.uncompressed/skills/ai-council/",
    # Council commands document the output-path schema.
    ".agent-src.uncompressed/commands/council/",
    ".agent-src.uncompressed/commands/council.md",
)
# Top-level files that are also exempt (e.g. CHANGELOG with historical entries).
ALLOWLIST_FILES: frozenset[str] = frozenset({
    "CHANGELOG.md",
})

INLINE_PRAGMA = re.compile(r"<!--\s*council-ref-allowed:[^>]*-->")

# Structural carve-outs — (source_pattern, target_pattern) pairs where
# the reference is immutable decision provenance rather than transient
# drafting state. Driven by the 2026-05-14 P3.4 council round
# (agents/runtime/council/sessions/2026-05-14-p3-4-references/synthesis.md).
#
# Each entry: source file matches `source` regex AND the captured
# reference path matches `target` regex → reference is allowed without
# an inline pragma.
STRUCTURAL_CARVEOUTS: tuple[tuple[re.Pattern[str], re.Pattern[str]], ...] = (
    # (a) evaluation-context → council-question:
    # the question file is a frozen function-parameter / spend-gate
    # input, not a documentation link.
    (
        re.compile(r"^agents/settings/contexts/evaluation-[^/]+\.md$"),
        re.compile(r"^agents/runtime/council/questions/[^/]+\.md$"),
    ),
    # (b) contract → council-session-synthesis:
    # the synthesis file is the audit-trail receipt the contract cites
    # as decision provenance; the contract inlines the decision body.
    (
        re.compile(r"^docs/contracts/[^/]+\.md$"),
        re.compile(r"^agents/runtime/council/sessions/[^/]+/synthesis\.md$"),
    ),
)


def _is_allowlisted(rel: str) -> bool:
    """Match a repo-relative POSIX path against the allowlist.

    Allowlist prefixes are written against the legacy
    ``.agent-src.uncompressed/`` layout. A physical hit under
    ``packages/*/.agent-src.uncompressed/`` is normalised to the same
    logical path before matching so entries keep covering relocated files.
    """
    if rel in ALLOWLIST_FILES:
        return True
    if any(rel.startswith(prefix) for prefix in ALLOWLIST_PREFIXES):
        return True
    logical = strip_source_prefix(rel)
    if logical is not None:
        canon = f"{_LEGACY_PREFIX_STR}{logical}"
        if any(canon.startswith(prefix) for prefix in ALLOWLIST_PREFIXES):
            return True
    return False


_LEGACY_PREFIX_STR = ".agent-src.uncompressed/"


def _is_structurally_allowed(source_rel: str, target_capture: str) -> bool:
    """True when (source, target) matches a structural carve-out pair."""
    for src_re, tgt_re in STRUCTURAL_CARVEOUTS:
        if src_re.match(source_rel) and tgt_re.match(target_capture):
            return True
    return False


def _scan_file(path: Path) -> list[tuple[int, str]]:
    findings: list[tuple[int, str]] = []
    rel = path.as_posix()
    try:
        text = path.read_text(encoding="utf-8")
    except (OSError, UnicodeDecodeError):
        return findings
    for ln, line in enumerate(text.splitlines(), 1):
        if INLINE_PRAGMA.search(line):
            continue
        for m in PATTERN.finditer(line):
            if _is_structurally_allowed(rel, m.group(0)):
                continue
            findings.append((ln, m.group(0)))
    return findings


def _iter_files(roots: Iterable[str]) -> Iterable[Path]:
    for root in roots:
        base = ROOT / root
        if not base.exists():
            continue
        if base.is_file():
            yield base
            continue
        for path in sorted(base.rglob("*")):
            if path.is_file() and path.suffix in SCAN_EXTS:
                yield path


def main() -> int:
    violations: list[tuple[Path, int, str]] = []
    for path in _iter_files(_scan_roots()):
        rel = path.as_posix()
        if _is_allowlisted(rel):
            continue
        for ln, ref in _scan_file(path):
            violations.append((path, ln, ref))

    if not violations:
        if not QUIET:
            print("✅  No forbidden council references in durable artefacts.")
        return 0

    print(f"❌  {len(violations)} forbidden council reference(s):\n")
    for path, ln, ref in violations:
        print(f"  - {path.as_posix()}:{ln}: {ref}")
    print(
        "\nRule: .agent-src/rules/no-roadmap-references.md (council clause)\n"
        "Fix: inline the convergence summary (members + date) instead of\n"
        "linking the file. Two source/target shapes are exempt structurally\n"
        "(evaluation-context → council-question, contract →\n"
        "council-session-synthesis) — see STRUCTURAL_CARVEOUTS in this\n"
        "script. Otherwise append "
        "<!-- council-ref-allowed: <reason> --> on the same line to\n"
        "suppress when the reference is genuinely required (ADR decision\n"
        "trace)."
    )
    return 1


if __name__ == "__main__":
    sys.exit(main())
