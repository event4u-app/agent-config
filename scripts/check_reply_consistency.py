#!/usr/bin/env python3
"""check_reply_consistency.py — enforce user-interaction.md Iron Laws.

Single-Source Recommendation Line: a reply with numbered options must
have ONE bolded `Recommendation: N` / `Empfehlung: N` line, no inline
`(recommended)` / `(rec)` / `(empfohlen)` tag next to options, and the
recommended number must appear in the option block.

Modes:
  --stdin / --file <path>   Validate a single draft (all rules).
  --scan-dir <dir>          Scan .md tree for legacy inline-tag regression.

Exit codes:
  0 ok · 2 inline tag · 3 multi-rec · 4 rec-not-in-options
  5 options-without-rec (strict) · 6 scan-dir found · 9 usage error
"""
from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

OPTION_LINE_RE = re.compile(r"^\s*>?\s*(\d+)\.\s+\S")
REC_LINE_RE = re.compile(
    r"(?:Recommendation|Empfehlung)\s*:\s*(\d+)\b", re.IGNORECASE
)
TAG_RE = re.compile(r"\((?:recommended|rec|empfohlen)\)", re.IGNORECASE)
CODESPAN_RE = re.compile(r"`[^`\n]*`")


def _strip_codespans(line: str) -> str:
    return CODESPAN_RE.sub("``", line)


def find_inline_tag(text: str) -> tuple[int, str] | None:
    """Return (line_no, raw_line) of the first numbered-option line carrying
    an inline (recommended)-class tag outside code spans, or None."""
    for idx, raw in enumerate(text.splitlines(), start=1):
        stripped = _strip_codespans(raw)
        if not OPTION_LINE_RE.match(stripped):
            continue
        if TAG_RE.search(stripped):
            return idx, raw.strip()
    return None


def find_option_blocks(text: str) -> list[list[int]]:
    """Group consecutive numbered-option lines into blocks; return list of
    blocks, each a list of the numbers found in that block."""
    blocks: list[list[int]] = []
    current: list[int] = []
    for raw in text.splitlines():
        m = OPTION_LINE_RE.match(raw)
        if m:
            current.append(int(m.group(1)))
        else:
            if len(current) >= 2:
                blocks.append(current)
            current = []
    if len(current) >= 2:
        blocks.append(current)
    return blocks


def validate(text: str, strict: bool = False) -> tuple[int, str]:
    """Run rules. Returns (exit_code, human_message)."""
    tag = find_inline_tag(text)
    if tag:
        line_no, snippet = tag
        return 2, f"line {line_no}: inline tag on numbered option — {snippet!r}"

    blocks = find_option_blocks(text)
    rec_numbers = [int(n) for n in REC_LINE_RE.findall(text)]

    if not blocks:
        return 0, "ok (no numbered options block)"

    if not rec_numbers:
        if strict:
            return 5, "numbered options without Recommendation:/Empfehlung: line"
        return 0, "ok (options without recommendation; non-strict)"

    distinct = sorted(set(rec_numbers))
    if len(distinct) > 1:
        return 3, f"multiple distinct recommendation numbers: {distinct}"

    rec_num = distinct[0]
    for block in blocks:
        if rec_num in block:
            return 0, f"ok (recommendation {rec_num} matches option block)"
    return 4, f"recommendation {rec_num} not present in any option block"


def cmd_scan_dir(root: Path) -> int:
    if not root.is_dir():
        print(f"error: not a directory: {root}", file=sys.stderr)
        return 9
    violations: list[tuple[Path, int, str]] = []
    for md in sorted(root.rglob("*.md")):
        text = md.read_text(encoding="utf-8")
        for idx, raw in enumerate(text.splitlines(), start=1):
            stripped = _strip_codespans(raw)
            if OPTION_LINE_RE.match(stripped) and TAG_RE.search(stripped):
                violations.append((md, idx, raw.strip()))
    if violations:
        for path, line, snippet in violations:
            print(f"  🔴 {path}:{line} — inline-tag — {snippet}", file=sys.stderr)
        print(f"\n❌  {len(violations)} legacy-pattern violation(s)", file=sys.stderr)
        return 6
    print(f"✅  No legacy (recommended) tags found under {root}")
    return 0


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.split("\n", 1)[0])
    g = p.add_mutually_exclusive_group(required=True)
    g.add_argument("--stdin", action="store_true", help="read draft from stdin")
    g.add_argument("--file", type=Path, help="read draft from file")
    g.add_argument("--scan-dir", type=Path, help="scan dir for legacy inline tags")
    p.add_argument("--strict", action="store_true",
                   help="numbered options REQUIRE recommendation line (rule 5)")
    p.add_argument("-v", "--verbose", action="store_true")
    args = p.parse_args(argv)

    if args.scan_dir:
        return cmd_scan_dir(args.scan_dir)

    text = sys.stdin.read() if args.stdin else args.file.read_text(encoding="utf-8")
    code, msg = validate(text, strict=args.strict)
    if code == 0:
        if args.verbose:
            print(f"✅  {msg}")
        return 0
    print(f"❌  [exit {code}] {msg}", file=sys.stderr)
    return code


if __name__ == "__main__":
    sys.exit(main())
