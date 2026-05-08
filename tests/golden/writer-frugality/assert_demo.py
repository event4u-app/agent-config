"""Phase 0.6 smoke-test assertions for the Frugality writer demo.

Runs four explicit zero-count assertions on
`tests/golden/writer-frugality/demo-output.md`, plus the
charter-cite presence check. Intended to be invoked from CI
or by hand:

    python3 tests/golden/writer-frugality/assert_demo.py

Exits non-zero on any failure with a precise diff line.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

GOLDEN = Path(__file__).parent / "demo-output.md"

OPENER_TOKENS = (
    r"\bLet me\b",
    r"\bNow I will\b",
    r"\bFound it\b",
    r"\bOK\b",
    r"\bAlright\b",
)
NUMBERED_OPTIONS_RE = re.compile(r"^\s*>\s*\d+\.\s+\S", re.MULTILINE)
POST_ACTION_BLOCK_RE = re.compile(r"^##\s+(Status|Summary)\s*$", re.MULTILINE)
CHARTER_CITE_RE = re.compile(
    r"\[[^\]]+\]\([^)]*frugality-charter\.md[^)]*\)"
)


INLINE_CODE_RE = re.compile(r"`[^`\n]+`")


def strip_code_blocks(text: str) -> str:
    """Remove fenced code blocks AND inline code spans so opener tokens
    quoted inside code don't trip prose checks."""
    out, in_block = [], False
    for line in text.splitlines():
        if line.lstrip().startswith("```") or line.lstrip().startswith("````"):
            in_block = not in_block
            continue
        if not in_block:
            out.append(INLINE_CODE_RE.sub("", line))
    return "\n".join(out)


def assert_zero_openers(text: str) -> list[str]:
    failures: list[str] = []
    prose = strip_code_blocks(text)
    for token_re in OPENER_TOKENS:
        for line_no, line in enumerate(prose.splitlines(), start=1):
            if re.search(token_re, line, re.IGNORECASE):
                failures.append(
                    f"opener token {token_re!r} on line {line_no}: {line.strip()}"
                )
    return failures


def assert_zero_numbered_options(text: str) -> list[str]:
    matches = NUMBERED_OPTIONS_RE.findall(text)
    if matches:
        return [f"numbered-options block detected: {len(matches)} match(es)"]
    return []


def assert_zero_post_action_blocks(text: str) -> list[str]:
    failures: list[str] = []
    for match in POST_ACTION_BLOCK_RE.finditer(text):
        failures.append(f"forbidden post-action heading: {match.group(0).strip()}")
    return failures


def assert_charter_cite(text: str) -> list[str]:
    if not CHARTER_CITE_RE.search(text):
        return ["charter cite missing — expected link to frugality-charter.md"]
    return []


def main() -> int:
    if not GOLDEN.exists():
        print(f"FAIL: golden file missing at {GOLDEN}")
        return 2
    text = GOLDEN.read_text(encoding="utf-8")

    checks = [
        ("zero opener tokens", assert_zero_openers(text)),
        ("zero numbered-options blocks", assert_zero_numbered_options(text)),
        ("zero post-action blocks", assert_zero_post_action_blocks(text)),
        ("charter cite present", assert_charter_cite(text)),
    ]

    failed = False
    for name, issues in checks:
        if issues:
            failed = True
            print(f"FAIL: {name}")
            for issue in issues:
                print(f"  - {issue}")
        else:
            print(f"PASS: {name}")

    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
