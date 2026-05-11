#!/usr/bin/env python3
"""Sync the `event4u/agent-config` block in a project's `.gitignore`.

Reads the canonical block body from `config/gitignore-block.txt` and
ensures every managed entry is present in `.gitignore` between the
START and END markers:

    # event4u/agent-config
    ...managed entries...
    # event4u/agent-config — END

Idempotent. Append-only by default (user-added lines inside the block
are preserved). Call with `--replace` for a destructive full rewrite.

Usage:
    python3 scripts/sync_gitignore.py [--path .gitignore] [--template config/gitignore-block.txt]
                                      [--dry-run] [--replace] [--cleanup-legacy] [--quiet]

`--cleanup-legacy` additionally scrubs legacy patterns (pre-/agents/ layout
runtime artefacts) from anywhere in the target file — inside the managed
block and outside, where older installers or hand-edits dropped them.
Runs before the regular sync, so a single invocation removes garbage and
re-adds the current canonical entries.

Exit codes:
    0 — no changes needed (or --dry-run ran successfully)
    0 — changes applied
    2 — invalid arguments / template missing
"""

from __future__ import annotations

import argparse
import difflib
import sys
from pathlib import Path

SECTION_HEADER = "# event4u/agent-config"
SECTION_FOOTER = "# event4u/agent-config — END"
DEFAULT_GITIGNORE = ".gitignore"
DEFAULT_TEMPLATE = Path(__file__).resolve().parent.parent / "config" / "gitignore-block.txt"

# Legacy patterns that lived in older versions of config/gitignore-block.txt
# before runtime artefacts moved under /agents/ (May 2026). They get stripped
# wherever they appear in the consumer's .gitignore — inside the managed block
# or outside (older installers / hand-edits). Current canonical equivalents
# (e.g. /agents/.agent-chat-history) come from the template and are NOT
# affected. Leading-slash variants are matched defensively.
LEGACY_PATTERNS: tuple[str, ...] = (
    ".agent-chat-history",
    ".agent-chat-history.bak",
    ".agent-chat-history.*.bak",
    ".agent-prices.md",
    ".council-tmp/",
)


def _strip(ln: str) -> str:
    return ln.rstrip("\n").rstrip()


def _is_entry(ln: str) -> bool:
    """Non-empty, non-comment line = a path/pattern entry."""
    s = _strip(ln).lstrip()
    return bool(s) and not s.startswith("#")


def load_template(path: Path) -> list[str]:
    if not path.is_file():
        raise FileNotFoundError(f"template not found: {path}")
    text = path.read_text(encoding="utf-8")
    # Keep trailing newlines stripped; we splice explicit newlines.
    return [_strip(ln) for ln in text.splitlines()]


def find_block(lines: list[str]) -> tuple[int, int] | None:
    """Locate the managed block; return (start_idx, end_idx_exclusive).

    `start_idx` points at the SECTION_HEADER line.
    `end_idx_exclusive` points one past the last line of the block.
    Honors explicit SECTION_FOOTER when present; otherwise treats the
    block as extending to EOF or to the next non-managed section.
    Returns None if no header is found.
    """
    for i, ln in enumerate(lines):
        if _strip(ln) == SECTION_HEADER:
            start = i
            # Explicit footer?
            for j in range(i + 1, len(lines)):
                if _strip(lines[j]) == SECTION_FOOTER:
                    return (start, j + 1)
            # Legacy: extend to EOF or next non-managed section break.
            end = len(lines)
            for j in range(i + 1, len(lines)):
                s = _strip(lines[j]).lstrip()
                if (s.startswith("#")
                        and not s.startswith("# Agent config")
                        and s != SECTION_HEADER):
                    end = j
                    while end > i + 1 and _strip(lines[end - 1]) == "":
                        end -= 1
                    break
            return (start, end)
    return None


def block_entries(block_lines: list[str]) -> list[str]:
    """Return entries (paths/patterns) present in the given block."""
    return [_strip(ln).lstrip() for ln in block_lines if _is_entry(ln)]


def template_entries(template_lines: list[str]) -> list[str]:
    return [ln.lstrip() for ln in template_lines if _is_entry(ln)]


def build_fresh_block(template_lines: list[str]) -> list[str]:
    """Return a fresh, fully-managed block with START + body + END."""
    return [SECTION_HEADER, *template_lines, SECTION_FOOTER]


