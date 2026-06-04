#!/usr/bin/env python3
"""Thin-Root contract linter for AGENTS.md files (Phase 7).

Enforces caps + pointer-ratio + pointer-anatomy + emergency-triage
contract from `.agent-src.uncondensed/skills/agents-md-thin-root/SKILL.md`:

  (a) total char-count under FAIL/WARN budgets per file class
  (b) substantive-pointer ratio >= 0.40
  (c) every pointer's *why* clause >= 60 chars
  (d) every pointer target resolves on disk (anchor validity)
  (e) emergency-triage section present with the five canonical questions
  (f) path-enumeration WARN — bare `path/` bullets without a *why*
      clause and without a markdown link signal Capability-over-Structure
      drift; >= 3 such lines emits a WARN (not FAIL).

Exit non-zero on any (a) FAIL, (b)–(e) error. WARN is informational.
"""
from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "src" / "scripts"))
from _lib.agent_src import resolve_package_core_path  # noqa: E402

QUIET = "--quiet" in sys.argv

_CONSUMER_TEMPLATE = resolve_package_core_path(".agent-src.uncondensed/templates/AGENTS.md")
# Enforced packages/core target — read by scripts/check_gate_paths.py so a
# future move that desyncs this path fails CI instead of silently no-opping.
# Only the consumer-template lives under packages/core; the package-root
# AGENTS.md sits at the repo root and is intentionally excluded.
GATE_CORE_PATHS = (_CONSUMER_TEMPLATE,)

LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
PATH_BACKTICK_RE = re.compile(r"`[^`]*/[^`]*`")
BULLET_RE = re.compile(r"^\s*[-*+]\s+")
PATH_ENUM_THRESHOLD = 3
TRIAGE_KEYWORDS = (
    "what is this repo",
    "what language",
    "where do i edit",
    "lint / test / sync",
    "where do the always",
)


def _is_path_enumeration(line: str) -> bool:
    """A bullet line with a backticked path-like token and no link.

    These lines describe **where** a file lives without explaining
    **why** the agent should care — the Capabilities-over-Structure
    Iron Law forbids them in AGENTS.md. We accept up to two such
    lines (illustration / contrast); >= 3 = warn.
    """
    if not BULLET_RE.match(line):
        return False
    if LINK_RE.search(line):
        return False
    return bool(PATH_BACKTICK_RE.search(line))


@dataclass
class Target:
    path: Path
    label: str
    fail_at: int
    warn_at: int
    template: bool  # consumer template — relax pointer-target resolution


TARGETS = [
    Target(ROOT / "AGENTS.md", "package-root", 3000, 2800, template=False),
    Target(_CONSUMER_TEMPLATE, "consumer-template", 2500, 2300, template=True),
]


def _strip_links(line: str) -> str:
    return LINK_RE.sub(lambda m: m.group(1), line)


def _resolve(target_str: str, template: bool) -> bool:
    raw = target_str.split("#", 1)[0].strip()
    if raw.startswith("http://") or raw.startswith("https://"):
        return True
    candidates = [ROOT / raw]
    if template and raw.startswith(".augment/"):
        candidates.append(ROOT / raw.replace(".augment/", ".agent-src.uncondensed/", 1))
        candidates.append(ROOT / raw.replace(".augment/", ".agent-src/", 1))
    if raw.startswith(".agent-src/"):
        candidates.append(ROOT / raw.replace(".agent-src/", ".agent-src.uncondensed/", 1))
    return any(c.exists() for c in candidates)


def lint_file(t: Target) -> tuple[bool, list[str], list[str]]:
    """Return (ok, errors, warnings)."""
    errors: list[str] = []
    warnings: list[str] = []
    if not t.path.exists():
        return False, [f"{t.label}: {t.path} not found"], []

    text = t.path.read_text(encoding="utf-8")
    size = len(text.encode("utf-8"))

    # (a) size
    if size > t.fail_at:
        errors.append(f"{t.label}: {size} chars > FAIL cap {t.fail_at}")
    elif size > t.warn_at:
        warnings.append(f"{t.label}: {size} chars > WARN cap {t.warn_at}")

    # Filter out structural lines that are not "prose" the contract
    # asks us to replace with pointers: headings, code fences + content,
    # HTML comments, and Markdown table rows.
    lines = text.splitlines()
    in_fence = False
    in_comment = False
    prose: list[str] = []
    for ln in lines:
        s = ln.strip()
        if not s:
            continue
        if s.startswith("```"):
            in_fence = not in_fence
            continue
        if in_fence:
            continue
        if "<!--" in s:
            in_comment = True
        if in_comment:
            if "-->" in s:
                in_comment = False
            continue
        if s.startswith("#"):  # heading
            continue
        if s.startswith("|"):  # markdown table row / separator
            continue
        prose.append(ln)

    non_blank = prose
    pointer_lines = 0
    path_enum_lines: list[str] = []

    for ln in non_blank:
        if _is_path_enumeration(ln):
            path_enum_lines.append(ln.strip())
        m = LINK_RE.search(ln)
        if not m:
            continue
        target = m.group(2)
        # (d) target resolves
        if not _resolve(target, t.template):
            errors.append(f"{t.label}: broken pointer target `{target}` in line: {ln.strip()[:100]}")
        # (c) why-clause length: line minus link syntax
        why = _strip_links(ln).strip()
        if len(why) >= 60:
            pointer_lines += 1
        # else line has a link but no real why-clause — does not count

    # (b) ratio
    ratio = pointer_lines / max(len(non_blank), 1)
    if ratio < 0.40:
        errors.append(
            f"{t.label}: substantive-pointer ratio {ratio:.2f} < 0.40 "
            f"({pointer_lines}/{len(non_blank)} non-blank lines)"
        )

    # (f) path-enumeration WARN
    if len(path_enum_lines) >= PATH_ENUM_THRESHOLD:
        sample = path_enum_lines[0][:80]
        warnings.append(
            f"{t.label}: {len(path_enum_lines)} path-enumeration lines "
            f"(>= {PATH_ENUM_THRESHOLD}) — Capabilities-over-Structure drift; "
            f"first: {sample!r}"
        )

    # (e) emergency-triage block
    lower = text.lower()
    missing = [k for k in TRIAGE_KEYWORDS if k not in lower]
    if missing:
        errors.append(f"{t.label}: emergency-triage block missing keywords: {missing}")
    if "emergency triage" not in lower:
        errors.append(f"{t.label}: missing 'Emergency triage' section heading")

    return not errors, errors, warnings


def main() -> int:
    rc = 0
    for t in TARGETS:
        ok, errors, warnings = lint_file(t)
        if not QUIET or errors or warnings:
            print(f"== {t.label} ({t.path.relative_to(ROOT)}) ==")
        for w in warnings:
            print(f"  ⚠️  {w}")
        for e in errors:
            print(f"  ❌  {e}")
        if ok and not warnings and not QUIET:
            print(f"  ✅  ok ({t.path.stat().st_size} bytes)")
        if not ok:
            rc = 1
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
