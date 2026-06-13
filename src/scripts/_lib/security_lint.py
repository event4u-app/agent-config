#!/usr/bin/env python3
"""Shared helpers for the agent-security corpus linters (road-to-security-pillar.md P1).

Implements the **false-positive containment convention** (P1.5) so the
self-audit linters can scan a corpus that legitimately *contains* attack
strings as teaching material, without the allowlist-growth death-spiral:

1. **Fenced-block exemption** — content inside a ```` ```security-example ````
   fence is skipped by every check. Grep-auditable, scoped to the block.
2. **Confidence weighting** — a match in a doc / example / template / evals
   file scores at 0.25x; below the FAIL threshold it is a WARN, not an error.
3. **Per-file pragma** — ``<!-- security-lint: allow <check> "<reason>" -->``
   anywhere in the file suppresses one check for that file. Reasons are
   mandatory and counted; crossing PRAGMA_CAP entries repo-wide means the
   linter is wrong (escalate per autonomous-execution), not "add another".

There is **no global allowlist** — that is the rejected pattern.

The module is import-only (no side effects). Each linter builds its findings
with :func:`scan` + the predicates here, then calls :func:`report`.
"""
from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path

# repo root, resolved from src/scripts/_lib/security_lint.py
ROOT = Path(__file__).resolve().parents[3]

PRAGMA_CAP = 20
EXAMPLE_FENCE_LANG = "security-example"

# Shown in every linter's --help (P1.5 reference obligation).
GUIDELINE = "docs/guidelines/agent-infra/security-lint-containment.md"
GUIDELINE_EPILOG = (
    "False-positive containment (fenced security-example block, confidence "
    "weighting, per-file `security-lint: allow` pragma — no global allowlist): "
    f"see {GUIDELINE}."
)

# Source-of-truth roots scanned by the self-audit linters.
DEFAULT_SCAN_ROOTS = ("src/skills", "src/rules", "src/agent-src", "src/domains")

# A path is "example/teaching" (0.25x weight) when it lives under docs/ or
# evals/, or its name marks it as an example/template/fixture.
_EXAMPLE_PATH = re.compile(
    r"(^|/)(docs|evals|tests?|fixtures?)(/|$)|example|template|sample|/_template",
    re.IGNORECASE,
)

_PRAGMA = re.compile(
    r"<!--\s*security-lint:\s*allow\s+(?P<check>[\w-]+)\s+"
    r"\"(?P<reason>[^\"]+)\"\s*-->"
)

_FENCE = re.compile(r"^(\s*)(`{3,}|~{3,})\s*([\w-]*)\s*$")

SEVERITY_RANK = {"LOW": 1, "MED": 2, "HIGH": 3}


@dataclass(frozen=True)
class Finding:
    """One linter hit. ``weight`` is the confidence multiplier (1.0 or 0.25)."""

    path: str          # repo-relative
    line: int          # 1-based; 0 = file-level
    check: str         # stable check id, also the pragma key
    severity: str      # HIGH | MED | LOW
    message: str
    weight: float = 1.0

    @property
    def is_fail(self) -> bool:
        """A HIGH-severity, full-weight finding fails the build."""
        return self.severity == "HIGH" and self.weight >= 1.0


def is_example_path(rel_path: str) -> bool:
    return bool(_EXAMPLE_PATH.search(rel_path))


def path_weight(rel_path: str) -> float:
    return 0.25 if is_example_path(rel_path) else 1.0


@dataclass
class ScannedFile:
    """A file pre-split into lines with a fence/pragma mask the linters reuse."""

    path: Path
    rel: str
    lines: list[str]
    # per-line flags (1-based index → flag); index 0 unused
    in_example_fence: list[bool]
    in_any_fence: list[bool]
    pragmas: dict[str, str]          # check id → reason (first 15 lines)
    weight: float

    def pragma_allows(self, check: str) -> bool:
        return check in self.pragmas

    def iter_lines(self, *, skip_example_fence: bool = True,
                   skip_any_fence: bool = False):
        """Yield (lineno, text) honouring the fence masks."""
        for i, text in enumerate(self.lines, start=1):
            if skip_example_fence and self.in_example_fence[i]:
                continue
            if skip_any_fence and self.in_any_fence[i]:
                continue
            yield i, text


def scan_file(path: Path) -> ScannedFile:
    rel = path.relative_to(ROOT).as_posix() if path.is_absolute() else path.as_posix()
    raw = path.read_text(encoding="utf-8", errors="surrogatepass")
    lines = raw.splitlines()
    n = len(lines)
    in_example = [False] * (n + 1)
    in_any = [False] * (n + 1)

    fence_open = False
    fence_marker = ""
    fence_is_example = False
    for i, text in enumerate(lines, start=1):
        m = _FENCE.match(text)
        if m and not fence_open:
            fence_open = True
            fence_marker = m.group(2)[0]
            fence_is_example = m.group(3) == EXAMPLE_FENCE_LANG
            in_any[i] = True
            in_example[i] = fence_is_example
            continue
        if fence_open:
            in_any[i] = True
            in_example[i] = fence_is_example
            # closing fence: same marker char, 3+ long, no info string
            cm = _FENCE.match(text)
            if cm and cm.group(2)[0] == fence_marker and cm.group(3) == "":
                fence_open = False
                fence_is_example = False

    # Pragmas are explicit, grep-auditable opt-out markers — honour them
    # anywhere in the file (a long frontmatter can push the body past line 15).
    pragmas: dict[str, str] = {}
    for text in lines:
        for m in _PRAGMA.finditer(text):
            pragmas[m.group("check")] = m.group("reason")

    return ScannedFile(
        path=path,
        rel=rel,
        lines=lines,
        in_example_fence=in_example,
        in_any_fence=in_any,
        pragmas=pragmas,
        weight=path_weight(rel),
    )


def iter_corpus(roots=DEFAULT_SCAN_ROOTS, exts=(".md",)):
    """Yield ScannedFile for every matching file under the given roots."""
    for root in roots:
        base = ROOT / root
        if not base.exists():
            continue
        for path in sorted(base.rglob("*")):
            if path.is_file() and path.suffix in exts:
                yield scan_file(path)


def report(findings: list[Finding], *, check_label: str) -> int:
    """Print findings grouped by severity; return an exit code.

    Exit 1 iff at least one finding ``is_fail`` (HIGH + full weight). WARN-level
    (weighted-down or < HIGH) findings print but never fail the build.
    """
    if not findings:
        print(f"✅  {check_label}: clean ({_corpus_note()}).")
        return 0

    fails = [f for f in findings if f.is_fail]
    warns = [f for f in findings if not f.is_fail]

    for f in sorted(findings, key=lambda x: (-SEVERITY_RANK.get(x.severity, 0), x.path, x.line)):
        glyph = "\U0001f534" if f.is_fail else "⚠️"
        loc = f"{f.path}:{f.line}" if f.line else f.path
        wnote = "" if f.weight >= 1.0 else f" (weight {f.weight:g})"
        print(f"  {glyph} [{f.severity}] {f.check} — {loc}{wnote}: {f.message}")

    print()
    if fails:
        print(
            f"❌  {check_label}: {len(fails)} blocking finding(s), "
            f"{len(warns)} warning(s). Fix, or mark a true teaching example with a "
            f"```{EXAMPLE_FENCE_LANG} fence or a `security-lint: allow` pragma."
        )
        return 1
    print(f"⚠️  {check_label}: {len(warns)} warning(s), 0 blocking.")
    return 0


def _corpus_note() -> str:
    return "scanned " + ", ".join(DEFAULT_SCAN_ROOTS)
