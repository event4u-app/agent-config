#!/usr/bin/env python3
"""Validate condensed-output paths in `.agent-src/rules/*.md`.

Runs after `scripts/condense.py` projects sources to `.agent-src/`. The
rewriter in `condense.py` is the load-bearing primitive (road-to-path-fixes
P1.2); this script is the post-condition gate (P5.1) — every `load_context:`
entry in `.agent-src/rules/*.md` must resolve relative to the rule file's
directory to an existing file, and forbidden substrings must not survive
the rewrite (unless declared in `validator_ignore`).

Forbidden substrings (load_context + body):
  - `.agent-src.uncondensed/`            unless declared in validator_ignore
  - `../../docs/`                         body-link two-up form (rewriter
                                           collapses to single-up)
  - `../../agents/`                       same shape, different root

Body-link checks (Council Decision 2, 2026-05-06):
  - `load_context:` entries MUST resolve to an existing file under
    `.agent-src/`.
  - Body markdown links to `../contexts/...md` MUST resolve.
  - Body markdown links to `../docs/guidelines/...md` are NOT checked
    (P3.1 was cancelled; resolution is intentionally out of scope, the
    Copilot suppression floor in P6 is the silencer).

`validator_ignore:` frontmatter primitive:
  - Per-rule allowlist for rules that *describe* a forbidden substring as
    their subject matter (e.g. `augment-source-of-truth` documents the
    `.agent-src.uncondensed/` boundary). Each entry: `{type, pattern,
    reason}`. The validator emits an audit line per matched ignore so
    drift cannot hide.

Exit codes: 0 = clean, 1 = violations found, 3 = internal error.
"""
from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path

import yaml

QUIET = "--quiet" in sys.argv

ROOT = Path(__file__).resolve().parent.parent
RULES_DIR = ROOT / ".agent-src" / "rules"

FORBIDDEN_SUBSTRINGS = (
    ".agent-src.uncondensed/",
    "../../docs/",
    "../../agents/",
)

# Markdown links: `[text](path)` — capture path. Skip URLs and anchors.
_LINK_RE = re.compile(r'\[[^\]]*\]\(([^)#\s]+)(?:#[^)]*)?\)')


# Body-link prefixes whose resolution is intentionally out of scope.
# Council Decision 2 (2026-05-06): P3.1 was cancelled, so guideline links
# under `.agent-src/rules/` cannot resolve in the projected tree. Copilot
# suppression (P6) is the silencer for the noise. `docs/contracts/` shares
# the same shape as `docs/guidelines/` — both live at repo root and the
# rewriter collapses `../../docs/{contracts,guidelines}/...` to a
# `../docs/...` form that cannot resolve under `.agent-src/`.
UNCHECKED_LINK_PREFIXES = (
    "../docs/guidelines/",
    "../../docs/guidelines/",
    "../docs/contracts/",
    "../../docs/contracts/",
)


@dataclass
class Violation:
    file: str
    line: int
    kind: str
    detail: str


@dataclass
class IgnoreEntry:
    """Frontmatter `validator_ignore:` entry."""
    kind: str       # "substring" | "link"
    pattern: str    # exact substring or link prefix to ignore
    reason: str     # human-readable rationale (audited)


def _split_frontmatter(text: str):
    if not text.startswith("---\n"):
        return None, text
    end = text.find("\n---\n", 4)
    if end == -1:
        return None, text
    fm_text = text[4:end]
    body = text[end + len("\n---\n"):]
    try:
        fm = yaml.safe_load(fm_text)
    except yaml.YAMLError:
        return None, text
    return fm if isinstance(fm, dict) else {}, body


def _parse_ignores(fm: dict) -> list[IgnoreEntry]:
    entries = fm.get("validator_ignore") or []
    if not isinstance(entries, list):
        return []
    out: list[IgnoreEntry] = []
    for raw in entries:
        if not isinstance(raw, dict):
            continue
        kind = str(raw.get("type") or "").strip()
        pattern = str(raw.get("pattern") or "").strip()
        reason = str(raw.get("reason") or "").strip()
        if kind in ("substring", "link") and pattern and reason:
            out.append(IgnoreEntry(kind=kind, pattern=pattern, reason=reason))
    return out


