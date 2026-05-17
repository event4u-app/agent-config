#!/usr/bin/env python3
"""Mechanical carve-out validator for caveman-compressed replies.

Given a pre-compression reply and a post-compression reply, assert that
every carve-out region from `.agent-src.uncompressed/rules/caveman-speak.md`
§ Carve-outs survived byte-for-byte:

  1. Triple-backtick code blocks (any language).
  2. Numbered-option lines  (`^>?\\s*\\d+\\.\\s` plus the
     `**Recommendation:**` / `**Empfehlung:**` label).
  3. Backtick spans (file paths, command names, identifiers).
  4. Status / error marker lines (prefix `❌`, `⚠️`, `✅`).
  5. Triple-backtick ALL-CAPS Iron-Law literal fences (subset of (1) —
     reported separately for diagnostics).

Stdlib only. Exit 0 = all carve-outs preserved; exit 1 = drift detected.
"""
from __future__ import annotations

import argparse
import difflib
import re
import sys
from pathlib import Path

# Triple-backtick fenced blocks (greedy across lines). Group 1 = body.
RE_CODE_FENCE = re.compile(r"```[^\n]*\n(.*?)\n```", re.DOTALL)
# Numbered-option line: optional `> ` quote prefix, digits, dot, space.
RE_NUMBERED = re.compile(r"^>?\s*\d+\.\s.*$", re.MULTILINE)
# Recommendation labels (both languages).
RE_RECOMMEND = re.compile(r"^\*\*(Recommendation|Empfehlung):\*\*.*$", re.MULTILINE)
# Backtick spans — single-tick, non-greedy, no newlines inside.
RE_BACKTICK_SPAN = re.compile(r"`[^`\n]+`")
# Status / error marker lines (full line containing the marker).
RE_STATUS_LINE = re.compile(r"^.*[❌⚠✅].*$", re.MULTILINE)
# Iron-Law ALL-CAPS fence body — letters + spaces + basic punctuation, ≥ 80 % uppercase.
RE_ALLCAPS_LINE = re.compile(r"^[A-Z0-9 ,\.\-—:'\"·/\(\)]+$")


def _extract_code_fences(text: str) -> list[str]:
    return [m.group(0) for m in RE_CODE_FENCE.finditer(text)]


def _extract_lines(text: str, pattern: re.Pattern) -> list[str]:
    return [m.group(0) for m in pattern.finditer(text)]


def _extract_backtick_spans(text: str) -> list[str]:
    # Excludes triple-backtick fences (handled separately).
    stripped = RE_CODE_FENCE.sub("", text)
    return RE_BACKTICK_SPAN.findall(stripped)


def _is_allcaps_fence_body(body: str) -> bool:
    lines = [ln.strip() for ln in body.splitlines() if ln.strip()]
    if not lines:
        return False
    return all(RE_ALLCAPS_LINE.match(ln) for ln in lines)


def _extract_allcaps_fences(text: str) -> list[str]:
    out: list[str] = []
    for m in RE_CODE_FENCE.finditer(text):
        if _is_allcaps_fence_body(m.group(1)):
            out.append(m.group(0))
    return out


CHECKS = (
    ("code_fences", _extract_code_fences),
    ("numbered_options", lambda t: _extract_lines(t, RE_NUMBERED)),
    ("recommendation_labels", lambda t: _extract_lines(t, RE_RECOMMEND)),
    ("backtick_spans", _extract_backtick_spans),
    ("status_markers", lambda t: _extract_lines(t, RE_STATUS_LINE)),
    ("allcaps_iron_law_fences", _extract_allcaps_fences),
)


def validate(pre: str, post: str) -> list[tuple[str, list[str]]]:
    """Return list of (carve_out_name, unified_diff_lines) per drifted category."""
    failures: list[tuple[str, list[str]]] = []
    for name, extractor in CHECKS:
        pre_list = extractor(pre)
        post_list = extractor(post)
        if pre_list == post_list:
            continue
        diff = list(difflib.unified_diff(
            [s + "\n" for s in pre_list],
            [s + "\n" for s in post_list],
            fromfile=f"pre/{name}",
            tofile=f"post/{name}",
            lineterm="",
        ))
        failures.append((name, diff))
    return failures


def _render(failures: list[tuple[str, list[str]]]) -> str:
    out = ["caveman carve-out validator: DRIFT DETECTED", ""]
    for name, diff in failures:
        out.append(f"❌ carve-out `{name}` drifted:")
        out.extend(diff)
        out.append("")
    return "\n".join(out)


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    p.add_argument("pre", type=Path, help="Pre-compression reply file.")
    p.add_argument("post", type=Path, help="Post-compression reply file.")
    args = p.parse_args(argv)
    if not args.pre.is_file():
        print(f"pre file not found: {args.pre}", file=sys.stderr)
        return 2
    if not args.post.is_file():
        print(f"post file not found: {args.post}", file=sys.stderr)
        return 2
    pre = args.pre.read_text(encoding="utf-8")
    post = args.post.read_text(encoding="utf-8")
    failures = validate(pre, post)
    if failures:
        print(_render(failures))
        return 1
    print("caveman carve-out validator: all carve-outs preserved ✅")
    return 0


if __name__ == "__main__":
    sys.exit(main())