def sync_block(existing_lines: list[str],
               template_lines: list[str],
               *, replace: bool = False) -> tuple[list[str], list[str]]:
    """Return (new_lines, added_entries).

    - If block missing: append fresh block (preceded by a blank line if
      the file's last line is not already empty).
    - If block present and replace=True: rewrite block in full.
    - If block present and replace=False: append any missing managed
      entries before the END marker (adding END if absent). User-added
      lines inside the block are preserved.
    """
    loc = find_block(existing_lines)
    fresh = build_fresh_block(template_lines)

    # Missing block → append with leading blank if needed.
    if loc is None:
        new = list(existing_lines)
        if new and _strip(new[-1]) != "":
            new.append("")
        new.extend(fresh)
        return new, template_entries(template_lines)

    start, end = loc
    head = existing_lines[:start]
    block = existing_lines[start:end]
    tail = existing_lines[end:]

    if replace:
        added = [e for e in template_entries(template_lines)
                 if e not in block_entries(block)]
        return head + fresh + tail, added

    # Append-only mode.
    existing_entries = set(block_entries(block))
    missing = [e for e in template_entries(template_lines)
               if e not in existing_entries]
    if not missing:
        return existing_lines, []

    # Ensure block ends with SECTION_FOOTER; insert missing entries
    # right before it.
    if block and _strip(block[-1]) == SECTION_FOOTER:
        insert_at = len(block) - 1
    else:
        block = [*block, SECTION_FOOTER]
        insert_at = len(block) - 1
    new_block = block[:insert_at] + missing + block[insert_at:]
    return head + new_block + tail, missing


def cleanup_legacy(lines: list[str]) -> tuple[list[str], list[str]]:
    """Strip legacy entries from anywhere in the file.

    A line is legacy when its stripped, leading-whitespace-trimmed content
    matches a `LEGACY_PATTERNS` entry — with or without a leading slash.
    Comments and blank lines are untouched; current managed entries (e.g.
    `/agents/.agent-chat-history`) are not in the legacy set and survive.
    """
    legacy = set(LEGACY_PATTERNS)
    kept: list[str] = []
    removed: list[str] = []
    for ln in lines:
        s = _strip(ln).lstrip()
        if s in legacy or (s.startswith("/") and s[1:] in legacy):
            removed.append(s)
            continue
        kept.append(ln)
    return kept, removed


def format_file(lines: list[str]) -> str:
    """Join lines with newlines and enforce exactly one trailing newline."""
    text = "\n".join(lines)
    return text.rstrip("\n") + "\n"


def render_diff(old_text: str, new_text: str, path: str) -> str:
    return "".join(difflib.unified_diff(
        old_text.splitlines(keepends=True),
        new_text.splitlines(keepends=True),
        fromfile=path, tofile=path, n=3,
    ))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--path", default=DEFAULT_GITIGNORE,
                    help="target .gitignore (default: ./.gitignore)")
    ap.add_argument("--template", default=str(DEFAULT_TEMPLATE),
                    help="path to the managed-block template")
    ap.add_argument("--dry-run", action="store_true",
                    help="print diff; do not modify the file")
    ap.add_argument("--replace", action="store_true",
                    help="rewrite the block in full (discards user-added "
                         "lines inside the block)")
    ap.add_argument("--cleanup-legacy", action="store_true",
                    help="strip legacy patterns (pre-/agents/ layout) from "
                         "anywhere in the file before syncing the block")
    ap.add_argument("--quiet", action="store_true",
                    help="suppress summary on success")
    args = ap.parse_args(argv)

    template_path = Path(args.template)
    try:
        template_lines = load_template(template_path)
    except FileNotFoundError as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2

    target = Path(args.path)
    if target.is_file():
        existing_text = target.read_text(encoding="utf-8")
        existing_lines = [_strip(ln) for ln in existing_text.splitlines()]
    else:
        existing_text = ""
        existing_lines = []

    removed_legacy: list[str] = []
    if args.cleanup_legacy:
        existing_lines, removed_legacy = cleanup_legacy(existing_lines)

    new_lines, added = sync_block(
        existing_lines, template_lines, replace=args.replace,
    )
    new_text = format_file(new_lines)

    if new_text == existing_text:
        if not args.quiet:
            print(f"✅  {target}: block already in sync "
                  f"({len(template_entries(template_lines))} entries)")
        return 0

    if args.dry_run:
        diff = render_diff(existing_text, new_text, str(target))
        sys.stdout.write(diff)
        if not args.quiet:
            print(f"\n(dry-run) would add {len(added)} entr"
                  f"{'y' if len(added) == 1 else 'ies'} to {target}",
                  file=sys.stderr)
            if removed_legacy:
                print(f"(dry-run) would remove {len(removed_legacy)} legacy "
                      f"entr{'y' if len(removed_legacy) == 1 else 'ies'}: "
                      f"{', '.join(removed_legacy)}", file=sys.stderr)
        return 0

    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(new_text, encoding="utf-8")
    if not args.quiet:
        action = "replaced" if args.replace else "updated"
        print(f"✅  {target}: {action} block "
              f"({len(added)} entr{'y' if len(added) == 1 else 'ies'} added)")
        if removed_legacy:
            print(f"   removed {len(removed_legacy)} legacy "
                  f"entr{'y' if len(removed_legacy) == 1 else 'ies'}: "
                  f"{', '.join(removed_legacy)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