def _ignored(needle: str, ignores: list[IgnoreEntry], kind: str) -> IgnoreEntry | None:
    for ig in ignores:
        if ig.kind == kind and ig.pattern == needle:
            return ig
    return None


def _check_load_context(rule_file: Path, fm: dict, viols: list[Violation],
                        ignores: list[IgnoreEntry], audited: list[tuple[str, IgnoreEntry]]) -> None:
    rule_dir = rule_file.parent
    for key in ("load_context", "load_context_eager"):
        entries = fm.get(key) or []
        if not isinstance(entries, list):
            continue
        for entry in entries:
            if not isinstance(entry, str):
                continue
            blocked = False
            for needle in FORBIDDEN_SUBSTRINGS:
                if needle in entry:
                    ig = _ignored(needle, ignores, "substring")
                    if ig:
                        audited.append((str(rule_file.relative_to(ROOT)), ig))
                        continue
                    viols.append(Violation(
                        str(rule_file.relative_to(ROOT)), 0, f"{key}-forbidden",
                        f"forbidden substring {needle!r} in entry {entry!r}",
                    ))
                    blocked = True
                    break
            if blocked:
                continue
            target = (rule_dir / entry).resolve()
            if not target.is_file():
                viols.append(Violation(
                    str(rule_file.relative_to(ROOT)), 0, f"{key}-missing",
                    f"{entry!r} does not resolve to an existing file",
                ))


def _check_body(rule_file: Path, body: str, viols: list[Violation],
                ignores: list[IgnoreEntry], audited: list[tuple[str, IgnoreEntry]]) -> None:
    rule_dir = rule_file.parent
    for line_num, line in enumerate(body.splitlines(), start=1):
        for needle in FORBIDDEN_SUBSTRINGS:
            if needle in line:
                ig = _ignored(needle, ignores, "substring")
                if ig:
                    audited.append((f"{rule_file.relative_to(ROOT)}:{line_num}", ig))
                    continue
                viols.append(Violation(
                    str(rule_file.relative_to(ROOT)), line_num, "body-forbidden",
                    f"forbidden substring {needle!r}",
                ))
        for m in _LINK_RE.finditer(line):
            link = m.group(1)
            if link.startswith(("http://", "https://", "mailto:", "#")):
                continue
            if not link.endswith(".md"):
                continue
            if any(link.startswith(p) for p in UNCHECKED_LINK_PREFIXES):
                continue
            target = (rule_dir / link).resolve()
            if not target.is_file():
                viols.append(Violation(
                    str(rule_file.relative_to(ROOT)), line_num, "body-link-missing",
                    f"link target {link!r} does not resolve",
                ))


def main() -> int:
    if not RULES_DIR.is_dir():
        print(f"❌  {RULES_DIR} not found — run condensation first", file=sys.stderr)
        return 3
    viols: list[Violation] = []
    audited: list[tuple[str, IgnoreEntry]] = []
    for rule_file in sorted(RULES_DIR.glob("*.md")):
        text = rule_file.read_text(encoding="utf-8")
        fm, body = _split_frontmatter(text)
        ignores: list[IgnoreEntry] = _parse_ignores(fm) if fm is not None else []
        if fm is not None:
            _check_load_context(rule_file, fm, viols, ignores, audited)
        _check_body(rule_file, body, viols, ignores, audited)
    if audited:
        print("ℹ️   validator_ignore audit:")
        for loc, ig in audited:
            print(f"    {loc} — [{ig.kind}] {ig.pattern!r} → {ig.reason}")
        print()
    if viols:
        for v in viols:
            loc = f"{v.file}:{v.line}" if v.line else v.file
            print(f"❌  [{v.kind}] {loc} — {v.detail}")
        print(f"\n{len(viols)} violation(s) in .agent-src/rules/")
        return 1
    rule_count = len(list(RULES_DIR.glob('*.md')))
    if not QUIET:
        print(f"✅  condensed-path check clean ({rule_count} rules, {len(audited)} ignore(s) audited)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
