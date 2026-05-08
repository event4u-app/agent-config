#!/usr/bin/env python3
"""Measure markitdown's token-saving lift on the bundled corpus.

Runs against `tests/fixtures/markitdown-corpus/`. By default (no flags) the
script computes the baseline-only — raw byte size and a tokens-per-4-bytes
estimate — without calling `markitdown-mcp`. With `--convert`, the script
tries to invoke `markitdown` (CLI binary) via subprocess and computes the
converted-Markdown token estimate plus the ratio per file.

Stdlib-only. Never installs anything. Never invokes a network host. Never
calls `markitdown-mcp` over HTTP — only through the `markitdown` CLI on
the user's PATH (peer-side install per the skill's Step 1 recipes).

Exit codes:
  0  — baseline produced (always, when fixtures exist)
  2  — corpus not found
  3  — `--convert` was requested but `markitdown` is not on PATH
"""

from __future__ import annotations

import argparse
import shutil
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
CORPUS = REPO_ROOT / "tests" / "fixtures" / "markitdown-corpus"
TOKEN_PER_BYTES = 4  # rough OpenAI/Anthropic tokenizer-of-thumb


def _baseline_tokens(p: Path) -> int:
    return max(1, p.stat().st_size // TOKEN_PER_BYTES)


def _converted_tokens(p: Path, *, binary: str) -> int | None:
    try:
        out = subprocess.run(
            [binary, str(p)],
            capture_output=True,
            check=False,
            text=True,
            timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if out.returncode != 0:
        return None
    chars = len(out.stdout)
    if chars == 0:
        return None
    return max(1, chars // TOKEN_PER_BYTES)


def _format_ratio(baseline: int, converted: int | None) -> str:
    if converted is None or converted == 0:
        return "—"
    ratio = baseline / converted
    return f"{ratio:.1f}×"


def main() -> int:
    parser = argparse.ArgumentParser(description="Measure markitdown lift on the bundled corpus.")
    parser.add_argument(
        "--convert",
        action="store_true",
        help="Invoke `markitdown <fixture>` per file and compute the converted-token ratio.",
    )
    parser.add_argument(
        "--binary",
        default="markitdown",
        help="Name or path of the markitdown CLI binary (default: markitdown).",
    )
    args = parser.parse_args()

    if not CORPUS.is_dir():
        print(f"ERROR: corpus not found at {CORPUS}", file=sys.stderr)
        print(
            "Generate it: python3 tests/fixtures/markitdown-corpus/_generate.py",
            file=sys.stderr,
        )
        return 2

    fixtures = sorted(p for p in CORPUS.iterdir() if p.is_file() and p.suffix in {".pdf", ".pptx", ".docx", ".xlsx"})
    if not fixtures:
        print(f"ERROR: no fixtures in {CORPUS}", file=sys.stderr)
        return 2

    binary_path: str | None = None
    if args.convert:
        binary_path = shutil.which(args.binary)
        if binary_path is None:
            print(
                f"ERROR: --convert requested but `{args.binary}` not on PATH.\n"
                "Install peer-side per the skill's Step 1 recipes "
                "(Docker / pipx / uv) and re-run.",
                file=sys.stderr,
            )
            return 3

    print(f"Corpus: {CORPUS.relative_to(REPO_ROOT)}  ({len(fixtures)} files)")
    print(f"Mode:   {'convert (peer markitdown CLI)' if binary_path else 'baseline-only'}")
    if binary_path:
        print(f"Binary: {binary_path}")
    print()
    header = f"{'fixture':<32} {'bytes':>7} {'baseline tok':>13} {'converted tok':>14} {'ratio':>7}"
    print(header)
    print("-" * len(header))
    for p in fixtures:
        size = p.stat().st_size
        base = _baseline_tokens(p)
        converted = _converted_tokens(p, binary=binary_path) if binary_path else None
        ratio = _format_ratio(base, converted)
        conv_str = f"{converted}" if converted is not None else "—"
        print(f"{p.name:<32} {size:>7} {base:>13} {conv_str:>14} {ratio:>7}")
    print()
    if not binary_path:
        print(
            "Re-run with --convert (after installing markitdown-mcp peer-side per the skill's "
            "Step 1 recipes) for the actual ratio."
        )
    return 0


if __name__ == "__main__":
    sys.exit(main())
